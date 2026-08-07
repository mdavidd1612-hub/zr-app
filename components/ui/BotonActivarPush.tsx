'use client'

import { useEffect, useState } from 'react'
import { estaSuscrito, soportaPush, suscribirPush } from '@/lib/push-subscribe'
import { IconoCampana } from '@/components/ui/Iconos'

/** Va en la sección de cuenta de los 3 perfiles. Se auto-oculta en
 *  navegadores que no soportan push (Safari viejo, algunos WebViews). */
export function BotonActivarPush() {
  // soportaPush() es puro (solo mira si el navegador tiene las APIs), así
  // que puede resolverse en la inicialización perezosa del estado en vez de
  // esperar a un efecto.
  const [soportado] = useState(soportaPush)
  const [suscrito, setSuscrito] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    estaSuscrito().then(setSuscrito)
  }, [])

  async function activar() {
    setCargando(true)
    setError(null)
    const resultado = await suscribirPush()
    if (resultado.ok) {
      setSuscrito(true)
    } else {
      setError(resultado.error ?? 'No se pudo activar.')
    }
    setCargando(false)
  }

  if (!soportado || suscrito) return null

  return (
    <div className="space-y-2">
      <button
        onClick={activar}
        disabled={cargando}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zr-border px-4 py-3.5 text-sm font-semibold text-zr-text transition-colors disabled:opacity-50"
      >
        <IconoCampana size={18} />
        {cargando ? 'Activando…' : 'Activar notificaciones'}
      </button>
      {error && <p className="text-center text-xs text-zr-error">{error}</p>}
    </div>
  )
}
