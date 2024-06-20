# Making a new release of this action (requires commit access)

If you have commit access to this repo, you can make a new release.

Here are the instructions.

## Step 1: Clone a fresh copy of the repo

We intentionally work in a brand-new copy of the repo.

```bash
git clone git@github.com:julia-actions/setup-julia.git
cd setup-julia
git checkout master
git submodule init
git submodule update
```

## Step 2: Make sure you have the right version of NodeJS

If you use [`asdf`](https://asdf-vm.com/), this is as simple as:

```bash
asdf plugin add nodejs
asdf install
```

If you don't use `asdf`, then you need to:
1. Open the `./tool-versions` file in the root of the repo.
2. Make note of the NodeJS version listed in the `.tool-versions` file.
3. Install that same version of NodeJS on your machine.
4. Make sure that you are currently using that version of NodeJS (i.e. it is at the front of your PATH).

## Step 3: Edit the `version` field in `package.json`

```bash
vim package.json

# Edit the `version` number (should be line 2)
# Save your changes in Vim. Then exit Vim.

# For the remaining of this guide, let MAJOR.MINOR.PATCH refer
# to the new version number that you set.

git add package.json
git commit -m "Bump version number to MAJOR.MINOR.PATCH"
```

## Step 4: Remove the `dist/` line from the `.gitignore` file

```bash
vim .gitignore
# Delete the line that says `dist/` (it should be line 3)
# Save your changes in Vim. Then exit Vim.

git add .gitignore
git commit -m "Remove the dist/ line from the gitignore file"
```

## Step 5: Make sure you have the necessary dependencies

The `build-release.sh` script requires the following dependencies:

1. Bash
2. `curl`
3. `git`
4. `jq`
5. `sed`

## Step 6: Run the `build-release.sh` script

```bash
ls -l bin/build-release.sh
chmod +x bin/build-release.sh
ls -l bin/build-release.sh

./bin/build-release.sh julia-actions/setup-julia
```

Wait a minute or two. The script will build everything and will create a new release branch named `releases/vMAJOR.MINOR.PATCH`.

## Step 7: Push ONLY the `releases/vMAJOR.MINOR.PATCH` branch

Only push the `releases/` branch. Do NOT push any tags yet.

```bash
git push origin releases/vMAJOR.MINOR.PATCH
```

Now you need to go to https://github.com/julia-actions/setup-julia/tree/releases/vMAJOR.MINOR.PATCH and wait for CI to finish running.

Do NOT proceed to the next step until CI is all green on the `releases/vMAJOR.MINOR.PATCH` branch.

## Step 8: Push the tags (only after CI is all green)

Once CI is all green on the `releases/vMAJOR.MINOR.PATCH` branch, you can push the tags.

You need to force-push.

```bash
git push --tags --force
```

## Step 9: Use the GitHub web UI to create a new GitHub Release

Go to https://github.com/julia-actions/setup-julia/releases  and create a new release for the now-existant `vMAJOR.MINOR.PATCH` tag using the GitHub web interface.

## Step 10: Clean up your local repo

```bash
git submodule deinit --force .
git submodule update --init
git fetch --all --prune
git checkout master
git reset --hard origin/master
```

## Step 11: Delete your local repo

```bash
cd ..
ls setup-julia
rm -rf setup-julia
```
