# Release checklist

Version: `1.b.c`

- [ ] Create release branch `releases/v1.b.c`
  - [ ] Unignore `node_modules/` by adding `!` in front in `.gitignore`
  - [ ] Delete `node_modules/`
  - [ ] Install production dependencies: `npm install --production`
  - [ ] Add `node_modules/`: `git add node_modules`
  - [ ] Commit & push action: `git commit -a -m "Publish v1.b.c."`, then `git push`
- [ ] Test the action with an example package
- [ ] Create tags
  - [ ] `v1.b.c` pointing at the last commit in `releases/v1.b.c`
  - [ ] `latest` pointing at the latest version of the highest major version
  - [ ] `v1` pointing at the latest `1.x.x` version
- [ ] Push tags
