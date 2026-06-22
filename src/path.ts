import * as core from '@actions/core'
import * as io from '@actions/io'

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// Normalise a path for comparison: resolve symlinks, make it absolute, and (on
// Windows, where the filesystem is case-insensitive) lower-case it. Throws if
// the path does not exist.
function normalizePath(p: string): string {
    const resolved = path.resolve(fs.realpathSync(p))
    return os.platform() == 'win32' ? resolved.toLowerCase() : resolved
}

// Configure PATH and the environment so that subsequent steps and downstream
// actions use the Julia we just installed at `juliaPath`, dethroning any Julia
// preinstalled on the runner image that would otherwise shadow it.
export async function configureJuliaPath(juliaPath: string): Promise<void> {
    const juliaBindir = path.join(juliaPath, 'bin')
    const expectedJulia = path.join(juliaBindir, os.platform() == 'win32' ? 'julia.exe' : 'julia')

    // Detect any Julia already resolvable on PATH *before* we prepend ours. Some
    // runner images (e.g. GitHub's `windows-2025`) ship a Julia on PATH that can
    // shadow the version we install when a later step invokes bare `julia` (e.g.
    // via Git Bash on Windows). Capture it now so we can dethrone it below.
    const preexistingJulia = await io.which('julia', false)

    // Add our Julia to PATH for subsequent steps.
    core.addPath(juliaBindir)

    // Export the absolute path to the Julia we just installed so that downstream
    // actions (e.g. julia-runtest) can invoke it directly and bypass PATH lookup
    // entirely, which is immune to any shadowing.
    core.exportVariable('JULIA_ACTIONS_JULIA', expectedJulia)

    // Set output
    core.setOutput('julia-bindir', juliaBindir)

    // If a different Julia was already on PATH, prepending ours is not always
    // enough: depending on PATH state it can still win bare `julia` lookups in
    // later steps. Remove its bin directory from PATH for subsequent steps, but
    // only when that directory is a self-contained Julia install, so we never drop
    // a shared directory (e.g. a Chocolatey shim dir) that holds other tools too.
    // The PATH change is scoped to this job and touches no files, so it is safe on
    // self-hosted runners.
    if (preexistingJulia && normalizePath(preexistingJulia) !== normalizePath(expectedJulia)) {
        const shadowBindir = path.dirname(path.resolve(fs.realpathSync(preexistingJulia)))
        const isDedicatedJuliaDir = fs.existsSync(path.join(shadowBindir, '..', 'share', 'julia'))
        if (isDedicatedJuliaDir) {
            const shadowNorm = normalizePath(shadowBindir)
            const cleaned = (process.env['PATH'] || '')
                .split(path.delimiter)
                .filter(entry => {
                    if (!entry) return false
                    try {
                        return normalizePath(entry) !== shadowNorm
                    } catch {
                        return true
                    }
                })
                .join(path.delimiter)
            core.exportVariable('PATH', cleaned)
            core.warning(`A preinstalled Julia at ${preexistingJulia} was shadowing setup-julia's install at ${expectedJulia}. Removed ${shadowBindir} from PATH for subsequent steps. Downstream actions can also use the JULIA_ACTIONS_JULIA environment variable to invoke the installed Julia directly.`)
        } else {
            core.warning(`A preinstalled Julia at ${preexistingJulia} may shadow setup-julia's install at ${expectedJulia} when a later step invokes bare \`julia\`. Its directory was left on PATH because it does not look like a dedicated Julia install. Use the JULIA_ACTIONS_JULIA environment variable to invoke the installed Julia directly, or fix the runner's PATH.`)
        }
    }
}
