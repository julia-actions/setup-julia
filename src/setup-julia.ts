import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

import * as fs from 'fs'
import * as https from 'https'
import * as path from 'path'

import * as installer from './installer'

const archSynonyms = {
    'x86': 'x86',
    'X86': 'x86',
    'x64': 'x64',
    'X64': 'x64',
    'aarch64': 'aarch64',
    'ARM64': 'aarch64',
    'arm64': 'aarch64'
}

async function run() {
    try {
        // Debugging info
        if (core.isDebug()) {
            // Log Runner IP Address
            https.get('https://httpbin.julialang.org/ip', resp => {
                let data = ''

                resp.on('data', chunk => {
                    data += chunk
                })

                resp.on('end', () => {
                    core.debug(`Runner IP address: ${JSON.parse(data).origin}`)
                })
            }).on('error', err => {
                core.debug(`ERROR: Could not retrieve runner IP: ${err}`)
            })
        }

        // Inputs
        const versionInput = core.getInput('version')
        const includePrereleases = core.getInput('include-all-prereleases') == 'true'
        const originalArchInput = core.getInput('arch')

        // It can easily happen that, for example, a workflow file contains an input `version: ${{ matrix.julia-version }}`
        // while the strategy matrix only contains a key `${{ matrix.version }}`.
        // In that case, we want the action to fail, rather than trying to download julia from an URL that's missing parts and 404ing.
        // We _could_ fall back to the default but that means that builds silently do things differently than they're meant to, which
        // is worse than failing the build.
        if (!versionInput) {
            throw new Error('Version input must not be null')
        }
        if (!originalArchInput) {
            throw new Error(`Arch input must not be null`)
        }

        const arch = archSynonyms[originalArchInput]

        const versionInfo = await installer.getJuliaVersionInfo()
        const availableReleases = await installer.getJuliaVersions(versionInfo)
        const version = installer.getJuliaVersion(availableReleases, versionInput, includePrereleases)
        core.debug(`selected Julia version: ${arch}/${version}`)
        core.setOutput('julia-version', version)

        // Search in cache
        let juliaPath: string;
        juliaPath = tc.find('julia', version, arch)

        if (!juliaPath) {
            core.debug(`could not find Julia ${arch}/${version} in cache`)

            // we want julia to be installed with unmodified file mtimes
            // but tc.cacheDir uses `cp` which destroys mtime
            // and `tc` provides no API to get the tool directory alone
            // so hack it by installing a dummy julia file then use the path it returns
            // and extract the archives directly to that location
            const tempDummyDir = fs.mkdtempSync('julia-dummy-')
            juliaPath = await tc.cacheDir(tempDummyDir, 'julia', version, arch)
            await installer.installJulia(juliaPath, versionInfo, version, arch)

            core.debug(`added Julia to cache: ${juliaPath}`)

            // Remove temporary dummy dir
            fs.rmSync(tempDummyDir, {recursive: true})
        } else {
            core.debug(`using cached version of Julia: ${juliaPath}`)
        }

        // Add it to PATH
        core.addPath(path.join(juliaPath, 'bin'))

        // Set output
        core.setOutput('julia-bindir', path.join(juliaPath, 'bin'))

        // Test if Julia has been installed and print the version
        const showVersionInfoInput = core.getInput('show-versioninfo')
        await installer.showVersionInfo(showVersionInfoInput, version)
    } catch (error) {
        core.setFailed((error as Error).message)
    }
}

run()
