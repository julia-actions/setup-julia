# setup-julia Action

This action sets up a Julia environment for use in actions by download a specified version of Julia and adding it to PATH.

## Usage

See [action.yml](action.yml)

### Basic:

```yaml
steps:
- uses: actions/checkout@v1.0.0
- uses: julia-actions/setup-julia@v0.1.0
  with:
    version: 1.0.4
- run: julia -e 'println("Hello, World!")'
```

### Matrix Testing:

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
        uses: julia-actions/setup-julia@v0.1.0
        with:
          version: ${{ matrix.julia-version }}
      - run: julia -e 'println("Hello, World!")'
```

## Future plans & ideas

In no particular order:

### `setup-julia`:
* Check if a cached version of Julia is available instead of installing it everytime CI runs.
* Add version shortcuts like `1.x`, `1.1.x`, `latest` and `lts`.
* Add support for nightly Julia builds.
* Support 32-bit Julia on 64-bit windows.
* Write some unit tests for the action.
* Figure out the best way to handle versioning.
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

Unfortunately, because non-container actions must use JavaScript/TypeScript as scripting language, `npm` is involved. The dependencies are vendored but this action relies 100% on GitHub to audit the dependencies they add to their action toolkit.

## Licence info
Parts of this software have been derived from the `setup-go` [action](https://github.com/actions/setup-go) and the [JavaScript Action Template](https://github.com/actions/javascript-template), both released by GitHub under the MIT licence.
