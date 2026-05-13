import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  dts: false,
  entry: {
    index: 'src/setup-julia.ts'
  },
  format: ['cjs'],
  noExternal: [/.*/],
  outDir: 'dist',
  outExtension() {
    return {
      js: '.js'
    }
  },
  platform: 'node',
  splitting: false,
  target: 'node24'
})
