'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Aviso } from '@/components/ui/Aviso'
import { IconoCandado } from '@/components/ui/Iconos'

/**
 * Alternativa segura a la "clave maestra" que pidió el coordinador
 * (transcripción de audio, docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md): en vez
 * de un secreto compartido que abre TODAS las cuentas de estudiantes a la
 * vez, esto restablece la contraseña de UN estudiante, de vuelta a su
 * código de carnet — lo mismo que ya tenía en su planilla. Cada uso pasa
 * por la Edge Function reset-student-password, que valida que quien llama
 * tenga permiso sobre ese estudiante puntual.
 */

interface Props {
  estudianteId: string
}

export function BotonRestablecerPassword({ estudianteId }: Props) {
  const [confirmando, setConfirmando] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  async function restablecer() {
    setCargando(true)
    setResultado(null)

    const { data, error } = await createClient().functions.invoke('reset-student-password', {
      body: { studentId: estudianteId },
    })

    if (error) {
      const contexto = (error as { context?: { json?: () => Promise<unknown> } }).context
      let motivo = 'No se pudo restablecer la contraseña.'
      if (contexto?.json) {
        const cuerpo = (await contexto.json()) as { error?: { message: string } }
        motivo = cuerpo.error?.message ?? motivo
      }
      setResultado({ tipo: 'error', texto: motivo })
      setCargando(false)
      setConfirmando(false)
      return
    }

    const codigo = (data as { studentCode?: string } | null)?.studentCode
    setResultado({
      tipo: 'exito',
      texto: `Contraseña restablecida a su código de carnet: ${codigo}. Díselo o que lo revise en su planilla.`,
    })
    setCargando(false)
    setConfirmando(false)
  }

  return (
    <div className="space-y-3">
      {!confirmando ? (
        <button
          onClick={() => { setConfirmando(true); setResultado(null) }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-zr-border px-6 text-sm font-semibold text-zr-text transition-colors active:border-zr-warning/40 active:text-zr-warning"
        >
          <IconoCandado size={16} />
          Restablecer su contraseña
        </button>
      ) : (
        <div className="zr-card space-y-4 p-5">
          <p className="text-sm text-zr-text-muted">
            Su contraseña vuelve a ser su código de carnet, como al principio. Úsalo si olvidó la
            que puso o la cambió por error.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmando(false)}
              className="min-h-14 flex-1 rounded-lg border border-zr-border text-base font-semibold text-zr-text"
            >
              Cancelar
            </button>
            <button
              onClick={restablecer}
              disabled={cargando}
              className="min-h-14 flex-1 rounded-lg bg-zr-warning/15 text-base font-bold text-zr-warning disabled:opacity-50"
            >
              {cargando ? 'Restableciendo…' : 'Sí, restablecer'}
            </button>
          </div>
        </div>
      )}

      {resultado && <Aviso tipo={resultado.tipo}>{resultado.texto}</Aviso>}
    </div>
  )
}
