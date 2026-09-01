import type { Metadata } from 'next'
import './globals.css'
import ServiceWorkerInit from './service-worker-init'
import InstalarApp from '@/components/ui/InstalarApp'

export const metadata: Metadata = {
  title: 'ZR App',
  description: 'Plataforma académica de la Academia Técnica ZR Mecademy',
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'ZR App' },
  formatDetection: { telephone: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zr-background">
        {children}
        <ServiceWorkerInit />
        <InstalarApp />
      </body>
    </html>
  )
}
