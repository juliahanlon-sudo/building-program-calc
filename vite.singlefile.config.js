import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds a single self-contained bundle as a classic (IIFE) script so the
// output can be inlined into one HTML file that runs from file:// (double-click),
// with no server and no module loading.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-singlefile',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'bundle.js',
      },
    },
  },
})
