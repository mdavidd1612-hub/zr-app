'use client'

import { useServiceWorker } from '@/lib/use-service-worker'
import { useRecargarAlVolver } from '@/lib/use-recargar-al-volver'

export default function ServiceWorkerInit() {
  useServiceWorker()
  useRecargarAlVolver()
  return null
}
