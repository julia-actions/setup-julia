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
import exp from 'constants'

describe("getProjectFile tests", () => {
    it("Can determine project file is missing", () => {
        expect(() => installer.getProjectFile("DNE.toml")).toThrow("Unable to locate project file")
        expect(() => installer.getProjectFile(fixtureDir)).toThrow("Unable to locate project file")
    })

    it('Can determine project file from a directory', () => {
        expect(installer.getProjectFile(path.join(fixtureDir, "PkgA"))).toEqual(path.join(fixtureDir, "PkgA", "Project.toml"))
        expect(installer.getProjectFile(path.join(fixtureDir, "PkgB"))).toEqual(path.join(fixtureDir, "PkgB", "JuliaProject.toml"))
    })

    it("Prefers using JuliaProject.toml over Project.toml", () => {
        expect(installer.getProjectFile(path.join(fixtureDir, "PkgC"))).toEqual(path.join(fixtureDir, "PkgC", "JuliaProject.toml"))
    })
})

describe("validJuliaRange tests", () => {
    it('X', () => {
        expect(installer.validJuliaRange("1")).toEqual("^1")
        expect(installer.validJuliaRange("1.2")).toEqual("^1.2")
        expect(installer.validJuliaRange("1.2.3")).toEqual("^1.2.3")
        expect(installer.validJuliaRange("^1.2.3")).toEqual("^1.2.3")
        expect(installer.validJuliaRange("~1.2.3")).toEqual("~1.2.3")
        expect(installer.validJuliaRange("=1.2.3")).toEqual("=1.2.3")
        expect(installer.validJuliaRange(">= 1.2.3")).toEqual(">= 1.2.3")
        expect(installer.validJuliaRange("≥ 1.2.3")).toEqual(">= 1.2.3")
        expect(installer.validJuliaRange("< 1.2.3")).toEqual("< 1.2.3")
        expect(installer.validJuliaRange("1.2.3 - 4.5.6")).toEqual("1.2.3 - 4.5.6")

        expect(installer.validJuliaRange("<1 <1")).toBeNull()
        expect(installer.validJuliaRange("< 1 < 1")).toBeNull()
        expect(installer.validJuliaRange("<  1 <  1")).toBeNull()
    })
})

describe("readJuliaCompatVersions tests", () => {
    it('Can determine Julia compat entries', () => {
        const toml = '[compat]\njulia = "1, ^1.1, ~1.2, >=1.3, >= 1.4, <1.5, < 1.6, 1.7 - 1.8"'
        expect(installer.readJuliaCompatVersions(toml)).toEqual(["^1", "^1.1", "~1.2", ">=1.3", ">= 1.4", "<1.5", "< 1.6", "1.7 - 1.8"])
    })

    it('Handle surrounding whitespace', () => {
        const toml = '[compat]\njulia = " 1,2 , 3 ,"'
        expect(installer.readJuliaCompatVersions(toml)).toEqual(["^1", "^2", "^3"])
    })

    it('Throws with whitespace separated version ranges', () => {
        var toml = '[compat]\njulia = "1 2 3"'
        expect(() => installer.readJuliaCompatVersions(toml)).toThrow("Invalid version range")

        // TODO: Ideally would fail. Invalid in Julia
        toml = '[compat]\njulia = "1- 2"'
        expect(installer.readJuliaCompatVersions(toml)).toThrow("1- 2")
    })

    it('Handles default caret specifier', () => {
        var toml = '[compat]\njulia = "1"'
        expect(installer.readJuliaCompatVersions(toml)).toEqual(["^1"])

        // Pkg.jl currently does not support pre-release entries in compat but NPM's semver does so
        // we'll test them here.
        toml = '[compat]\njulia = "1.2.3-rc1"'
        expect(installer.readJuliaCompatVersions(toml)).toEqual(["^1.2.3-rc1"])
    })

    it('Handles hypen ranges', () => {
        var toml = '[compat]\njulia = "1.2.3 - 4.5.6"'
        expect(installer.readJuliaCompatVersions(toml)).toEqual(["1.2.3 - 4.5.6"])

        toml = '[compat]\njulia = "1.2.3-rc1 - 4.5.6"'
        expect(installer.readJuliaCompatVersions(toml)).toEqual(["1.2.3-rc1 - 4.5.6"])

        // A version number and not a hypen range
        toml = '[compat]\njulia = "1.2.3-rc1-4.5.6"'
        expect(installer.readJuliaCompatVersions(toml)).toEqual(["^1.2.3-rc1-4.5.6"])

        toml = '[compat]\njulia = "1.2.3-rc1 -4.5.6"'
        expect(() => installer.readJuliaCompatVersions(toml)).toThrow("Invalid version range")

        // A whitespace separated version range
        toml = '[compat]\njulia = "1.2.3-rc1- 4.5.6"'
        expect(() => installer.readJuliaCompatVersions(toml)).toThrow("Invalid version range")
    })

    it('Handle missing compat entries', () => {
        expect(installer.readJuliaCompatVersions("")).toEqual([])
        expect(installer.readJuliaCompatVersions("[compat]")).toEqual([])
        expect(installer.readJuliaCompatVersions("[compat]\njulia = \"\"")).toEqual([])
    })
})

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

    describe('include-prereleases', () => {
        it('Chooses the highest available version that matches the input including prereleases', () => {
            expect(installer.getJuliaVersion(testVersions, '^1.2.0-0', true)).toEqual('1.3.0-rc4')
            expect(installer.getJuliaVersion(testVersions, '1', true)).toEqual('1.3.0-rc4')
            expect(installer.getJuliaVersion(testVersions, '^1.2.0-0', false)).toEqual('1.2.0')
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

    describe('julia compat versions', () => {
        it('Understands MIN', () => {
            let versions = ["1.6.7", "1.7.1-rc1", "1.7.1-rc2", "1.7.1", "1.7.2", "1.8.0"]
            expect(installer.getJuliaVersion(versions, "MIN", false, ["^1.7"])).toEqual("1.7.1")
            expect(installer.getJuliaVersion(versions, "MIN", true, ["^1.7"])).toEqual("1.7.1-rc1")

            versions = ["1.6.7", "1.7.3-rc1", "1.7.3-rc2", "1.8.0"]
            expect(installer.getJuliaVersion(versions, "MIN", false, ["^1.7"])).toEqual("1.8.0")
            expect(installer.getJuliaVersion(versions, "MIN", true, ["^1.7"])).toEqual("1.7.3-rc1")

            expect(installer.getJuliaVersion(versions, "MIN", false, ["~1.7", "~1.8", "~1.9"])).toEqual("1.8.0")
            expect(installer.getJuliaVersion(versions, "MIN", true, ["~1.7", "~1.8", "~1.9"])).toEqual("1.7.3-rc1")
            expect(installer.getJuliaVersion(versions, "MIN", false, ["~1.8", "~1.7", "~1.9"])).toEqual("1.8.0")
            expect(installer.getJuliaVersion(versions, "MIN", true, ["~1.8", "~1.7", "~1.9"])).toEqual("1.7.3-rc1")

            expect(installer.getJuliaVersion(versions, "MIN", false, ["1.7 - 1.9"])).toEqual("1.8.0")
            expect(installer.getJuliaVersion(versions, "MIN", true, ["1.7 - 1.9"])).toEqual("1.7.3-rc1")

            expect(installer.getJuliaVersion(versions, "MIN", true, ["< 1.9.0"])).toEqual("1.6.7")
            expect(installer.getJuliaVersion(versions, "MIN", true, [">= 1.6.0"])).toEqual("1.6.7")

            // NPM's semver package treats "1.7" as "~1.7" instead of "^1.7" like Julia
            expect(() => installer.getJuliaVersion(versions, "MIN", false, ["1.7"])).toThrow("Could not find a Julia version that matches")

            expect(() => installer.getJuliaVersion(versions, "MIN", true, [])).toThrow("Julia project file does not specify a compat for Julia")
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
})
