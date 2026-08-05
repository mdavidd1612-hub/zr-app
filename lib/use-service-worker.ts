'use client'

import { useEffect } from 'react'

export function useServiceWorker() {
  useEffect(() => {
    // Solo en el navegador y si es HTTPS (o localhost para desarrollo)
    if (typeof window === 'undefined') return
    if (!navigator.serviceWorker) return
    if (!window.location.hostname.includes('localhost') && window.location.protocol !== 'https:')
      return

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.error('Error registrando Service Worker:', err)
    })
  }, [])
}
