import type { Viewport } from 'next'

/** Mismo motivo que `app/(app)/unidades/[unitId]/material/[itemId]/layout.tsx`
 *  -- el visor del profesor usa el mismo VisorMaterial. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#0F1419',
}

export default function MaterialProfesorLayout({ children }: { children: React.ReactNode }) {
  return children
}
