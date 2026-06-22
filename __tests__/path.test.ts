import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import * as core from '@actions/core'
import * as io from '@actions/io'

jest.mock('@actions/core')
jest.mock('@actions/io')

import {configureJuliaPath} from '../src/path'

const exeName = os.platform() == 'win32' ? 'julia.exe' : 'julia'

// Create a fake Julia install rooted at a fresh temp directory. When `withShare`
// is true it also creates the `share/julia` directory that marks a self-contained
// Julia install (as opposed to e.g. a shared shim directory).
function makeJuliaInstall(withShare: boolean): {root: string; bindir: string; exe: string} {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-julia-test-'))
    const bindir = path.join(root, 'bin')
    fs.mkdirSync(bindir, {recursive: true})
    const exe = path.join(bindir, exeName)
    fs.writeFileSync(exe, '')
    if (withShare) {
        fs.mkdirSync(path.join(root, 'share', 'julia'), {recursive: true})
    }
    return {root, bindir, exe}
}

function exportedValue(name: string): string | undefined {
    const call = (core.exportVariable as jest.Mock).mock.calls.find(c => c[0] === name)
    return call ? (call[1] as string) : undefined
}

describe('configureJuliaPath', () => {
    let createdRoots: string[]
    let originalPath: string | undefined

    beforeEach(() => {
        createdRoots = []
        originalPath = process.env['PATH']
    })

    afterEach(() => {
        if (originalPath === undefined) {
            delete process.env['PATH']
        } else {
            process.env['PATH'] = originalPath
        }
        for (const root of createdRoots) {
            fs.rmSync(root, {recursive: true, force: true})
        }
    })

    function install(withShare: boolean) {
        const result = makeJuliaInstall(withShare)
        createdRoots.push(result.root)
        return result
    }

    it('adds the bindir to PATH and exports JULIA_ACTIONS_JULIA + julia-bindir when no other Julia is present', async () => {
        const ours = install(true)
        ;(io.which as jest.Mock).mockResolvedValue('')

        await configureJuliaPath(ours.root)

        expect(core.addPath).toHaveBeenCalledWith(ours.bindir)
        expect(core.exportVariable).toHaveBeenCalledWith('JULIA_ACTIONS_JULIA', ours.exe)
        expect(core.setOutput).toHaveBeenCalledWith('julia-bindir', ours.bindir)
        // No shadowing Julia, so PATH is not rewritten and no warning is emitted.
        expect(exportedValue('PATH')).toBeUndefined()
        expect(core.warning).not.toHaveBeenCalled()
    })

    it('removes a shadowing dedicated Julia install from PATH for subsequent steps', async () => {
        const ours = install(true)
        const shadow = install(true) // dedicated install (has share/julia)
        const other = install(false) // unrelated dir that must be preserved
        process.env['PATH'] = [shadow.bindir, other.bindir].join(path.delimiter)
        ;(io.which as jest.Mock).mockResolvedValue(shadow.exe)

        await configureJuliaPath(ours.root)

        expect(core.exportVariable).toHaveBeenCalledWith('JULIA_ACTIONS_JULIA', ours.exe)
        const newPath = exportedValue('PATH')
        expect(newPath).toBeDefined()
        const entries = (newPath as string).split(path.delimiter)
        expect(entries).not.toContain(shadow.bindir)
        expect(entries).toContain(other.bindir)
        expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Removed'))
    })

    it('does not strip a shared (non-dedicated) directory from PATH, but still warns', async () => {
        const ours = install(true)
        const shadow = install(false) // looks like a shim dir: no share/julia
        process.env['PATH'] = shadow.bindir
        ;(io.which as jest.Mock).mockResolvedValue(shadow.exe)

        await configureJuliaPath(ours.root)

        expect(exportedValue('PATH')).toBeUndefined()
        expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('does not look like a dedicated Julia install'))
    })

    it('does nothing extra when the only Julia on PATH is the one we installed', async () => {
        const ours = install(true)
        ;(io.which as jest.Mock).mockResolvedValue(ours.exe)

        await configureJuliaPath(ours.root)

        expect(core.exportVariable).toHaveBeenCalledWith('JULIA_ACTIONS_JULIA', ours.exe)
        expect(exportedValue('PATH')).toBeUndefined()
        expect(core.warning).not.toHaveBeenCalled()
    })
})
