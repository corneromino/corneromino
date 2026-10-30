import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

const manifest = JSON.parse(readFileSync(new URL('./public/manifest.json', import.meta.url), 'utf8')) as { version?: unknown }
if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
  throw new Error('public/manifest.json must have a non-empty string version.')
}

const serviceWorkerSource = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8')
const generatedServiceWorker = serviceWorkerSource.replaceAll('__APP_VERSION__', JSON.stringify(manifest.version))

function versionedServiceWorker(): Plugin {
  return {
    name: 'corneromino-versioned-service-worker',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (new URL(request.url ?? '/', 'http://localhost').pathname !== '/sw.js') return next()
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        response.end(generatedServiceWorker)
      })
    },
    generateBundle() {
      this.emitFile({ fileName: 'sw.js', source: generatedServiceWorker, type: 'asset' })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.VITE_BASE_PATH ?? '/' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(manifest.version),
  },
  plugins: [react(), tailwindcss(), versionedServiceWorker()],
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
