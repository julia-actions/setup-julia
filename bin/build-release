#!/bin/sh

branch_name="$(git symbolic-ref --short -q HEAD)"
version="v$(jq -r .version package.json)"
repo="$1"

if [ -z "$repo" ]; then
    echo "ERROR: must specify repository"
    exit 1
fi

echo "=== debug info ==="
echo "branch: $branch_name"
echo "version: $version"
echo "repo: $repo"
echo "=================="
echo ""

# Check that the version doesn't exist yet
version_exists="$(curl -s https://api.github.com/repos/"$repo"/tags -H "Accept: application/vnd.github.v3.full+json" | jq -r '.[] | select(.name == "'"$version"'") | .name')"
if [ -n "$version_exists" ]; then
    echo "ERROR: version $version already exists"
    exit 1
fi

git checkout -b releases/"$version"

npm install
npm run build
npm test
npm run pack

sed -i 's/dist/!dist/g' .gitignore
git add dist
git commit -a -m "Add production dependencies & build"

# Tags
major_minor="$(sed 's/\.[^.]*$//' <<< "$version")"
major="$(sed 's/\.[^.]*$//' <<< "$major_minor")"

git tag "$version"
git tag -f "$major_minor"
git tag -f "$major"
git tag -f "latest"
