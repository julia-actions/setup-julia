import * as core from '@actions/core'
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
    'aarch64': 'aarch64',
    'arm64': 'aarch64'
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
        const projectInput = core.getInput('project').trim()

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
        if (versionInput === "MIN") {
            const projectFile = installer.getProjectFile(projectInput)
            juliaCompatRange = installer.readJuliaCompatRange(fs.readFileSync(projectFile).toString())
        }

        const versionInfo = await installer.getJuliaVersionInfo()
        const availableReleases = await installer.getJuliaVersions(versionInfo)
        const version = installer.getJuliaVersion(availableReleases, versionInput, includePrereleases, juliaCompatRange)
        core.debug(`selected Julia version: ${arch}/${version}`)
        core.setOutput('julia-version', version)

        // Search in cache
        let juliaPath: string;
        juliaPath = tc.find('julia', version, arch)

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
        core.addPath(path.join(juliaPath, 'bin'))

        // Set output
        core.setOutput('julia-bindir', path.join(juliaPath, 'bin'))

        // Test if Julia has been installed and print the version
        const showVersionInfoInput = core.getInput('show-versioninfo')
        await installer.showVersionInfo(showVersionInfoInput, version)
    } catch (error) {
        core.setFailed((error as Error).message)
    }
}

run()
