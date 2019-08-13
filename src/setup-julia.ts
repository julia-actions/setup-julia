import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

import * as os from 'os'
import * as path from 'path'

async function run() {
    try {
        const version = core.getInput('version')
        console.log(`[DEBUG] selected Julia version: ${version}`)

        // Store information about the environment
        const osPlat = os.platform()
        const osArch = os.arch()

        // For now, just download Linux x64 binaries and add it to PATH
        const juliaDownloadPath = await tc.downloadTool(
            'https://julialang-s3.julialang.org/bin/linux/x64/1.0/julia-1.0.4-linux-x86_64.tar.gz'
        )
        const juliaExtractedFolder = await tc.extractTar(juliaDownloadPath)
        const juliaCachedPath = await tc.cacheDir(juliaExtractedFolder, 'julia', '1.0.4', 'x64')
        const juliaPath = path.join(juliaCachedPath, 'julia-1.0.4')
        core.addPath(path.join(juliaPath, 'bin'))

        // Test if it worked
        await exec.exec('julia', ['-e', 'using InteractiveUtils; versioninfo()'])
    } catch (error) {
        core.setFailed(error.message)
    }
}

run()
