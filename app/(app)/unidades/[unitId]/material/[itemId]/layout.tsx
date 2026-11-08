import type { Viewport } from 'next'

/**
 * Pedido explícito del coordinador (8-nov-2026): el pellizco con los dos dedos
 * para acercar/alejar imagen/PDF/Word (construido a mano en VisorMaterial) no
 * terminó de funcionar bien en el teléfono. En vez de seguir afinando un
 * gesto hecho a mano, se reactiva el zoom NATIVO del navegador -- el mismo
 * que el `layout.tsx` raíz apaga en TODA la app a propósito
 * (`userScalable: false`, "para que se sienta como app, no como página
 * web") -- pero SOLO en esta pantalla: un `viewport` de un segmento de ruta
 * reemplaza al del layout raíz para esa rama, sin tocar el resto de la app.
 * Los botones +/- se quedan igual, como alternativa sin gestos.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#0F1419',
}

export default function MaterialEstudianteLayout({ children }: { children: React.ReactNode }) {
  return children
}
