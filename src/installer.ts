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
    if (semver.valid(versionInput) == versionInput || versionInput.endsWith('nightly')) {
        // versionInput is a valid version or a nightly version, use it directly
        return versionInput
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

export function getFileInfo(versionInfo, version: string, arch: string) {
    if (version.endsWith('nightly')) {
        return null
    }

    for (let file of versionInfo[version].files) {
        if (file.os == osMap[osPlat] && file.arch == archMap[arch]) {
            return file
        }
    }

    throw `Could not find ${archMap[arch]}/${version} binaries`
}

export function getDownloadURL(fileInfo, version: string, arch: string): string {
    const baseURL = `https://julialangnightlies-s3.julialang.org/bin/${osMap[osPlat]}/${arch}`

    // release branch nightlies, e.g. 1.6-nightlies should return .../bin/linux/x64/1.6/julia-latest-linux64.tar.gz
    const majorMinorMatches = /^(\d*.\d*)-nightly/.exec(version)
    if (majorMinorMatches) {
        return `${baseURL}/${majorMinorMatches[1]}/${getNightlyFileName(arch)}`
    }

    // nightlies
    if (version == 'nightly') {
        return `${baseURL}/${getNightlyFileName(arch)}`
    }

    return fileInfo.url
}

export async function installJulia(versionInfo, version: string, arch: string): Promise<string> {
    // Download Julia
    const fileInfo = getFileInfo(versionInfo, version, arch)
    const downloadURL = getDownloadURL(fileInfo, version, arch)
    core.debug(`downloading Julia from ${downloadURL}`)
    const juliaDownloadPath = await tc.downloadTool(downloadURL)

    // Verify checksum
    if (!version.endsWith('nightly')) {
        const checkSum = await calculateChecksum(juliaDownloadPath)
        if (fileInfo.sha256 != checkSum) {
            throw new Error(`Checksum of downloaded file does not match the expected checksum from versions.json.\nExpected: ${fileInfo.sha256}\nGot: ${checkSum}`)
        }
        core.debug(`Checksum of downloaded file matches expected checksum: ${checkSum}`)
    } else {
        core.debug('Skipping checksum check for nightly binaries.')
    }

    const tempInstallDir = fs.mkdtempSync(`julia-${arch}-${version}-`)

    // Install it
    switch (osPlat) {
        case 'linux':
            // tc.extractTar doesn't support stripping components, so we have to call tar manually
            await exec.exec('tar', ['xf', juliaDownloadPath, '--strip-components=1', '-C', tempInstallDir])
            return tempInstallDir
        case 'win32':
            if (version.endsWith('nightly') || semver.gtr(version, '1.3', {includePrerelease: true})) {
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

/**
 * Test if Julia has been installed and print the version.
 * 
 * true => always show versioninfo
 * false => only show on nightlies
 * never => never show it anywhere
 * 
 * @param showVersionInfoInput 
 */
export async function showVersionInfo(showVersionInfoInput: string, version: string): Promise<void> {
    // --compile=min -O0 reduces the time from ~1.8-1.9s to ~0.8-0.9s
    let exitCode: number

    switch (showVersionInfoInput) {
        case 'true':
            exitCode = await exec.exec('julia', ['--compile=min', '-O0', '-e', 'using InteractiveUtils; versioninfo()'])
            break
    
        case 'false':
            if (version.endsWith('nightly')) {
                exitCode = await exec.exec('julia', ['--compile=min', '-O0', '-e', 'using InteractiveUtils; versioninfo()'])
            } else {
                exitCode = await exec.exec('julia', ['--version'])
            }
            break
        
        case 'never':
            exitCode = await exec.exec('julia', ['--version'])
            break

        default:
            throw new Error(`${showVersionInfoInput} is not a valid value for show-versioninfo. Supported values: true | false | never`)
    }

    if (exitCode !== 0) {
        throw new Error(`Julia could not be installed properly. Exit code: ${exitCode}`)
    }
}
