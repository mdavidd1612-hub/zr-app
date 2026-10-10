import type { MetadataRoute } from 'next'
import { ES_ENTORNO_PRUEBA, SUFIJO_ENTORNO } from '@/lib/entorno'

// Entorno de prueba: iconos con la etiqueta amarilla STAGING (public/staging/).
const CARPETA = ES_ENTORNO_PRUEBA ? '/staging' : ''

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `ZR App${SUFIJO_ENTORNO}`,
    short_name: SUFIJO_ENTORNO ? 'ZR Prueba' : 'ZR Mecademy',
    description: 'Plataforma académica de la Academia Técnica ZR Mecademy',
    start_url: '/',
    scope: '/',
    display: 'standalone', // Sin barra de direcciones
    background_color: '#0F1419',
    theme_color: '#3869B1',
    // Sin bloqueo de orientación: instalada en una PC, la ventana de la PWA
    // es apaisada y de tamaño libre — con 'portrait-primary' el sistema puede
    // negarse a darle el ancho completo. En el teléfono se sigue usando de pie
    // por costumbre, y el marco responsive aguanta el giro sin romperse.
    orientation: 'any',
    icons: [
      {
        src: `${CARPETA}/icon-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${CARPETA}/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${CARPETA}/icon-maskable-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `${CARPETA}/icon-maskable-512.png`,
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
        icons: [{ src: `${CARPETA}/icon-96.png`, sizes: '96x96', type: 'image/png' }],
      },
    ],
    categories: ['education', 'productivity'],
  }
}
