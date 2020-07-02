import * as installer from '../src/installer'

import * as exec from '@actions/exec'
import { ExecOptions } from '@actions/exec/lib/interfaces'
import * as io from '@actions/io'

import * as path from 'path'

import * as semver from 'semver'

const testVersions = ['v1.3.0-rc4', 'v1.3.0-rc3', 'v1.3.0-rc2', 'v1.0.5', 'v1.2.0', 'v1.3.0-rc1', 'v1.2.0-rc3', 'v1.3.0-alpha', 'v1.2.0-rc2', 'v1.2.0-rc1', 'v1.1.1', 'v1.0.4', 'v1.1.0', 'v1.1.0-rc2', 'v1.1.0-rc1', 'v1.0.3', 'v1.0.2', 'v1.0.1', 'v1.0.0']

describe('installer tests', () => {
    describe('version matching', () => {
        describe('specific versions', () => {
            it('Doesn\'t change the version when given a valid semver version', async () => {
                expect(await installer.getJuliaVersion([], '1.0.5')).toEqual('1.0.5')
                expect(await installer.getJuliaVersion(['v1.0.5', 'v1.0.6'], '1.0.5')).toEqual('1.0.5')
                expect(await installer.getJuliaVersion(['v1.0.4', 'v1.0.5'], '1.0.5')).toEqual('1.0.5')
                expect(await installer.getJuliaVersion(['v1.0.4'], '1.0.5')).toEqual('1.0.5')
                expect(await installer.getJuliaVersion([], '1.3.0-alpha')).toEqual('1.3.0-alpha')
                expect(await installer.getJuliaVersion(['v1.2.0', 'v1.3.0-alpha', 'v1.3.0-rc1', 'v1.3.0'], '1.3.0-alpha')).toEqual('1.3.0-alpha')
                expect(await installer.getJuliaVersion([], '1.3.0-rc2')).toEqual('1.3.0-rc2')
            })
            it('Doesn\'t change the version when given `nightly`', async () => {
                expect(await installer.getJuliaVersion([], 'nightly')).toEqual('nightly')
                expect(await installer.getJuliaVersion(testVersions, 'nightly')).toEqual('nightly')
            })
        })
        describe('version ranges', () => {
            it('Chooses the highest available version that matches the input', async () => {
                expect(await installer.getJuliaVersion(testVersions, '1')).toEqual('1.2.0')
                expect(await installer.getJuliaVersion(testVersions, '1.0')).toEqual('1.0.5')
                expect(await installer.getJuliaVersion(testVersions, '^1.3.0-rc1')).toEqual('1.3.0-rc4')
                expect(await installer.getJuliaVersion(testVersions, '^1.2.0-rc1')).toEqual('1.2.0')
            })
        })
    })
    describe('node-semver behaviour', () => {
        describe('Windows installer change', () => {
            it('Correctly understands >1.4.0', () => {
                expect(semver.gtr('1.4.0-rc1', '1.3', {includePrerelease: true})).toBeTruthy()
                expect(semver.gtr('1.4.0-DEV', '1.3', {includePrerelease: true})).toBeTruthy()
                expect(semver.gtr('1.3.1', '1.3', {includePrerelease: true})).toBeFalsy()
                expect(semver.gtr('1.3.2-rc1', '1.3', {includePrerelease: true})).toBeFalsy()
            })
        })
    })
})

// describe('telemetry opt-out', () => {
//     // TODO: Julia actually needs to be installed first... & only run if version >= 1.5.0-beta1
//     // For now, only run this as test in CI, but not locally
//     if (process.env.CI) {
//         beforeEach(async () => {
//             await installer.optOutOfPkgTelemetry()
//         })
    
//         afterEach(() => {
//             if (process.env.HOME) {
//                 // This is guaranteed to not be undefined because installer.optOutOfTelemetry() is set in beforeEach and will fail if $HOME is not set
//                 io.rmRF(path.join(process.env.HOME, '.julia', 'servers', 'telemetry.toml'))
//             }
//         })

//         describe('Pkg.telemetryinfo()', async () => {
//             const options: ExecOptions = {}
//             let out = '', err = ''
//             options.listeners = {
//                 stdout: (data: Buffer) => {
//                     out += data.toString()
//                 },
//                 stderr: (data: Buffer) => {
//                     err += data.toString()
//                 }
//             }
//             await exec.exec('julia', ['-e', 'using Pkg; Pkg.telemetryinfo()'])

//             it('Only contains Julia-Pkg-Protocol', () => {
//                 expect(out.startsWith('Julia-Pkg-Protocol')).toBeTruthy()
//                 expect(out.includes('Julia-Version')).toBeFalsy()
//                 expect(out.includes('Julia-System')).toBeFalsy()
//                 expect(out.includes('Julia-Client-UUID')).toBeFalsy()
//                 expect(out.includes('Julia-Project-Hash')).toBeFalsy()
//                 expect(out.includes('Julia-CI-Variables')).toBeFalsy()
//                 expect(out.includes('Julia-HyperLogLog')).toBeFalsy()
//                 expect(out.includes('Julia-Interactive')).toBeFalsy()
//             })
//         })
//     }
// })
