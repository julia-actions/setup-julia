import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

import * as https from 'https'
import * as os from 'os'
import * as path from 'path'

import * as semver from 'semver'

// Store information about the environment
const osPlat = os.platform() // possible values: win32 (Windows), linux (Linux), darwin (macOS)
core.debug(`platform: ${osPlat}`)

// This is temporary until we have a better way of fetching releases (see #1, #4 for details)
export const juliaVersions = ['v1.3.0-rc4', 'v1.3.0-rc3', 'v1.3.0-rc2', 'v1.0.5', 'v1.2.0', 'v1.3.0-rc1', 'v1.2.0-rc3', 'v1.3.0-alpha', 'v1.2.0-rc2', 'v1.2.0-rc1', 'v1.1.1', 'v1.0.4', 'v1.1.0', 'v1.1.0-rc2', 'v1.1.0-rc1', 'v1.0.3', 'v1.0.2', 'v1.0.1', 'v1.0.0', 'v0.7.0', 'v1.0.0-rc1', 'v0.7.0-rc3', 'v0.7.0-rc2', 'v0.7.0-rc1', 'v0.7.0-beta2', 'v0.6.4', 'v0.7.0-beta', 'v0.7.0-alpha', 'v0.6.3', 'v0.6.2', 'v0.6.1', 'v0.6.0', 'v0.6.0-rc3', 'v0.6.0-rc2', 'v0.5.2', 'v0.6.0-rc1', 'v0.6.0-pre.beta', 'v0.5.1', 'v0.6.0-pre.alpha', 'v0.5.0', 'v0.4.7', 'v0.5.0-rc4', 'v0.5.0-rc3', 'v0.5.0-rc2', 'v0.5.0-rc1', 'v0.5.0-rc0', 'v0.4.6', 'v0.4.5', 'v0.4.4', 'v0.4.3', 'v0.4.2', 'v0.4.1', 'v0.3.12', 'v0.4.0', 'v0.4.0-rc4', 'v0.4.0-rc3', 'v0.4.0-rc2', 'v0.4.0-rc1', 'v0.3.11', 'v0.3.10', 'v0.3.9', 'v0.3.8', 'v0.3.7', 'v0.3.6', 'v0.3.5', 'v0.3.4', 'v0.3.3', 'v0.3.2', 'v0.3.1', 'v0.3.0', 'v0.3.0-rc4', 'v0.3.0-rc3', 'v0.3.0-rc2', 'v0.3.0-rc1', 'v0.2.0-rc1', 'v0.2.0-rc3', 'v0.2.0-rc4', 'v0.2.0', 'v0.2.0-rc2']

export async function getJuliaVersion(availableReleases: string[], versionInput: string): Promise<string> {
    if (semver.valid(versionInput) == versionInput) {
        // versionInput is a valid version, use it directly
        return versionInput
    }

    // Use the highest available version that matches versionInput
    let version = semver.maxSatisfying(availableReleases, versionInput)
    if (version == null) {
        throw `Could not find a Julia version that matches ${versionInput}`
    }

    // GitHub tags start with v, remove it
    version = version.replace(/^v/, '')

    return version
}

function getMajorMinorVersion(version: string): string {
    return version.split('.').slice(0, 2).join('.')
}

function getDownloadURL(version: string, arch: string): string {
    const baseURL = 'https://julialang-s3.julialang.org/bin'
    let platform: string
    const versionDir = getMajorMinorVersion(version)

    if (osPlat === 'win32') { // Windows
        platform = 'winnt'
    } else if (osPlat === 'darwin') { // macOS
        if (arch == 'x86') {
            throw '32-bit Julia is not available on macOS'
        }
        platform = 'mac'
    } else if (osPlat === 'linux') { // Linux
        platform = 'linux'
    } else {
        throw `Platform ${osPlat} is not supported`
    }

    return `${baseURL}/${platform}/${arch}/${versionDir}/${getFileName(version, arch)}`
}

function getFileName(version: string, arch: string): string {
    let versionExt: string, ext: string

    if (osPlat === 'win32') { // Windows
        versionExt = arch == 'x64' ? '-win64' : '-win32'
        ext = 'exe'
    } else if (osPlat === 'darwin') { // macOS
        if (arch == 'x86') {
            throw '32-bit Julia is not available on macOS'
        }
        versionExt = '-mac64'
        ext = 'dmg'
    } else if (osPlat === 'linux') { // Linux
        versionExt = arch == 'x64' ? '-linux-x86_64' : '-linux-i686'
        ext = 'tar.gz'
    } else {
        throw `Platform ${osPlat} is not supported`
    }

    return `julia-${version}${versionExt}.${ext}`
}

export async function installJulia(version: string, arch: string): Promise<string> {
    // Download Julia
    const downloadURL = getDownloadURL(version, arch)
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
