import * as cache from '@actions/cache'
import * as glob from '@actions/glob'

import * as path from 'path'

// TODO: Change to hashFiles once https://github.com/actions/toolkit/issues/472 has been resolved
import * as md5File from 'md5-file'

const JULIA_HOME = path.join(`${process.env.HOME}`, '.julia')

/**
 * Cache the ~/.julia/artifacts directory.
 */
export async function cacheArtifacts(): Promise<number> {
    const projectFiles = await (await glob.create('**/Project.toml')).glob()
    let projectsHash = ''
    projectFiles.forEach((f) => {
        projectsHash.concat('-', md5File.sync(f))
    })

    const paths = [path.join(JULIA_HOME, 'artifacts')]
    const key = `artifacts-${process.env.RUNNER_OS}-${projectsHash}`

    return cache.saveCache(paths, key)
}
