import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

import * as crypto from 'crypto'
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
const osPlat = os.platform() // possible values: win32 (Windows), linux (Linux), darwin (macOS)
core.debug(`platform: ${osPlat}`)

/**
 * @returns The SHA256 checksum of a given file.
 */
async function calculateChecksum(file: string): Promise<string> {
    const hash = crypto.createHash('sha256')
    const input = fs.createReadStream(file)

    return new Promise((resolve, reject) => {
        input.on('data', (chunk) => {
            hash.update(chunk)
        })

        input.on('end', () => {
            const digest = hash.digest('hex')
            digest ? resolve(digest) : reject(new Error(`Could not calculate checksum of file ${file}: digest was empty.`))
        })
    })
}

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

    for (let version in versionInfo) {
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

    if (osPlat == 'win32') {
        versionExt = arch == 'x64' ? '-win64' : '-win32'
        ext = 'exe'
    } else if (osPlat == 'darwin') {
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

export function getDownloadURL(versionInfo, version: string, arch: string): string {
    // nightlies
    if (version == 'nightly') {
        const baseURL = 'https://julialangnightlies-s3.julialang.org/bin'
        return `${baseURL}/${osMap[osPlat]}/${arch}/${getNightlyFileName(arch)}`
    }

    for (let file of versionInfo[version].files) {
        if (file.os == osMap[osPlat] && file.arch == archMap[arch]) {
            core.debug(file)
            return file.url
        }
    }

    throw `Could not find ${archMap[arch]}/${version} binaries`
}

export async function installJulia(versionInfo, version: string, arch: string): Promise<string> {
    // Download Julia
    const downloadURL = getDownloadURL(versionInfo, version, arch)
    core.debug(`downloading Julia from ${downloadURL}`)
    const juliaDownloadPath = await tc.downloadTool(downloadURL)

    // Verify checksum
    core.debug(versionInfo[version].sha256)
    core.debug(await calculateChecksum(juliaDownloadPath))
    if (versionInfo[version].sha256 != await calculateChecksum(juliaDownloadPath)) {
        throw new Error('Checksum of downloaded file does not match the expected checksum from versions.json')
    }

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
