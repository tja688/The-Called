import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => ({
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: false },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: mode === 'development'
        ? { main: `${root}index.html`, pixels: `${root}pixels.html` }
        : { main: `${root}index.html` },
    },
  },
}))
