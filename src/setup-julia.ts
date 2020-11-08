import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

import * as fs from 'fs'
import * as https from 'https'
import * as path from 'path'

import * as installer from './installer'

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
        const arch = core.getInput('arch')

        // It can easily happen that, for example, a workflow file contains an input `version: ${{ matrix.julia-version }}`
        // while the strategy matrix only contains a key `${{ matrix.version }}`.
        // In that case, we want the action to fail, rather than trying to download julia from an URL that's missing parts and 404ing.
        // We _could_ fall back to the default but that means that builds silently do things differently than they're meant to, which
        // is worse than failing the build.
        if (!versionInput) {
            throw new Error('Version input must not be null')
        }
        if (!arch) {
            throw new Error(`Arch input must not be null`)
        }

        const versionInfo = await installer.getJuliaVersionInfo()
        const availableReleases = await installer.getJuliaVersions(versionInfo)
        const version = installer.getJuliaVersion(availableReleases, versionInput)
        core.debug(`selected Julia version: ${arch}/${version}`)

        // Search in cache
        let juliaPath: string;
        juliaPath = tc.find('julia', version, arch)

        if (!juliaPath) {
            core.debug(`could not find Julia ${arch}/${version} in cache`)
            const juliaInstallationPath = await installer.installJulia(version, arch)

            // Add it to cache
            juliaPath = await tc.cacheDir(juliaInstallationPath, 'julia', version, arch)
            core.debug(`added Julia to cache: ${juliaPath}`)

            // Remove temporary dir
            fs.rmdirSync(juliaInstallationPath, {recursive: true})
        } else {
            core.debug(`using cached version of Julia: ${juliaPath}`)
        }

        // Add it to PATH
        core.addPath(path.join(juliaPath, 'bin'))

        // Set output
        core.setOutput('julia-bindir', path.join(juliaPath, 'bin'))
        
        // Test if Julia has been installed
        exec.exec('julia', ['--version'])

        // If enabled, also show the full version info
        if (core.getInput('show-versioninfo') == 'true') {
            exec.exec('julia', ['-e', 'using InteractiveUtils; versioninfo()'])
        }
    } catch (error) {
        core.setFailed(error.message)
    }
}

run()
