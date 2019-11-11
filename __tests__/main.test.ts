import * as installer from '../src/installer'

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
})
