import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

import * as path from 'path'

import * as installer from './installer'

async function run() {
    try {
        const versionInput = core.getInput('version')
        const arch = core.getInput('arch')
        const version = await installer.getJuliaVersion(versionInput)
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
        
        // Test if Julia has been installed by showing versioninfo()
        await exec.exec('julia', ['-e', 'using InteractiveUtils; versioninfo()'])
    } catch (error) {
        core.setFailed(error.message)
    }
}

run()
