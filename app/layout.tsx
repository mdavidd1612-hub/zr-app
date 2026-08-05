import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ZR App',
  description: 'Plataforma académica de la Academia Técnica ZR Mecademy',
  icons: { icon: '/favicon.ico' },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'ZR App' },
  formatDetection: { telephone: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zr-background">
        {children}
        <ServiceWorkerInit />
      </body>
    </html>
  )
}

// Componente que inicializa el Service Worker
function ServiceWorkerInit() {
  'use client'
  const { useServiceWorker } = require('@/lib/use-service-worker')
  useServiceWorker()
  return null
}
