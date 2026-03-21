import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Vite config for building the Web Component version of Paricus Editor.
 *
 * Usage:
 *   npx vite build --config vite.config.wc.js
 *
 * Output:
 *   dist-wc/paricus-editor.js     (ES module)
 *   dist-wc/paricus-editor.umd.js (UMD — works with <script> tags)
 *   dist-wc/style.css             (CSS — must be included separately)
 */
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist-wc',
    lib: {
      entry: path.resolve(__dirname, 'src/paricus-editor-wc.jsx'),
      name: 'ParicusEditor',
      fileName: 'paricus-editor',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      // Bundle everything — no externals for web component
      // React, ReactDOM, and all dependencies are included
      output: {
        // CSS is extracted to a separate file
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'paricus-editor.css'
          return assetInfo.name
        },
      },
    },
  },
})
