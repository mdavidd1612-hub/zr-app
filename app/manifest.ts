import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZR App',
    short_name: 'ZR Mecademy',
    description: 'Plataforma académica de la Academia Técnica ZR Mecademy',
    start_url: '/',
    scope: '/',
    display: 'standalone', // Sin barra de direcciones
    background_color: '#0F1419',
    theme_color: '#3869B1',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Mi carnet',
        short_name: 'Carnet',
        description: 'Ver mi carnet digital con QR',
        url: '/carnet',
        icons: [{ src: '/icon-96.png', sizes: '96x96', type: 'image/png' }],
      },
    ],
    categories: ['education', 'productivity'],
  }
}
