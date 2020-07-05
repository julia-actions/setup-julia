# Dev docs / Contributing guide

## Building and tagging a release (requires write access)

1. Test your changes, merge into `master`.
2. Checkout `master`.
3. Bump the version number in [`package.json`](package.json).
4. Run `./bin/build-release julia-actions/setup-julia` to create a release branch and build a release.
5. Push the branch (**without tags**) and verify that CI is passing on it.
6. Run `git push --tags --force` to update the tags.
7. Create a release for the `vX.Y.Z` tag.
