import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import * as semver from 'semver'

// Translations between actions input and Julia arch names
const osMap = {
    'win32': 'winnt',
    'darwin': 'mac',
    'linux': 'linux'
}
const archMap = {
    'x86': 'i686',
    'x64': 'x86_64'
}

// Store information about the environment
const osPlat = osMap[os.platform()] // possible values: win32 (Windows), linux (Linux), darwin (macOS)
core.debug(`platform: ${osPlat}`)

/**
 * @returns The content of the downloaded versions.json file as object.
 */
export async function getJuliaVersionInfo(): Promise<object> {
    const versionsFile = await tc.downloadTool('https://julialang-s3.julialang.org/bin/versions.json')

    return JSON.parse(fs.readFileSync(versionsFile).toString())
}

/**
 * @returns An array of all Julia versions available for download
 */
export async function getJuliaVersions(versionInfo): Promise<string[]> {
    let versions: string[] = []

    for (var version in versionInfo) {
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

function getNightlyFileName(arch: string): string {
    let versionExt: string, ext: string

    if (osPlat == 'winnt') {
        versionExt = arch == 'x64' ? '-win64' : '-win32'
        ext = 'exe'
    } else if (osPlat == 'mac') {
        if (arch == 'x86') {
            throw new Error('32-bit Julia is not available on macOS')
        }
        versionExt = '-mac64'
        ext = 'dmg'
    } else if (osPlat === 'linux') {
        versionExt = arch == 'x64' ? '-linux64' : '-linux32'
        ext = 'tar.gz'
    } else {
        throw new Error(`Platform ${osPlat} is not supported`)
    }

    return `julia-latest${versionExt}.${ext}`
}

export async function getDownloadURL(versionInfo, version: string, arch: string): Promise<string> {

    core.debug('CHECKPOINT getDownloadURL')

    // nightlies
    if (version == 'nightly') {
        const baseURL = 'https://julialangnightlies-s3.julialang.org/bin'
        return `${baseURL}/${osPlat}/${arch}/${getNightlyFileName(arch)}`
    }

    versionInfo[version].files.forEach(file => {
        if (file.os == osPlat && file.arch == archMap[arch]) {
            return file.url
        }
    })

    throw `Could not find ${archMap[arch]}/${version} binaries`
}

export async function installJulia(versionInfo, version: string, arch: string): Promise<string> {

    core.debug('CHECKPOINT installJulia')

    // Download Julia
    const downloadURL = await getDownloadURL(versionInfo, version, arch)
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
