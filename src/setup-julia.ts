import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

import * as os from 'os'
import * as path from 'path'

// Store information about the environment
const osPlat = os.platform() // possible values: win32 (Windows), linux (Linux), darwin (macOS)
core.debug(`platform: ${osPlat}`)

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

async function installJulia(version: string): Promise<string> {
    // Download Julia
    const downloadURL = getDownloadURL(version)
    core.debug(`downloading Julia from ${downloadURL}`)
    const juliaDownloadPath = await tc.downloadTool(downloadURL)

    // Install it
    switch (osPlat) {
        case 'linux':
            const juliaExtractedFolder = await tc.extractTar(juliaDownloadPath)
            return path.join(juliaExtractedFolder, `julia-${version}`)
        case 'win32':
            const juliaInstallationPath = path.join('C:', 'Julia')
            await exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/S /D=${juliaInstallationPath}" -NoNewWindow -Wait`])
            return juliaInstallationPath
        case 'darwin':
            await exec.exec('hdiutil', ['attach', juliaDownloadPath])
            return `/Volumes/Julia-${version}/Julia-${getMajorMinorVersion(version)}.app/Contents/Resources/julia`
        default:
            throw `Platform ${osPlat} is not supported`
    }
}

async function run() {
    try {
        const version = core.getInput('version')
        core.debug(`selected Julia version: ${version}`)

        // Search in cache
        let juliaPath: string;
        juliaPath = tc.find('julia', version)

        if (!juliaPath) {
            core.debug(`could not find Julia ${version} in cache`)
            const juliaInstallationPath = await installJulia(version);

            // Add it to cache
            juliaPath = await tc.cacheDir(juliaInstallationPath, 'julia', version)
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
