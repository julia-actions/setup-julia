# setup-julia Action

[![CodeQL](https://github.com/julia-actions/setup-julia/workflows/CodeQL/badge.svg)](https://securitylab.github.com/tools/codeql)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=julia-actions/setup-julia)](https://dependabot.com)

This action sets up a Julia environment for use in actions by downloading a specified version of Julia and adding it to PATH.

## Table of Contents
- [Table of Contents](#table-of-contents)
- [Usage](#usage)
  - [Inputs](#inputs)
  - [Outputs](#outputs)
  - [Basic](#basic)
  - [Julia Versions](#julia-versions)
  - [Matrix Testing](#matrix-testing)
  - [versioninfo](#versioninfo)
- [Versioning](#versioning)
- [Debug logs](#debug-logs)
- [Third party information](#third-party-information)

## Usage

### Inputs

```yaml
- uses: julia-actions/setup-julia@v1
  with:
    # The Julia version that will be installed and added as `julia` to the PATH.
    # See "Julia Versions" below for a list of valid values.
    #
    # Warning: It is strongly recommended to wrap this value in quotes.
    #          Otherwise, the YAML parser used by GitHub Actions parses certain
    #          versions as numbers which causes the wrong version to be selected.
    #          For example, `1.0` may be parsed as `1`.
    #
    # Default: '1'
    version: ''

    # The architecture of the Julia binaries.
    #
    # Supported values: x64 | x86
    #
    # Default: x64
    arch: ''

    # Set the display setting for printing InteractiveUtils.versioninfo() after installing.
    #
    # Starting Julia and running InteractiveUtils.versioninfo() takes a significant amount of time (1s or ~10% of the total build time in testing),
    # so you may not want to run it in every build, in particular on paid runners, as this cost will add up quickly.
    #
    # See "versioninfo" below for example usage and further explanations.
    #
    # Supported values: true | false | never
    #
    # true: Always print versioninfo
    # false: Only print versioninfo for nightly Julia
    # never: Never print versioninfo
    #
    # Default: false
    show-versioninfo: ''
```

### Outputs

```yaml
outputs:
  # The installed Julia version.
  # May vary from the version input if a version range was given as input.
  #
  # Example output: '1.5.3'

  julia-version: ''
  # Path to the directory containing the Julia executable.
  # Equivalent to JULIA_BINDIR: https://docs.julialang.org/en/v1/manual/environment-variables/#JULIA_BINDIR
  #
  # Example output: '/opt/hostedtoolcache/julia/1.5.3/x64/bin'
  julia-bindir: ''
```

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

**Warning:** It is strongly recommended to wrap versions in quotes. Otherwise, the YAML parser used by GitHub Actions parses certain versions as numbers which causes the wrong version to be selected. For example, `1.0` may be parsed as `1`.

#### Examples

- `1.2.0` is a valid semver version. The action will try to download exactly this version. If it's not available, the build step will fail.
- `1.0` is a version range that will match the highest available Julia version that starts with `1.0`, e.g. `1.0.5`, excluding pre-releases.
- `^1.3.0-rc1` is a **caret** version range that includes pre-releases starting at `rc1`. It matches all versions `≥ 1.3.0-rc1` and `< 2.0.0`.
- `~1.3.0-rc1` is a **tilde** version range that includes pre-releases starting at `rc1`. It matches all versions `≥ 1.3.0-rc1` and `< 1.4.0`.
- `^1.3.0-0` is a **caret** version range that includes _all_ pre-releases. It matches all versions `≥ 1.3.0-` and `< 2.0.0`.
- `~1.3.0-0` is a **tilde** version range that includes _all_ pre-releases. It matches all versions `≥ 1.3.0-` and `< 1.4.0`.
- `nightly` will install the latest nightly build.
- `1.6-nightly` will install the latest nightly build for the upcoming 1.6 release. This version will only be available during certain phases of the Julia release cycle.

Internally the action uses node's semver package to resolve version ranges. Its [documentation](https://github.com/npm/node-semver#advanced-range-syntax) contains more details on the version range syntax. You can test what version will be selected for a given input in this JavaScript [REPL](https://repl.it/@SaschaMann/setup-julia-version-logic).

The available Julia versions are pulled from [`versions.json`](https://julialang-s3.julialang.org/bin/versions.json). This file is automatically updated once a day. Therefore it may take up to 24 hours until a newly released Julia version is available in the action.

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

### versioninfo

By default, only the output of `julia --version` is printed as verification that Julia has been installed for stable versions of Julia.
`InteractiveUtils.versioninfo()` is run by default for nightly builds.

Starting Julia and printing the full versioninfo takes a significant amount of time (1s or ~10% of the total build time in testing), so you may not want to run it in every build, in particular on paid runners as this cost will add up quickly.
However, `julia --version` does not provide sufficient information to know which commit a nightly binary was built from, therefore it is useful to show the full versioninfo on nightly builds regardless.

You can override this behaviour by changing the input to `never` if you never want to run `InteractiveUtils.versioninfo()` or to `true` if you always want to run `InteractiveUtils.versioninfo()`, even on stable Julia builds.

## Versioning

This action follows [GitHub's advice](https://help.github.com/en/articles/about-actions#versioning-your-action) on versioning actions, with an additional `latest` tag.

If you don't want to deal with updating the version of the action, similiarly to how Travis CI handles it, use `latest` or major version branches. [Dependabot](https://dependabot.com/) can also be used to automatically create Pull Requests to update actions used in your workflows.

It's unlikely, but not impossible, that there will be breaking changes post-v1.0.0 unless a new major version of Julia is introduced.

You can specify commits, branches or tags in your workflows as follows:

```yaml
steps:
  - uses: julia-actions/setup-julia@d3ce119a16594ea9e5d7974813970c73b6ab9e94 # commit SHA of the tagged 1.4.1 commit
  - uses: julia-actions/setup-julia@latest  # latest version tag (may break existing workflows)
  - uses: julia-actions/setup-julia@v1      # major version tag
  - uses: julia-actions/setup-julia@v1.4    # minor version tag
  - uses: julia-actions/setup-julia@v1.4.1  # specific version tag
```

If your workflow requires access to secrets, you should always pin it to a commit SHA instead of a tag.
This will protect you in case a bad actor gains access to the setup-julia repo.
You can find more information in [GitHub's security hardening guide](https://docs.github.com/en/free-pro-team@latest/actions/learn-github-actions/security-hardening-for-github-actions#using-third-party-actions).

## Debug logs

You can enable [Step Debug Logs](https://github.com/actions/toolkit/blob/main/docs/action-debugging.md#step-debug-logs) for more detailed logs.
Note that when debug logs are enabled, a request will be sent to `https://httpbin.julialang.org/ip` and the runner's IP will be printed to the debug logs.

## Third party information
Parts of this software have been derived from other open source software.
See [THIRD_PARTY_NOTICE.md](THIRD_PARTY_NOTICE.md) for details.
