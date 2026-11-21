'use client'

import { useServiceWorker } from '@/lib/use-service-worker'
import { useRecargarAlVolver } from '@/lib/use-recargar-al-volver'
import { useEffect } from 'react'

export default function ServiceWorkerInit() {
  useServiceWorker()
  useRecargarAlVolver()
  // iOS Safari ignora user-scalable=no: el pellizco y el zoom se frenan aqui.
  useEffect(() => {
    const frenar = (e: Event) => e.preventDefault()
    document.addEventListener('gesturestart', frenar)
    document.addEventListener('gesturechange', frenar)
    return () => {
      document.removeEventListener('gesturestart', frenar)
      document.removeEventListener('gesturechange', frenar)
    }
  }, [])
  return null
}
