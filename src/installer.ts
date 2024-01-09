import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import retry = require('async-retry')

import * as semver from 'semver'
import * as toml from 'toml'

// Translations between actions input and Julia arch names
const osMap = {
    'win32': 'winnt',
    'darwin': 'mac',
    'linux': 'linux'
}
const archMap = {
    'x86': 'i686',
    'x64': 'x86_64',
    'aarch64': 'aarch64'
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
    // Occasionally the connection is reset for unknown reasons
    // In those cases, retry the download
    const versionsFile = await retry(async (bail: Function) => {
        return await tc.downloadTool('https://julialang-s3.julialang.org/bin/versions.json')
    }, {
        retries: 5,
        onRetry: (err: Error) => {
            core.info(`Download of versions.json failed, trying again. Error: ${err}`)
        }
    })

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

export function getProjectFile(projectInput: string = ""): string {
    let projectFile: string = ""

    // Default value for projectInput
    if (!projectInput) {
        projectInput = process.env.JULIA_PROJECT || "."
    }

    if (fs.existsSync(projectInput) && fs.lstatSync(projectInput).isFile()) {
        projectFile = projectInput
    } else {
        for (let projectFilename of ["JuliaProject.toml", "Project.toml"]) {
            let p = path.join(projectInput, projectFilename)
            if (fs.existsSync(p) && fs.lstatSync(p).isFile()) {
                projectFile = p
                break
            }
        }
    }

    if (!projectFile) {
        throw new Error(`Unable to locate project file with project input: ${projectInput}`)
    }

    return projectFile
}

export function validJuliaRange(range: string): string | null {
    range = range.trim()

    // NPM's semver doesn't understand unicode characters such as `≥` so we'll convert to alternatives
    range = range.replace("≥", ">=").replace("≤", "<=")

    if (!semver.validRange(range) || range.replace(/\s+/g, " ").split(/(?<![>=<≥~^]| -) (?!- )/).length > 1) {
        return null
    } else if (range.search(/^\d/) === 0 && !range.includes(" ")) {
        // Compat version is just a basic version number (e.g. 1.2.3). Since Julia's Pkg.jl's uses caret
        // as the default specifier (e.g. `1.2.3 == ^1.2.3`) and NPM's semver uses tilde as the default
        // specifier (e.g. `1.2.3 == 1.2.x == ~1.2.3`) we will introduce the caret specifier to ensure the
        // orignal intent is respected.
        // https://pkgdocs.julialang.org/v1/compatibility/#Version-specifier-format
        // https://github.com/npm/node-semver#x-ranges-12x-1x-12-
        range = "^" + range
    }

    return range
}

/**
 * @returns An array of version ranges compatible with the Julia project
 */
export function readJuliaCompatVersions(projectFileContent: string): string[] {
    let compatVersions: string[] = []

    let meta = toml.parse(projectFileContent)
    for (let versionRange of meta.compat?.julia?.split(",") || []) {
        versionRange = validJuliaRange(versionRange)

        if (!versionRange) {
            throw new Error(`Invalid version range found in Julia compat: ${versionRange}`)
        }

        compatVersions.push(versionRange)
    }

    return compatVersions
}

export function getJuliaVersion(availableReleases: string[], versionInput: string, includePrerelease: boolean = false, juliaCompatVersions: string[] = []): string {
    let version: string | null

    if (semver.valid(versionInput) == versionInput || versionInput.endsWith('nightly')) {
        // versionInput is a valid version or a nightly version, use it directly
        version = versionInput
    } else if (versionInput == "MIN") {
        // Resolve "MIN" to the minimum supported Julia version compatible with the project file
        if (!juliaCompatVersions.length) {
            throw new Error('Unable to use version "MIN" when the Julia project file does not specify a compat for Julia')
        }
        let minVersions = juliaCompatVersions.map(v => semver.minSatisfying(availableReleases, v, {includePrerelease}))
        version = semver.sort(minVersions.filter((v): v is string => v !== null))[0]
    } else {
        // Use the highest available version that matches versionInput
        version = semver.maxSatisfying(availableReleases, versionInput, {includePrerelease})
    }

    if (!version) {
        throw new Error(`Could not find a Julia version that matches ${versionInput}`)
    }

    // GitHub tags start with v, remove it
    version = version.replace(/^v/, '')

    return version
}

function getDesiredFileExts(): [string, boolean, string] {
    let fileExt1: string
    let hasFileExt2: boolean
    let fileExt2: string

    if (osPlat == 'win32') {
        fileExt1 = 'tar.gz'
        hasFileExt2 = true
        fileExt2 = 'exe'
    } else if (osPlat == 'darwin') {
        fileExt1 = 'tar.gz'
        hasFileExt2 = true
        fileExt2 = 'dmg'
    } else if (osPlat === 'linux') {
        fileExt1 = 'tar.gz'
        hasFileExt2 = false
        fileExt2 = ''
    } else {
        throw new Error(`Platform ${osPlat} is not supported`)
    }

    return [fileExt1, hasFileExt2, fileExt2]
}

function getNightlyFileName(arch: string): string {
    let versionExt: string
    let fileExt1: string
    [fileExt1, , ] = getDesiredFileExts()

    if (osPlat == 'win32') {
        versionExt = arch == 'x64' ? '-win64' : '-win32'
    } else if (osPlat == 'darwin') {
        if (arch == 'x86') {
            throw new Error('32-bit Julia is not available on macOS')
        }
        versionExt = '-mac64'
    } else if (osPlat === 'linux') {
        versionExt = arch == 'x64' ? '-linux64' : '-linux32'
    } else {
        throw new Error(`Platform ${osPlat} is not supported`)
    }

    return `julia-latest${versionExt}.${fileExt1}`
}

export function getFileInfo(versionInfo, version: string, arch: string) {
    const err = `Could not find ${archMap[arch]}/${version} binaries`

    let fileExt1: string
    let hasFileExt2: boolean
    let fileExt2: string
    [fileExt1, hasFileExt2, fileExt2] = getDesiredFileExts()

    if (version.endsWith('nightly')) {
        return null
    }

    if (!versionInfo[version]) {
       throw err
    }

    for (let file of versionInfo[version].files) {
        if (file.os == osMap[osPlat] && file.arch == archMap[arch]) {
            if (file.extension == fileExt1) {
                return file
            }
        }
    }

    if (hasFileExt2) {
        core.debug(`Could not find ${fileExt1}; trying to find ${fileExt2} instead`)
        for (let file of versionInfo[version].files) {
            if (file.os == osMap[osPlat] && file.arch == archMap[arch]) {
                if (file.extension == fileExt2) {
                    return file
                }
            }
        }
    }

    throw err
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

    // Verify that fileInfo.url points at the official Julia download servers
    if (!fileInfo.url.startsWith('https://julialang-s3.julialang.org/')) {
        throw new Error(`versions.json points at a download location outside of Julia's download server: ${fileInfo.url}. Aborting for security reasons.`)
    }
    return fileInfo.url
}

export async function installJulia(dest: string, versionInfo, version: string, arch: string): Promise<string> {
    // Download Julia
    const fileInfo = getFileInfo(versionInfo, version, arch)
    const downloadURL = getDownloadURL(fileInfo, version, arch)
    core.debug(`downloading Julia from ${downloadURL}`)

    // Occasionally the connection is reset for unknown reasons
    // In those cases, retry the download
    const juliaDownloadPath = await retry(async (bail: Function) => {
        return await tc.downloadTool(downloadURL)
    }, {
        retries: 5,
        onRetry: (err: Error) => {
            core.info(`Download of ${downloadURL} failed, trying again. Error: ${err}`)
        }
    })

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

    // Install it
    switch (osPlat) {
        case 'linux':
            // tc.extractTar doesn't support stripping components, so we have to call tar manually
            await exec.exec('tar', ['xf', juliaDownloadPath, '--strip-components=1', '-C', dest])
            return dest
        case 'win32':
            if (fileInfo !== null && fileInfo.extension == 'exe') {
                if (version.endsWith('nightly') || semver.gtr(version, '1.3', {includePrerelease: true})) {
                    // The installer changed in 1.4: https://github.com/JuliaLang/julia/blob/ef0c9108b12f3ae177c51037934351ffa703b0b5/NEWS.md#build-system-changes
                    await exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/SILENT /dir=${path.join(process.cwd(), dest)}" -NoNewWindow -Wait`])
                } else {
                    await exec.exec('powershell', ['-Command', `Start-Process -FilePath ${juliaDownloadPath} -ArgumentList "/S /D=${path.join(process.cwd(), dest)}" -NoNewWindow -Wait`])
                }
            } else {
                // This is the more common path. Using .tar.gz is much faster
                await exec.exec('powershell', ['-Command', `tar xf ${juliaDownloadPath} --strip-components=1 -C ${dest}`])
            }
            return dest
        case 'darwin':
            if (fileInfo !== null && fileInfo.extension == 'dmg') {
                core.debug(`Support for .dmg files is deprecated and may be removed in a future release`)
                await exec.exec('hdiutil', ['attach', juliaDownloadPath])
                await exec.exec('/bin/bash', ['-c', `cp -a /Volumes/Julia-*/Julia-*.app/Contents/Resources/julia ${dest}`])
                return path.join(dest, 'julia')
            } else {
                // tc.extractTar doesn't support stripping components, so we have to call tar manually
                await exec.exec('tar', ['xf', juliaDownloadPath, '--strip-components=1', '-C', dest])
                return dest
            }
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
