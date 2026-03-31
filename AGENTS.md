# AGENTS.md

Repo-specific instructions for coding agents working in `julia-actions/setup-julia`.

## Toolchain

- Use `nodejs 24.13.0`, which is pinned in [`.tool-versions`](./.tool-versions).
- If the pinned NodeJS version is not installed yet, run `mise install`.
- Avoid using a different NodeJS version for installs, builds, tests, or bundle generation.

## Build And Test

- `npm run build` runs `tsc` and emits unbundled JavaScript into `lib/`.
- `npm run pack` runs `tsup` and regenerates the checked-in action bundle at `dist/index.js`.
- `npm test -- --runInBand` is the preferred Jest invocation for local verification.
- If you change runtime TypeScript in `src/`, rebuild both `lib/` and `dist/index.js` before finishing.

## Action Packaging

- Keep the GitHub Action entrypoint contract intact:
  - [`action.yml`](./action.yml) must continue to point at `dist/index.js` unless the user explicitly asks to change it.
- The repo intentionally keeps a checked-in bundle in `dist/`.
- `tsup` is only the bundler. Do not replace the `tsc`-based `lib/` build unless the task explicitly calls for that.
- Keep the bundle self-contained; do not intentionally change `tsup` config to externalize runtime dependencies needed by the action.

## Repo Conventions

- Prefer `npm ci` over `npm install` when you want a clean, reproducible dependency install.
- `Makefile` targets are thin wrappers around the npm scripts. Keep them working if you change build tooling.
- This is a GitHub Action repo, so packaging changes are user-facing even when TypeScript sources still compile. Treat `dist/index.js` updates as part of the implementation, not as optional generated output.
