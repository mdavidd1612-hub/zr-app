'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Cinta "Sin conexión" (evaluación de UX, 20-nov-2026): cuando la red se cae,
 * las pantallas fallaban sin avisar. Aparece arriba mientras el teléfono esté
 * sin internet y lleva a las unidades descargadas, que sí funcionan offline.
 * Para personal (sin descargas) muestra solo el aviso.
 */
export function AvisoSinConexion({ conDescargas = false }: { conDescargas?: boolean }) {
  const [enLinea, setEnLinea] = useState(true)

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine)
    actualizar()
    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)
    return () => {
      window.removeEventListener('online', actualizar)
      window.removeEventListener('offline', actualizar)
    }
  }, [])

  if (enLinea) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-3 bg-zr-warning px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-center text-xs font-bold text-zr-bg"
    >
      <span>Sin conexión.</span>
      {conDescargas && (
        <Link href="/descargas" className="underline underline-offset-2">Ver mis descargas</Link>
      )}
    </div>
  )
}
