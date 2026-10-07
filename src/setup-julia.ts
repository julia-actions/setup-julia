import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as tc from '@actions/tool-cache'

import * as fs from 'fs'
import * as https from 'https'
import * as os from 'os'
import * as path from 'path'

import * as installer from './installer'

// Note: before we index into this dict, we always first do `.toLowerCase()` on
// the key.
//
// Therefore, this dict does not need to account for differences in case.
const archSynonyms = {
    'x86': 'x86',
    'x64': 'x64',
    'x86_64': 'x64',
    'aarch64': 'aarch64',
    'arm64': 'aarch64'
}

// Normalise a path for comparison: resolve symlinks, make it absolute, and (on
// Windows, where the filesystem is case-insensitive) lower-case it. Throws if the
// path does not exist.
function normalizePath(p: string): string {
    const resolved = path.resolve(fs.realpathSync(p))
    return os.platform() == 'win32' ? resolved.toLowerCase() : resolved
}

// Resolve `name` (e.g. `julia` or `julia.exe`) the way the given shell would, and
// return the normalised Windows path it points at, or null if the shell is
// unavailable or the command isn't found there. This catches shadowing that a
// Node-side `io.which` cannot: Git Bash and PowerShell each have their own command
// resolution (MSYS PATH translation, PATHEXT, command hashing), so bare `julia` in
// one shell can resolve to a different Julia than `julia.exe`, or than Node sees.
async function whichInShell(shell: 'bash' | 'pwsh' | 'powershell', name: string): Promise<string | null> {
    let args: string[]
    if (shell == 'bash') {
        // Resolve in bash, then convert the MSYS path to a Windows path (via
        // cygpath when available) so it's comparable to the toolcache path.
        const script = `p="$(command -v '${name}' 2>/dev/null)" || exit 0; ` +
            `[ -n "$p" ] || exit 0; ` +
            `if command -v cygpath >/dev/null 2>&1; then cygpath -wa "$p"; else printf '%s' "$p"; fi`
        args = ['-c', script]
    } else {
        args = ['-NoProfile', '-Command', `$ErrorActionPreference='SilentlyContinue'; (Get-Command '${name}').Source`]
    }

    let stdout: string
    try {
        const res = await exec.getExecOutput(shell, args, {silent: true, ignoreReturnCode: true})
        stdout = res.stdout.trim()
    } catch {
        return null // shell not available on this runner
    }

    if (!stdout) return null
    try {
        return normalizePath(stdout)
    } catch {
        return null // resolved to something that doesn't exist / can't be normalised
    }
}

// Windows-specific: warn if `julia`/`julia.exe`, as resolved by Git Bash or
// PowerShell, point at a different Julia than the one we just installed. Warn-only;
// the remedy is to fix the runner's PATH (or have downstream actions invoke the
// installed binary by absolute path).
async function warnOnShellShadowing(expectedJulia: string): Promise<void> {
    let expected: string
    try {
        expected = normalizePath(expectedJulia)
    } catch {
        return
    }

    const shells: Array<'bash' | 'pwsh' | 'powershell'> = ['bash', 'pwsh', 'powershell']
    for (const shell of shells) {
        for (const name of ['julia', 'julia.exe']) {
            const resolved = await whichInShell(shell, name)
            if (resolved === null) continue // shell unavailable or command not found there
            if (resolved !== expected) {
                core.warning(
                    `In ${shell}, \`${name}\` resolves to ${resolved}, not setup-julia's install at ${expectedJulia}. ` +
                    `Another Julia in PATH is shadowing it, so downstream steps using ${shell} may run the wrong Julia. ` +
                    `Fix the runner's PATH (e.g. remove or reorder the shadowing entry), or have downstream actions invoke the installed Julia by absolute path.`
                )
            }
        }
    }
}

async function run() {
    try {
        // Debugging info
        if (core.isDebug()) {
            // Log Runner IP Address
            https.get('https://httpbin.julialang.org/ip', resp => {
                let data = ''

                resp.on('data', chunk => {
                    data += chunk
                })

                resp.on('end', () => {
                    core.debug(`Runner IP address: ${JSON.parse(data).origin}`)
                })
            }).on('error', err => {
                core.debug(`ERROR: Could not retrieve runner IP: ${err}`)
            })
        }

        // Inputs.
        // Note that we intentionally strip leading and lagging whitespace by using `.trim()`
        const versionInput = core.getInput('version').trim()
        const includePrereleases = core.getInput('include-all-prereleases').trim() == 'true'
        const originalArchInput = core.getInput('arch').trim()
        const forceArch = core.getInput('force-arch').trim() == 'true'
        const projectInput = core.getInput('project').trim()  // Julia project file

        // It can easily happen that, for example, a workflow file contains an input `version: ${{ matrix.julia-version }}`
        // while the strategy matrix only contains a key `${{ matrix.version }}`.
        // In that case, we want the action to fail, rather than trying to download julia from an URL that's missing parts and 404ing.
        // We _could_ fall back to the default but that means that builds silently do things differently than they're meant to, which
        // is worse than failing the build.
        if (!versionInput) { // if `versionInput` is an empty string
            throw new Error('Version input must not be null')
        }
        if (versionInput == '1.6') {
            core.notice('[setup-julia] If you are testing 1.6 as a Long Term Support (lts) version, consider using the new "lts" version specifier instead of "1.6" explicitly, which will automatically resolve the current lts.')
        }
        if (!originalArchInput) { // if `originalArchInput` is an empty string
            throw new Error(`Arch input must not be null`)
        }

        if (originalArchInput == 'x64' && os.platform() == 'darwin' && os.arch() == 'arm64') {
            if (forceArch) {
                core.warning('[setup-julia] x64 arch has been requested on a macOS runner that has an arm64 (Apple Silicon) architecture. The "force-arch" input is set to "true", so proceeding with x64 installation. Note that this will mean Julia will be run under Rosetta emulation.')
            } else {
                throw new Error('[setup-julia] x64 arch has been requested on a macOS runner that has an arm64 (Apple Silicon) architecture. You may have meant to use the "aarch64" arch instead (or "default" or left it unspecified for the correct default). To force the use of x64 on this runner, set the "force-arch" input to "true".')
            }
        }

        let processedArchInput: string;
        if (originalArchInput == "default") {
            // If the user sets the `arch` input to `default`, then we use the
            // architecture of the machine that we are running on.
            processedArchInput = os.arch();
            core.debug(`The "arch" input is "default", so we will use the machine arch: ${processedArchInput}`)
        } else {
            processedArchInput = originalArchInput;
        }
        // Note: we convert the key `processedArchInput` to lower case
        // before we index into the `archSynonyms` dict.
        const arch = archSynonyms[processedArchInput.toLowerCase()]
        core.debug(`Mapped the "arch" from ${processedArchInput} to ${arch}`)

        // Determine the Julia compat ranges as specified by the Project.toml only for special versions that require them.
        let juliaCompatRange: string = "";
        if ((versionInput === "min") || (versionInput === "min-minor") || (versionInput === "min-patch")) {
            const projectFilePath = installer.getProjectFilePath(projectInput)
            juliaCompatRange = installer.readJuliaCompatRange(fs.readFileSync(projectFilePath).toString())
        }

        const versionInfo = await installer.getJuliaVersionInfo()
        const availableReleases = await installer.getJuliaVersions(versionInfo)
        const version = installer.getJuliaVersion(availableReleases, versionInput, includePrereleases, juliaCompatRange)
        core.debug(`selected Julia version: ${arch}/${version}`)
        core.setOutput('julia-version', version)

        // Search in cache
        let juliaPath: string;
        juliaPath = tc.find('julia', version, arch)

        // tc.find only checks for the .complete marker; the marker can be present
        // while the directory is empty/partial because tc.cacheDir is called with
        // an empty dir BEFORE installJulia extracts into it (see PR196 hack below).
        // Validate the cached entry by checking the binary file exists.
        if (juliaPath) {
            const cachedJuliaBin = path.join(juliaPath, 'bin', os.platform() == 'win32' ? 'julia.exe' : 'julia')
            if (!fs.existsSync(cachedJuliaBin)) {
                core.warning(`Cached Julia ${arch}/${version} at ${juliaPath} is incomplete (missing ${cachedJuliaBin}); reinstalling.`)
                juliaPath = ''
            }
        }

        if (!juliaPath) {
            core.debug(`could not find Julia ${arch}/${version} in cache`)

            // https://github.com/julia-actions/setup-julia/pull/196
            // we want julia to be installed with unmodified file mtimes
            // but `tc.cacheDir` uses `cp` internally which destroys mtime
            // and `tc` provides no API to get the tool directory alone
            // so hack it by installing a empty directory then use the path it returns
            // and extract the archives directly to that location
            const emptyDir = fs.mkdtempSync('empty')
            juliaPath = await tc.cacheDir(emptyDir, 'julia', version, arch)
            await installer.installJulia(juliaPath, versionInfo, version, arch)

            core.debug(`added Julia to cache: ${juliaPath}`)

            // Remove empty dir
            fs.rmdirSync(emptyDir)
        } else {
            core.debug(`using cached version of Julia: ${juliaPath}`)
        }

        // Add it to PATH
        const juliaBindir = path.join(juliaPath, 'bin')
        core.addPath(juliaBindir)

        // Verify that PATH lookup of `julia` resolves to the binary we just installed.
        // On self-hosted runners other Julia entries (e.g. juliaup launcher in
        // ~/.juliaup/bin) can shadow the toolcache binary depending on PATH state.
        // `io.which('julia', true)` also asserts that Julia is findable at all
        // (it throws otherwise).
        const resolvedJulia = await io.which('julia', true)
        const expectedJulia = path.join(juliaBindir, os.platform() == 'win32' ? 'julia.exe' : 'julia')
        if (os.platform() == 'win32') {
            // On Windows, downstream steps run in Git Bash or PowerShell, whose
            // command resolution differs from Node's `io.which` (and can differ
            // between `julia` and `julia.exe`). Check each shell directly.
            await warnOnShellShadowing(expectedJulia)
        } else if (normalizePath(resolvedJulia) !== normalizePath(expectedJulia)) {
            core.warning(`PATH lookup of \`julia\` resolves to ${resolvedJulia}, not the installed binary at ${expectedJulia}. Another Julia in PATH is shadowing setup-julia's install; fix the runner's PATH (e.g. remove or reorder \`~/.juliaup/bin\`).`)
        }

        // Set output
        core.setOutput('julia-bindir', juliaBindir)

        // Test if Julia has been installed and print the version
        const showVersionInfoInput = core.getInput('show-versioninfo')
        await installer.showVersionInfo(showVersionInfoInput, version)
    } catch (error) {
        core.setFailed((error as Error).message)
    }
}

run()
