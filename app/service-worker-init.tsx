'use client'

import { useServiceWorker } from '@/lib/use-service-worker'

export default function ServiceWorkerInit() {
  useServiceWorker()
  return null
}
