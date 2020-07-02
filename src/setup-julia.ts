import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as tc from '@actions/tool-cache'

import * as path from 'path'

import * as installer from './installer'

async function run() {
    try {
        const versionInput = core.getInput('version')
        const arch = core.getInput('arch')
        const availableReleases = installer.juliaVersions
        const version = await installer.getJuliaVersion(availableReleases, versionInput)
        core.debug(`selected Julia version: ${arch}/${version}`)

        // Search in cache
        let juliaPath: string;
        juliaPath = tc.find('julia', version, arch)

        if (!juliaPath) {
            core.debug(`could not find Julia ${version} in cache`)
            const juliaInstallationPath = await installer.installJulia(version, arch);

            // Add it to cache
            juliaPath = await tc.cacheDir(juliaInstallationPath, 'julia', version, arch)
            core.debug(`added Julia to cache: ${juliaPath}`)
        } else {
            core.debug(`using cached version of Julia: ${juliaPath}`)
        }

        // Add it to PATH
        core.addPath(path.join(juliaPath, 'bin'))
        
        // Test if Julia has been installed
        exec.exec('julia', ['--version'])

        // If enabled, also show the full version info
        if (core.getInput('show-versioninfo') == 'true') {
            exec.exec('julia', ['-e', 'using InteractiveUtils; versioninfo()'])
        }

        // Pkg telemetry opt out
        let telemetryInput = core.getInput('pkg-telemetry')
        if (!['true', 'false', 'default'].includes(telemetryInput)) {
            core.warning(`Invalid pkg-telemetry input: ${telemetryInput}. Must be 'true', 'false' or 'default'. Falling back to 'false'.`)
            telemetryInput = 'false'
        }

        // Assume it's a private repo by default
        let isPrivateRepo = true

        // If the event payload contains info on the privateness state of the repo, use that instead
        if (github.context.payload.repository) {
            isPrivateRepo = github.context.payload.repository.private
            core.debug(`inferred privateness state of the repo: ${isPrivateRepo}`)
        }

        // isPrivateRepo && input 'true' => don't opt-out
        // isPrivateRepo && input 'default' => opt-out
        // 'input false' => always opt-out
        if (telemetryInput == 'false' || (isPrivateRepo && telemetryInput != 'true')) {
            await installer.optOutOfPkgTelemetry()
        }
    } catch (error) {
        core.setFailed(error.message)
    }
}

run()
