import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const manifest = JSON.parse(readFileSync(new URL('./public/manifest.json', import.meta.url), 'utf8')) as { version?: unknown }
if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
  throw new Error('public/manifest.json must have a non-empty string version.')
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.VITE_BASE_PATH ?? '/' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(manifest.version),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
  server: {
    host: true,
    allowedHosts: command == "serve" ? true : []
  }
}));
