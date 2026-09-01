import type { Metadata, Viewport } from 'next'
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

// Instalada como PWA en un iPhone con notch, la app dibuja de borde a borde
// (`viewport-fit: cover`); las franjas seguras se respetan con env(safe-area-*)
// en el marco, no dejando bandas negras. `maximumScale: 5` porque bloquear el
// zoom es una barrera de accesibilidad (WCAG 1.4.4) y en un taller alguien va
// a querer agrandar una cifra.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#0F1419',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-zr-bg">
        {children}
        <ServiceWorkerInit />
        <InstalarApp />
      </body>
    </html>
  )
}
