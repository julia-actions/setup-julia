# setup-julia Action

[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=julia-actions/setup-julia)](https://dependabot.com)

This action sets up a Julia environment for use in actions by downloading a specified version of Julia and adding it to PATH.

## Table of Contents
- [Table of Contents](#table-of-contents)
- [Usage](#usage)
  - [Basic](#basic)
  - [Julia Versions](#julia-versions)
  - [Matrix Testing](#matrix-testing)
- [Versioning](#versioning)
- [Privacy Info](#privacy-info)
- [Third party information](#third-party-information)

## Usage

See [action.yml](action.yml).

You can find a list of example workflows making use of this action here: [julia-actions/example-workflows](https://github.com/julia-actions/example-workflows).

### Basic

```yaml
steps:
- uses: actions/checkout@v1.0.0
- uses: julia-actions/setup-julia@v1
  with:
    version: 1.0.4
- run: julia -e 'println("Hello, World!")'
```

### Julia Versions

You can either specify specific Julia versions or version ranges. If you specify a version range, the **highest** available Julia version that matches the range will be selected.

**Warning:** It is strongly recommended to wrap versions in quotes. Otherwise, the YAML parser used by GitHub Actions parses certain versions as numbers which causes the wrong version to be selected. For example, `1.0` is parsed as `1`.

#### Examples

- `1.2.0` is a valid semver version. The action will try to download exactly this version. If it's not available, the build step will fail.
- `1.0` is a version range that will match the highest available Julia version that starts with `1.0`, e.g. `1.0.5`.
- `^1.3.0-rc1` is a caret version range that includes pre-releases starting at `rc1`. It matches all versions `≥ 1.3.0-rc1` and `< 1.4.0`.
- `^1.3-0` is a caret version range that includes _all_ pre-releases. It matches all versions `≥ 1.3.0-` and `< 1.4.0`.
- `nightly` will install the latest nightly build.

Internally the action uses node's semver package to resolve version ranges. Its [documentation](https://github.com/npm/node-semver#advanced-range-syntax) contains more details on the version range syntax. You can test what version will be selected for a given input in this JavaScript [REPL](https://repl.it/@SaschaMann/setup-julia-version-logic).

#### WARNING: Version ranges are experimental and potentially out of date

Currently the list of available versions is hardcoded. You have to use the latest version of the action to be able to install the latest Julia versions. Once available we will use a list of versions provided on julialang.org.

### Matrix Testing

`bash` is chosen as shell to enforce consistent behaviour across operating systems. [Other shells](https://help.github.com/en/actions/reference/workflow-syntax-for-github-actions#using-a-specific-shell) are available but you may have to escape quotation marks or otherwise adjust the syntax.

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
        uses: julia-actions/setup-julia@v1
        with:
          version: ${{ matrix.julia-version }}
      - run: julia -e 'println("Hello, World!")'
        shell: bash
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
        uses: julia-actions/setup-julia@v1
        with:
          version: ${{ matrix.julia-version }}
          arch: ${{ matrix.julia-arch }}
      - run: julia -e 'println("Hello, World!")'
        shell: bash
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
        uses: julia-actions/setup-julia@v1
        with:
          version: ${{ matrix.julia-version }}
      - run: julia -e 'println("Hello, World!")'
        shell: bash
```

## Versioning

This action follows [GitHub's advice](https://help.github.com/en/articles/about-actions#versioning-your-action) on versioning actions, with an additional `latest` tag.

If you don't want to deal with updating the version of the action, similiarly to how Travis CI handles it, use `latest` or major version branches. [Dependabot](https://dependabot.com/) can also be used to automatically create Pull Requests to update actions used in your workflows.

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

## Privacy Info

Julia version 1.5 and later collects telemetry information during certain `Pkg` operations.
Please refer to <https://julialang.org/legal/data/> for details on the data that is being collected.

You can opt out of all Pkg telemetry in the action environment by setting the input `pkg-telemetry: 'false'`, which will create a file `~/.julia/servers/telemetry.toml` with the content `telemetry = false`:

```yaml
      - name: "Set up Julia"
        uses: julia-actions/setup-julia@v1
        with:
          pkg-telemetry: 'false' # Always opt-out of Pkg telemetry
```

The action defaults to opting out of Pkg telemetry in private repositories or scheduled workflows.
This can be overriden by setting the input `pkg-telemetry: 'true'`.

```yaml
      - name: "Set up Julia"
        uses: julia-actions/setup-julia@v1
        with:
          pkg-telemetry: 'true' # Never opt-out of Pkg telemetry, not even in private repos.
```

You can also add a step to your workflows that edits `telemetry.toml` in the action environment as described in the [Opting Out](https://julialang.org/legal/data/#opting_out) section of the above document.
This may be useful if you want more fine-grained control over the opt-out.

**This action itself does not collect any kind of personal data or telemetry information.**

## Third party information
Parts of this software have been derived from other open source software.
See [THIRD_PARTY_NOTICE.md](THIRD_PARTY_NOTICE.md) for details.
