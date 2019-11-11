# setup-julia Action

This action sets up a Julia environment for use in actions by downloading a specified version of Julia and adding it to PATH.

## Table of Contents
- [Table of Contents](#table-of-contents)
- [Usage](#usage)
  - [Basic](#basic)
  - [Julia Versions](#julia-versions)
  - [Matrix Testing](#matrix-testing)
- [Versioning](#versioning)
- [Future plans & ideas](#future-plans--ideas)
- [Licence info](#licence-info)

## Usage

See [action.yml](action.yml).

Take a look at [github.com/exercism/julia](https://github.com/exercism/julia/pull/153) for an example, non-package Julia project making use of this action.

### Basic

```yaml
steps:
- uses: actions/checkout@v1.0.0
- uses: julia-actions/setup-julia@v0.2
  with:
    version: 1.0.4
- run: julia -e 'println("Hello, World!")'
```

### Julia Versions

You can either specify specific Julia versions or version ranges. If you specify a version range, the **highest** available Julia version that matches the range will be selected.

#### Examples

- `1.2.0` is a valid semver version. The action will try to download exactly this version. If it's not available, the build step will fail.
- `1.0` is a version range that will match the highest available Julia version that starts with `1.0`, e.g. `1.0.5`.
- `^1.3.0-rc1` is a caret version range that includes preleases. It matches all versions `≥ 1.3.0-rc1` and `< 1.4.0`.

Internally the action uses node's semver package to resolve version ranges. Its [documentation](https://github.com/npm/node-semver#advanced-range-syntax) contains more details on the version range syntax.

#### WARNING: Version ranges are experimental and potentially out of date

Currently the list of available versions is hardcoded. You have to use the latest version of the action to be able to install the latest Julia versions. Once available we will use a list of versions provided on julialang.org.

### Matrix Testing

#### 64-bit Julia only

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        julia-version: ['1.0', '1.2.0', '^1.3.0-rc1']
        os: [ubuntu-latest, windows-latest, macOS-latest]
    
    steps:
      - uses: actions/checkout@v1.0.0
      - name: "Set up Julia"
        uses: julia-actions/setup-julia@v0.2
        with:
          version: ${{ matrix.julia-version }}
      - run: julia -e 'println("Hello, World!")'
```

#### 32-bit Julia

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        julia-version: ['1.0', '1.2.0', '^1.3.0-rc1']
        julia-arch: [x64, x86]
        os: [ubuntu-latest, windows-latest, macOS-latest]
        # 32-bit Julia binaries are not available on macOS
        exclude:
          - os: macOS-latest
            julia-arch: x86
    
    steps:
      - uses: actions/checkout@v1.0.0
      - name: "Set up Julia"
        uses: julia-actions/setup-julia@v0.2
        with:
          version: ${{ matrix.julia-version }}
          arch: ${{ matrix.julia-arch }}
      - run: julia -e 'println("Hello, World!")'
```

Alternatively, you can include specific version and OS combinations that will use 32-bit Julia:

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        julia-version: ['1.0', '1.2.0', '^1.3.0-rc1']
        os: [ubuntu-latest, windows-latest, macOS-latest]
        # Additionally create a job using 32-bit Julia 1.0.4 on windows-latest
        include:
          - os: windows-latest
            julia-version: ['1.0.4']
            julia-arch: x86
    
    steps:
      - uses: actions/checkout@v1.0.0
      - name: "Set up Julia"
        uses: julia-actions/setup-julia@v0.2
        with:
          version: ${{ matrix.julia-version }}
      - run: julia -e 'println("Hello, World!")'
```

## Versioning

This action follows [GitHub's advice](https://help.github.com/en/articles/about-actions#versioning-your-action) on versioning actions, with an additional `latest` tag.

If you don't want to deal with updating the version of the action, similiarly to how Travis CI handles it, use `latest` or major version branches.

It's unlikely, but not impossible, that there will be breaking changes post-v1.0.0 unless a new major version of Julia is introduced.

You can specify commits, branches or tags in your workflows as follows:

```yaml
steps:
  - uses: julia-actions/setup-julia@6ae948d # commit SHA
  - uses: julia-actions/setup-julia@master  # branch
  - uses: julia-actions/setup-julia@latest  # latest version tag (may break existing workflows)
  - uses: julia-actions/setup-julia@v1      # major version tag
  - uses: julia-actions/setup-julia@v0.1.0  # specific version tag
```

## Future plans & ideas

In no particular order:

* Check if a cached version of Julia is available instead of installing it everytime CI runs ([waiting on GitHub to add proper caching](https://twitter.com/natfriedman/status/1164210683979812869))
* Add support for nightly Julia builds.
* Write some unit tests for the action.
* Add CI script that checks if tags have been updated on release.
* Hash and signature checks.

## Licence info
Parts of this software have been derived from the `setup-go` [action](https://github.com/actions/setup-go) and the [TypeScript Action Template](https://github.com/actions/typescript-action), both released by GitHub under the MIT licence.
