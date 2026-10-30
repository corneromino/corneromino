import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n'
import App from './App.tsx'

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  // An initial install need not reload the page. Future workers contain a new
  // release version, so reload only after one takes control of this page.
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
  }
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
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
  void registerServiceWorker()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
