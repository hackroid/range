import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'

// Register SW with periodic update checks (every 60 min)
// Fixes iOS Safari PWA not picking up new assets
registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      setInterval(() => { registration.update() }, 60 * 60 * 1000)
    }
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
