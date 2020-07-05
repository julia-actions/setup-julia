import * as installer from '../src/installer'

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
        describe('invalid version range (#38)', () => {
            it('Throws an error if a version range does not match any available version', () => {
                expect(() => {
                    installer.getJuliaVersion(['v1.5.0-rc1', 'v1.5.0-beta1', 'v1.4.2', 'v1.4.1', 'v1.4.0', 'v1.4.0-rc2', 'v1.4.0-rc1'], '1.6')
                }).toThrowError()
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
