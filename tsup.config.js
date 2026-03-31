const {defineConfig} = require('tsup')

module.exports = defineConfig({
  bundle: true,
  clean: true,
  dts: false,
  entry: {
    index: 'src/setup-julia.ts'
  },
  format: ['cjs'],
  minify: false,
  noExternal: [/.*/],
  outDir: 'dist',
  platform: 'node',
  sourcemap: false,
  splitting: false,
  target: 'node24'
})
