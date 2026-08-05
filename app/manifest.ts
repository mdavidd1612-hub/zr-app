import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZR App',
    short_name: 'ZR Mecademy',
    description: 'Plataforma académica de la Academia Técnica ZR Mecademy',
    start_url: '/',
    scope: '/',
    display: 'standalone', // Sin barra de direcciones
    background_color: '#F5F7FB',
    theme_color: '#21284F',
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
    screenshots: [
      {
        src: '/screenshot-540x720.png',
        sizes: '540x720',
        type: 'image/png',
        form_factor: 'narrow',
      },
      {
        src: '/screenshot-1280x720.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
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
