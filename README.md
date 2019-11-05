# setup-julia Action

This action sets up a Julia environment for use in actions by downloading a specified version of Julia and adding it to PATH.

## Table of Contents
- [Table of Contents](#table-of-contents)
- [Usage](#usage)
- [Versioning](#versioning)
- [Future plans & ideas](#future-plans--ideas)
- [Words of caution](#words-of-caution)
- [Licence info](#licence-info)

## Usage

See [action.yml](action.yml).

You can find a list of example workflows making use of this action here: [julia-actions/example-workflows](https://github.com/julia-actions/example-workflows).

### Basic:

```yaml
steps:
- uses: actions/checkout@v1.0.0
- uses: julia-actions/setup-julia@v0.2
  with:
    version: 1.0.4
- run: julia -e 'println("Hello, World!")'
```

### Matrix Testing:

#### 64-bit Julia only

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        julia-version: [1.0.4, 1.1.1, 1.2.0-rc3, 1.3.0-alpha]
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
        julia-version: [1.0.4, 1.1.1, 1.2.0-rc3, 1.3.0-alpha]
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
        julia-version: [1.0.4, 1.1.1, 1.2.0-rc3, 1.3.0-alpha]
        os: [ubuntu-latest, windows-latest, macOS-latest]
        # Additionally create a job using 32-bit Julia 1.0.4 on windows-latest
        include:
          - os: windows-latest
            julia-version: [1.0.4]
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

### `setup-julia`:
* Check if a cached version of Julia is available instead of installing it everytime CI runs.
* Add version shortcuts like `1.x`, `1.1.x`, `latest` and `lts`.
* Add support for nightly Julia builds.
* Write some unit tests for the action.
* Add CI script that checks if tags have been updated on release.
* Hash and signature checks.

### Other Julia-related actions:

These would be nice to have but I make no promises of ever creating them myself.

* Default build script for packages, similar to how Travis CI works if you don't specify a script.
* Find out if it's possible to cache packages using [`@actions/tool-cache`](https://github.com/actions/toolkit/tree/master/packages/tool-cache).
* Actions for standard tools like Documenter, Coverage reporting and so on
* Actions for registering and tagging package releases instead of relying on external apps.

## Words of caution

This action will likely be updated quite frequently in the near future. I'm sharing it now so that others who want to try out Julia on GitHub actions can do so without relying on Docker.

**DO NOT USE THIS AS YOUR ONLY FORM OF CI** (yet).

Unfortunately, because non-container actions must use JavaScript/TypeScript as scripting language, `npm` is involved. The published action only uses the toolkit-dependencies maintained by GitHub but, as usual with `npm`, these load over 50 transitive dependencies. If this causes issues with your security policies, you might want to fork the action, so that you can audit and lock exact versions of all direct and transitive dependencies.

## Licence info
Parts of this software have been derived from the `setup-go` [action](https://github.com/actions/setup-go) and the [TypeScript Action Template](https://github.com/actions/typescript-action), both released by GitHub under the MIT licence.
