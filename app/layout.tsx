import type { Metadata } from 'next'
import './globals.css'
import ServiceWorkerInit from './service-worker-init'

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
