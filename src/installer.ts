import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import * as semver from 'semver'

// Store information about the environment
const osPlat = os.platform() // possible values: win32 (Windows), linux (Linux), darwin (macOS)
core.debug(`platform: ${osPlat}`)

/**
 * @returns The content of the downloaded versions.json file as object.
 */
export async function getJuliaVersionInfo(): Promise<object> {
    let versionsFile = tc.find('julia-versions', 'latest')
    if (!versionsFile) {
        versionsFile = await tc.downloadTool('https://julialang-s3.julialang.org/bin/versions.json')
        tc.cacheFile(versionsFile, 'versions.json', 'julia-versions', 'latest')
    }

    return JSON.parse(fs.readFileSync(versionsFile).toString())
}

/**
 * @returns An array of all Julia versions available for download
 */
export async function getJuliaVersions(juliaVersionInfo): Promise<string[]> {
    let versions: string[] = []

    for (var version in juliaVersionInfo) {
        versions.push(version)
    }

    return versions
}

export function getJuliaVersion(availableReleases: string[], versionInput: string): string {
    if (semver.valid(versionInput) == versionInput) {
        // versionInput is a valid version, use it directly
        return versionInput
    }

    // nightlies
    if (versionInput == 'nightly') {
        return 'nightly'
    }

    // Use the highest available version that matches versionInput
    let version = semver.maxSatisfying(availableReleases, versionInput)
    if (version == null) {
        throw new Error(`Could not find a Julia version that matches ${versionInput}`)
    }

    // GitHub tags start with v, remove it
    version = version.replace(/^v/, '')

    return version
}

function getMajorMinorVersion(version: string): string {
    return version.split('.').slice(0, 2).join('.')
}

function getDownloadURL(version: string, arch: string): string {
    let platform: string

    if (osPlat === 'win32') { // Windows
        platform = 'winnt'
    } else if (osPlat === 'darwin') { // macOS
        if (arch == 'x86') {
            throw new Error('32-bit Julia is not available on macOS')
        }
        platform = 'mac'
    } else if (osPlat === 'linux') { // Linux
        platform = 'linux'
    } else {
        throw new Error(`Platform ${osPlat} is not supported`)
    }

    // nightlies
    if (version == 'nightly') {
        const baseURL = 'https://julialangnightlies-s3.julialang.org/bin'
        return `${baseURL}/${platform}/${arch}/${getFileName('latest', arch)}`
    }

    // normal versions
    const baseURL = 'https://julialang-s3.julialang.org/bin'
    const versionDir = getMajorMinorVersion(version)

    return `${baseURL}/${platform}/${arch}/${versionDir}/${getFileName(version, arch)}`
}

function getFileName(version: string, arch: string): string {
    let versionExt: string, ext: string

    if (osPlat === 'win32') { // Windows
        versionExt = arch == 'x64' ? '-win64' : '-win32'
        ext = 'exe'
    } else if (osPlat === 'darwin') { // macOS
        if (arch == 'x86') {
            throw new Error('32-bit Julia is not available on macOS')
        }
        versionExt = '-mac64'
        ext = 'dmg'
    } else if (osPlat === 'linux') { // Linux
        if (version == 'latest') { // nightly version
            versionExt = arch == 'x64' ? '-linux64' : '-linux32'
        } else {
            versionExt = arch == 'x64' ? '-linux-x86_64' : '-linux-i686'
        }
        ext = 'tar.gz'
    } else {
        throw new Error(`Platform ${osPlat} is not supported`)
    }

    return `julia-${version}${versionExt}.${ext}`
}

export async function installJulia(version: string, arch: string): Promise<string> {
    // Download Julia
    const downloadURL = getDownloadURL(version, arch)
    core.debug(`downloading Julia from ${downloadURL}`)
    const juliaDownloadPath = await tc.downloadTool(downloadURL)

    const tempInstallDir = fs.mkdtempSync(`julia-${arch}-${version}-`)

    // Install it
    switch (osPlat) {
        case 'linux':
            // tc.extractTar doesn't support stripping components, so we have to call tar manually
            await exec.exec('tar', ['xf', juliaDownloadPath, '--strip-components=1', '-C', tempInstallDir])
            return tempInstallDir
        case 'win32':
            if (version == 'nightly' || semver.gtr(version, '1.3', {includePrerelease: true})) {
                // The installer changed in 1.4: https://github.com/JuliaLang/julia/blob/ef0c9108b12f3ae177c51037934351ffa703b0b5/NEWS.md#build-system-changes
                await exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/SILENT /dir=${path.join(process.cwd(), tempInstallDir)}" -NoNewWindow -Wait`])
            } else {
                await exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/S /D=${path.join(process.cwd(), tempInstallDir)}" -NoNewWindow -Wait`])
            }
            return tempInstallDir
        case 'darwin':
            await exec.exec('hdiutil', ['attach', juliaDownloadPath])
            await exec.exec('/bin/bash', ['-c', `cp -a /Volumes/Julia-*/Julia-*.app/Contents/Resources/julia ${tempInstallDir}`])
            return path.join(tempInstallDir, 'julia')
        default:
            throw new Error(`Platform ${osPlat} is not supported`)
    }
}
