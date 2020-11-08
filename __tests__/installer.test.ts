// The testing setup has been derived from the actions/setup-go@bc6edb5 action.
// Check README.md for licence information.

import * as path from 'path'

import * as io from '@actions/io'

import nock = require('nock')
import * as semver from 'semver'

const testVersions = [
    '0.1.2',       '0.2.0',           '0.2.1',          '0.3.0',
    '0.3.1',       '0.3.10',          '0.3.11',         '0.3.12',
    '0.3.2',       '0.3.3',           '0.3.4',          '0.3.5',
    '0.3.6',       '0.3.7',           '0.3.8',          '0.3.9',
    '0.4.0',       '0.4.0-rc1',       '0.4.0-rc2',      '0.4.0-rc3',
    '0.4.0-rc4',   '0.4.1',           '0.4.2',          '0.4.3',
    '0.4.4',       '0.4.5',           '0.4.6',          '0.4.7',
    '0.5.0',       '0.5.0-rc0',       '0.5.0-rc1',      '0.5.0-rc2',
    '0.5.0-rc3',   '0.5.0-rc4',       '0.5.1',          '0.5.2',
    '0.6.0',       '0.6.0-pre.alpha', '0.6.0-pre.beta', '0.6.0-rc1',
    '0.6.0-rc2',   '0.6.0-rc3',       '0.6.1',          '0.6.2',
    '0.6.3',       '0.6.4',           '0.7.0',          '0.7.0-alpha',
    '0.7.0-beta',  '0.7.0-beta2',     '0.7.0-rc1',      '0.7.0-rc2',
    '0.7.0-rc3',   '1.0.0',           '1.0.0-rc1',      '1.0.1',
    '1.0.2',       '1.0.3',           '1.0.4',          '1.0.5',
    '1.1.0',       '1.1.0-rc1',       '1.1.0-rc2',      '1.1.1',
    '1.2.0',       '1.2.0-rc1',       '1.2.0-rc2',      '1.2.0-rc3',
    '1.3.0-alpha', '1.3.0-rc1',       '1.3.0-rc2',      '1.3.0-rc3',
    '1.3.0-rc4'
]

const toolDir = path.join(__dirname, 'runner', 'tools')
const tempDir = path.join(__dirname, 'runner', 'temp')
const fixtureDir = path.join(__dirname, 'fixtures')

process.env['RUNNER_TOOL_CACHE'] = toolDir
process.env['RUNNER_TEMP'] = tempDir

import * as installer from '../src/installer'

describe('version matching tests', () => {
    describe('specific versions', () => {
        it('Doesn\'t change the version when given a valid semver version', () => {
            expect(installer.getJuliaVersion([], '1.0.5')).toEqual('1.0.5')
            expect(installer.getJuliaVersion(['v1.0.5', 'v1.0.6'], '1.0.5')).toEqual('1.0.5')
            expect(installer.getJuliaVersion(['v1.0.4', 'v1.0.5'], '1.0.5')).toEqual('1.0.5')
            expect(installer.getJuliaVersion(['v1.0.4'], '1.0.5')).toEqual('1.0.5')
            expect(installer.getJuliaVersion([], '1.3.0-alpha')).toEqual('1.3.0-alpha')
            expect(installer.getJuliaVersion(['v1.2.0', 'v1.3.0-alpha', 'v1.3.0-rc1', 'v1.3.0'], '1.3.0-alpha')).toEqual('1.3.0-alpha')
            expect(installer.getJuliaVersion([], '1.3.0-rc2')).toEqual('1.3.0-rc2')
        })

        it('Doesn\'t change the version when given `nightly`', () => {
            expect(installer.getJuliaVersion([], 'nightly')).toEqual('nightly')
            expect(installer.getJuliaVersion(testVersions, 'nightly')).toEqual('nightly')
        })
    })

    describe('version ranges', () => {
        it('Chooses the highest available version that matches the input', () => {
            expect(installer.getJuliaVersion(testVersions, '1')).toEqual('1.2.0')
            expect(installer.getJuliaVersion(testVersions, '1.0')).toEqual('1.0.5')
            expect(installer.getJuliaVersion(testVersions, '^1.3.0-rc1')).toEqual('1.3.0-rc4')
            expect(installer.getJuliaVersion(testVersions, '^1.2.0-rc1')).toEqual('1.2.0')
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

describe('installer tests', () => {
    beforeAll(async () => {
        await io.rmRF(toolDir)
        await io.rmRF(tempDir)
    }, 100000)

    afterAll(async () => {
        try {
            await io.rmRF(toolDir)
            await io.rmRF(tempDir)
        } catch {
            console.log('Failed to remove test directories')
        }
    }, 100000)

    describe('versions.json parsing', () => {
        // Instead of downloading versions.json, use fixtures/versions.json
        beforeEach(() => {
            nock('https://julialang-s3.julialang.org').persist()
                .get('/bin/versions.json')
                .replyWithFile(200, path.join(fixtureDir, 'versions.json'))
        })

        afterEach(() => {
            nock.cleanAll()
            nock.enableNetConnect()
        })

        it('Extracts the list of available versions', async () => {
            expect(await (await installer.getJuliaVersions(await installer.getJuliaVersionInfo())).sort()).toEqual(testVersions.sort())
        })
    })

    describe('checksum matching', () => {
        let versionInfo

        beforeAll(async () => {
            versionInfo = await installer.getJuliaVersionInfo()
        })

        beforeEach(() => {
            nock('https://julialang-s3.julialang.org').persist()
                .get(uri => !(uri.includes('versions.json'))) // Mock all requests to binaries
                .reply(200, 'Malformed binary.')
                
            nock('https://julialang-s3.julialang.org').persist()
                .get('/bin/versions.json')
                .replyWithFile(200, path.join(fixtureDir, 'versions.json'))
        })

        afterEach(() => {
            nock.cleanAll()
            nock.enableNetConnect()
        })
        
        it('Throws an error if the checksum of the downloaded file doesn\'t match the expected checksum', () => {
            expect(installer.installJulia(versionInfo, '1.1.0', 'x64')).toThrowError(/^(Checksum of downloaded file does not match the expected checksum from versions\.json\.).*/)
        })
    })
})
