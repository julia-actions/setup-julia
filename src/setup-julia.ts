import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

import * as os from 'os'
import * as path from 'path'

// Store information about the environment
const osPlat = os.platform() // possible values: win32 (Windows), linux (Linux), darwin (macOS)
console.log(`[DEBUG] platform: ${osPlat}`)

function getMajorMinorVersion(version: string): string {
    return version.split('.').slice(0, 2).join('.')
}

function getDownloadURL(version: string): string {
    const baseURL = 'https://julialang-s3.julialang.org/bin'
    let platform: string, arch: string
    const versionDir = getMajorMinorVersion(version)

    if (osPlat === 'win32') { // Windows
        platform = 'winnt'
        arch = 'x64'
    } else if (osPlat === 'darwin') { // macOS
        platform = 'mac'
        arch = 'x64'
    } else if (osPlat === 'linux') { // Linux
        platform = 'linux'
        arch = 'x64'
    } else {
        throw `Platform ${osPlat} is not supported`
    }

    return `${baseURL}/${platform}/${arch}/${versionDir}/${getFileName(version)}`
}

function getFileName(version: string): string {
    let versionExt: string, ext: string

    if (osPlat === 'win32') { // Windows
        versionExt = '-win64'
        ext = 'exe'
    } else if (osPlat === 'darwin') { // macOS
        versionExt = '-mac64'
        ext = 'dmg'
    } else if (osPlat === 'linux') { // Linux
        versionExt = '-linux-x86_64'
        ext = 'tar.gz'
    } else {
        throw `Platform ${osPlat} is not supported`
    }

    return `julia-${version}${versionExt}.${ext}`
}

async function run() {
    try {
        const version = core.getInput('version')
        console.log(`[DEBUG] selected Julia version: ${version}`)

        // Download Julia
        const downloadURL = getDownloadURL(version)
        console.log(`[DEBUG] download Julia from ${downloadURL}`)
        const juliaDownloadPath = await tc.downloadTool(downloadURL)

        // Install Julia
        if (osPlat === 'linux') { // Linux
            const juliaExtractedFolder = await tc.extractTar(juliaDownloadPath)
            const juliaCachedPath = await tc.cacheDir(juliaExtractedFolder, 'julia', version)
            const juliaPath = path.join(juliaCachedPath, `julia-${version}`)
            core.addPath(path.join(juliaPath, 'bin'))
        
        } else if (osPlat === 'win32') { // Windows
            // Install Julia in C:\Julia
            const juliaInstallationPath = path.join('C:', 'Julia')
            await exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/S /D=${juliaInstallationPath}" -NoNewWindow -Wait`])
            const juliaCachedPath = await tc.cacheDir(juliaInstallationPath, 'julia', version)
            core.addPath(path.join(juliaCachedPath, 'bin'))
        
        } else if (osPlat === 'darwin') { // macOS
            await exec.exec('hdiutil', ['attach', juliaDownloadPath])
            const juliaCachedPath = await tc.cacheDir(`/Volumes/Julia-${version}/Julia-${getMajorMinorVersion(version)}.app/Contents/Resources/julia`, 'julia', version)
            core.addPath(path.join(juliaCachedPath, 'bin'))
        }

        // Test if Julia has been installed by showing versioninfo()
        await exec.exec('julia', ['-e', 'using InteractiveUtils; versioninfo()'])
    } catch (error) {
        core.setFailed(error.message)
    }
}

run()
