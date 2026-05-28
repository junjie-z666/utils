import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/hooks/index.ts', 'src/node/mockMiddleWare.js'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  external: ['react'],
})
