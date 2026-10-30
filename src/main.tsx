import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n'
import App from './App.tsx'
import { APP_VERSION } from './lib/appVersion'
import { shouldReloadForManifestVersion } from './lib/appUpdate'

async function checkForReleaseUpdate(registration: ServiceWorkerRegistration | null) {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}manifest.json`, { cache: 'no-store' })
    if (!response.ok || !shouldReloadForManifestVersion(await response.json(), APP_VERSION)) return
    // The release manifest is newer than the JavaScript that booted this app.
    // Reload once to fetch its fingerprinted bundle and activate any new worker.
    await registration?.update()
    window.location.reload()
  } catch {
    // Offline launches continue with the last complete cached release.
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const workerUrl = `${import.meta.env.BASE_URL}sw.js?v=${encodeURIComponent(APP_VERSION)}`
    const registration = await navigator.serviceWorker.register(workerUrl, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    })
    await registration.update()
    return registration
  } catch {
    // The web app remains usable without an offline worker.
    return null
  }
}

window.addEventListener('load', () => {
  void registerServiceWorker().then(checkForReleaseUpdate)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
