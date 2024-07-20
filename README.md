# setup-julia Action

[![CodeQL](https://github.com/julia-actions/setup-julia/workflows/CodeQL/badge.svg)](https://securitylab.github.com/tools/codeql)

This action sets up a Julia environment for use in actions by downloading a specified version of Julia and adding it to PATH.

## Table of Contents
- [setup-julia Action](#setup-julia-action)
  - [Table of Contents](#table-of-contents)
  - [Usage](#usage)
    - [Inputs](#inputs)
    - [Outputs](#outputs)
    - [Basic](#basic)
    - [Julia Versions](#julia-versions)
      - [Examples](#examples)
      - [Prereleases](#prereleases)
      - [Recently released versions](#recently-released-versions)
    - [Matrix Testing](#matrix-testing)
      - [64-bit Julia only](#64-bit-julia-only)
      - [32-bit Julia](#32-bit-julia)
    - [versioninfo](#versioninfo)
  - [Versioning](#versioning)
  - [Using Dependabot version updates to keep your GitHub Actions up to date](#using-dependabot-version-updates-to-keep-your-github-actions-up-to-date)
  - [Debug logs](#debug-logs)
  - [Third party information](#third-party-information)
  - [Contributing to this repo](#contributing-to-this-repo)

## Usage

### Inputs

```yaml
- uses: julia-actions/setup-julia@v2
  with:
    # The Julia version that will be installed and added as `julia` to the PATH.
    # See "Julia Versions" below for a list of valid values.
    #
    # Warning: It is strongly recommended to wrap this value in quotes.
    #          Otherwise, the YAML parser used by GitHub Actions parses certain
    #          versions as numbers which causes the wrong version to be selected.
    #          For example, `1.10` may be parsed as `1.1`.
    #
    # Default: '1'
    version: ''

    # The architecture of the Julia binaries.
    #
    # Please note that installing aarch64 binaries only makes sense on self-hosted aarch64 runners.
    # We currently don't run test builds on that architecture, so we cannot guarantee that the input won't break randomly,
    # although there is no reason why it would.
    #
    # Supported values: x64 | x86 | aarch64 (untested)
    #
    # Note: you can use X64, X86, and ARM64 as synonyms for x64, x86, and aarch64, respectively.
    #
    # Defaults to the architecture of the runner executing the job.
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
- uses: actions/checkout@v4
- uses: julia-actions/setup-julia@v2
  with:
    version: '1.10'
- run: julia -e 'println("Hello, World!")'
```

### Julia Versions

You can either specify specific Julia versions or version ranges. If you specify a version range, the **highest** available Julia version that matches the range will be selected.

> **Warning**
>
> It is strongly recommended to wrap versions in quotes. Otherwise, the YAML parser used by GitHub Actions parses certain versions as numbers which causes the wrong version to be selected. For example, `1.0` may be parsed as `1`.

#### Examples

- `'1.2.0'` is a valid semver version. The action will try to download exactly this version. If it's not available, the build step will fail.
- `'1.0'` is a version range that will match the highest available Julia version that starts with `1.0`, e.g. `1.0.5`, excluding pre-releases.
- `'^1.3.0-rc1'` is a **caret** version range that includes pre-releases of `1.3.0` starting at `rc1`. It matches all versions `≥ 1.3.0-rc1` and `< 2.0.0`.
- `'~1.3.0-rc1'` is a **tilde** version range that includes pre-releases of `1.3.0` starting at `rc1`. It matches all versions `≥ 1.3.0-rc1` and `< 1.4.0`.
- `'^1.3.0-0'` is a **caret** version range that includes _all_ pre-releases of `1.3.0`. It matches all versions `≥ 1.3.0-` and `< 2.0.0`.
- `'~1.3.0-0'` is a **tilde** version range that includes _all_ pre-releases of `1.3.0`. It matches all versions `≥ 1.3.0-` and `< 1.4.0`.
- `'lts'` will install the latest LTS build.
- `'pre'` will install the latest prerelease build (RCs, betas, and alphas).
- `'nightly'` will install the latest nightly build.
- `'1.7-nightly'` will install the latest nightly build for the upcoming 1.7 release. This version will only be available during certain phases of the Julia release cycle.

Internally the action uses node's semver package to resolve version ranges. Its [documentation](https://github.com/npm/node-semver#advanced-range-syntax) contains more details on the version range syntax. You can test what version will be selected for a given input in this JavaScript [REPL](https://repl.it/@SaschaMann/setup-julia-version-logic).

#### Prereleases

There are two methods of including pre-releases in version matching:

1. Including the pre-release tag in the version itself, e.g. `'^1.3.0-rc1'`.
2. Setting the input `include-all-prereleases` to `true`.

These behave slightly differently.

1. If the version `a.b.c` contains pre-release tag, all pre-releases of version `a.b.c` will be included in the version matching.
For example, `^1.3.0-rc1` would match `1.3.0-rc2` but would **not** match `1.4.0-rc1` once released.
2. If `include-preleases` is set to true, **all** pre-releases of all versions will be included in the version matching. In this case, `^1.3.0-rc1` would match `1.4.0-rc1` once released.

**Example:** Without `include-all-prereleases: true`, the version `^1.3.0-rc1` would match `1.3.0-rc1`, `1.3.0-rc2`, `1.3.0`, `1.4.0` once they are released.
With `include-all-prereleases: true`, it would match `1.3.0-rc1`, `1.3.0-rc2`, `1.3.0`, `1.4.0-rc1`, `1.4.0`.

If you want to run tests against the latest tagged version, no matter what version that is, you can use

```yaml
- uses: julia-actions/setup-julia@v2
  with:
    version: '1'
    include-all-prereleases: true
```

#### Recently released versions

The available Julia versions are pulled from [`versions.json`](https://julialang-s3.julialang.org/bin/versions.json).

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
      - uses: actions/checkout@v4
      - name: "Set up Julia"
        uses: julia-actions/setup-julia@v2
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
      - uses: actions/checkout@v4
      - name: "Set up Julia"
        uses: julia-actions/setup-julia@v2
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
      - uses: actions/checkout@v4
      - name: "Set up Julia"
        uses: julia-actions/setup-julia@v2
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

It's unlikely, but not impossible, that there will be breaking changes post-v2.0.0 unless a new major version of Julia is introduced.

You can specify commits, branches or tags in your workflows as follows:

```yaml
steps:
  - uses: julia-actions/setup-julia@f2258781c657ad9b4b88072c5eeaf9ec8c370874 # commit SHA of the tagged 2.0.0 commit
  - uses: julia-actions/setup-julia@latest  # latest version tag (may break existing workflows)
  - uses: julia-actions/setup-julia@v2      # major version tag
  - uses: julia-actions/setup-julia@v2.0    # minor version tag
  - uses: julia-actions/setup-julia@v2.0.0  # specific version tag
```

If your workflow requires access to secrets, you should always pin it to a commit SHA instead of a tag.
This will protect you in case a bad actor gains access to the setup-julia repo.
You can find more information in [GitHub's security hardening guide](https://docs.github.com/en/free-pro-team@latest/actions/learn-github-actions/security-hardening-for-github-actions#using-third-party-actions).

## Using Dependabot version updates to keep your GitHub Actions up to date

We highly recommend that you set up Dependabot version updates on your repo to keep your GitHub Actions up to date.

To set up Dependabot version updates, create a file named `.github/dependabot.yml` in your repo with the following contents:

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
    open-pull-requests-limit: 99
    labels:
      - "dependencies"
      - "github-actions"
```

For more details on Dependabot version updates, see the [GitHub Dependabot documentation](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates).

## Debug logs

You can enable [Step Debug Logs](https://github.com/actions/toolkit/blob/main/docs/action-debugging.md#step-debug-logs) for more detailed logs.
Note that when debug logs are enabled, a request will be sent to `https://httpbin.julialang.org/ip` and the runner's IP will be printed to the debug logs.

## Third party information
Parts of this software have been derived from other open source software.
See [THIRD_PARTY_NOTICE.md](THIRD_PARTY_NOTICE.md) for details.

## Contributing to this repo

Please see the README in the [`devdocs/`](devdocs/) folder.
