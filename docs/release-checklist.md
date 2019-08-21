# Release checklist

Version: `1.b.c`

- [x] Create release branch `releases/v1.b.c`
  - [x] Unignore `node_modules/` by adding `!` in front in `.gitignore`
  - [x] Delete `node_modules/`
  - [x] Install production dependencies: `npm install --production`
  - [x] Add `node_modules/`: `git add node_modules`
  - [x] Commit & push action: `git commit -a -m "Publish v1.b.c."`, then `git push`
- [x] Test the action with an example package
- [x] Create tags
  - [x] `v1.b.c` pointing at the last commit in `releases/v1.b.c`
  - [x] `latest` pointing at the latest version of the highest major version
  - [x] `v1` pointing at the latest `1.x.x` version
- [x] Push tags
