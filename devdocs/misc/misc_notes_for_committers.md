# Misc notes for contributors

### Checkin

- Do check in source (`src/`)
- Do check in build output (`lib/`)
- Do check in the bundled GitHub Action artifact (`dist/`)
- Do not check in `node_modules/`

### Local workflow

Use the pinned NodeJS version from `.tool-versions`. The recommended setup flow is:

```bash
mise install
npm ci
npm run build
npm run pack
```

If you change runtime TypeScript sources, regenerate both `lib/` and `dist/` before committing.
