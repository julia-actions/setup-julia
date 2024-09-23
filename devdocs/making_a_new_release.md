# Making a new release of this action (requires commit access)

In this guide, as an example, `v2.2.0` refers to the version number of the new release that you want to make.

## Part 1: Use the Git CLI to create and push the Git tags

Step 1: Create a new lightweight tag of the form `vMAJOR.MINOR.PATCH`.

```bash
git clone git@github.com:julia-actions/setup-julia.git
cd setup-julia
git fetch --all --tags

git checkout main

git --no-pager log -1
# Take note of the commit hash here.

# Now, create a new lightweight tag of the form `vMAJOR.MINOR.PATCH`.
#
# Replace `commit_hash` with the commit hash that you obtained from the
# `git log -1` step.
#
# Replace `v2.2.0` with the actual version number that you want to use.
git tag v2.2.0 commit_hash
```

Step 2: Once you've created the new release, you need to update the `v2` tag to point to the new release. For example, suppose that the previous release was `v2.1.0`, and suppose that you just created the new release `v2.2.0`. You need to update the `v2` tag so that it points to `v2.2.0`. Here are the commands:

```bash
# Create/update the new v2 tag locally, where the new v2 tag will point to the
# release that you created in the previous step.
#
# Make sure to change `v2.2.0` to the actual value for the tag that you just
# created in the previous step.
#
# The `-f` flag forcibly overwrites the old
# `v2` tag (if it exists).
git tag -f v2 v2.2.0
```

Step 3: Now you need to push the tags:

```bash
# Regular-push the new `v2.2.0` tag:
git push origin tag v2.2.0

# Force-push the new v2 tag:
git push origin tag v2 --force
```

## Part 2: Create the GitHub Release

Go to the [Releases](https://github.com/julia-actions/setup-julia/releases) section of this repo and create a new release (using the GitHub web interface).

For the "choose a tag" drop-down field, select the `v2.2.0` tag that you created and pushed in Part 1 of this guide.
