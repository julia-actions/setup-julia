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

async function getJuliaReleases(): Promise<string[]> {
    // Wrap everything in a Promise so that it can be called with await.
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: '/repos/julialang/julia/releases?per_page=100',
            method: 'GET',
            headers: {
                'Accept': 'application/vnd.github.v3+json', // locks GitHub API version to v3
                'User-Agent': `${process.env.GITHUB_ACTION} Action running in ${process.env.GITHUB_REPOSITORY}`
            }
        }
        
        https.request(options, res => {
            let data = ''

            res.on('data', d => {
                data += d
            })

            res.on('end', () => {
                core.debug(data)
                resolve(JSON.parse(data).map((r) => r.tag_name as string))
            })
        }).on('error', err => {
            reject(new Error(`Error while requesting Julia versions from GitHub:\n${err}`))
        }).end()
    })
}

async function getJuliaVersion(versionInput: string): Promise<string> {
    if (semver.valid(versionInput) == versionInput) {
        // versionInput is a valid version, use it directly
        return versionInput
    }

    // Use the highest available version that matches versionInput
    const releases = await getJuliaReleases()
    let version = semver.maxSatisfying(releases, versionInput)
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

async function installJulia(version: string, arch: string): Promise<string> {
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

async function run() {
    try {
        const versionInput = core.getInput('version')
        const arch = core.getInput('arch')
        const version = await getJuliaVersion(versionInput)
        core.debug(`selected Julia version: ${arch}/${version}`)

        // Search in cache
        let juliaPath: string;
        juliaPath = tc.find('julia', version, arch)

        if (!juliaPath) {
            core.debug(`could not find Julia ${version} in cache`)
            const juliaInstallationPath = await installJulia(version, arch);

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
