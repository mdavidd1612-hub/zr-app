'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cargarAgenda, type Agenda, type TipoAgenda } from '@/lib/agenda'
import { IconoCalendario, IconoCerrar } from '@/components/ui/Iconos'

/**
 * Calendario flotante (18-nov-2026): botón junto a la campanita, visible en
 * cualquier pantalla de estudiante y profesor. Abre una ventana con lo próximo:
 * la clase del sábado con su salón, exámenes, tareas y aperturas. Un punto avisa
 * cuando hay algo en las próximas 48 horas. Los demás roles no lo ven.
 */

const PUNTO: Record<TipoAgenda, string> = {
  clase: 'bg-zr-blue-mid',
  unit_open: 'bg-zr-success',
  unit_close: 'bg-zr-text-muted',
  exam: 'bg-zr-warning',
  assignment: 'bg-zr-blue',
}

export function CalendarioFlotante() {
  const router = useRouter()
  const [agenda, setAgenda] = useState<Agenda | null>(null)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    let vigente = true
    cargarAgenda(createClient()).then((a) => { if (vigente) setAgenda(a) }).catch(() => {})
    return () => { vigente = false }
  }, [])

  useEffect(() => {
    if (!abierto) return
    const t = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [abierto])

  if (!agenda || (agenda.rol !== 'estudiante' && agenda.rol !== 'profesor')) return null

  const ahora = Date.now()
  const proximos = agenda.items.filter((i) => new Date(i.fecha).getTime() >= ahora - 3_600_000).slice(0, 8)
  const cercano = proximos.some((i) => new Date(i.fecha).getTime() - ahora < 48 * 3_600_000)

  return (
    <>
      <button onClick={() => setAbierto(true)} aria-label="Abrir calendario" className="relative flex h-11 w-11 items-center justify-center text-zr-text">
        <IconoCalendario size={20} />
        {cercano && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-zr-warning ring-2 ring-zr-bg" />}
      </button>

      {abierto && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center sm:p-6" onClick={() => setAbierto(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Calendario"
            onClick={(e) => e.stopPropagation()}
            className="zr-card max-h-[85dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-b-[var(--zr-radius)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="zr-display text-lg text-zr-text">Lo que viene</h2>
              <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-xl bg-zr-surface text-zr-text-muted">
                <IconoCerrar size={18} />
              </button>
            </div>

            {proximos.length === 0 ? (
              <p className="text-sm text-zr-text-muted">No hay nada programado todavía.</p>
            ) : (
              <div className="divide-y divide-zr-border/60">
                {proximos.map((i) => {
                  const f = new Date(i.fecha).toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })
                  const cuerpo = (
                    <>
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${PUNTO[i.tipo]}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-zr-text">{i.titulo}</span>
                        <span className="block text-xs capitalize text-zr-text-muted">{f}{i.detalle ? ` · ${i.detalle}` : ''}</span>
                      </span>
                    </>
                  )
                  return i.href ? (
                    <button key={i.id} onClick={() => { setAbierto(false); router.push(i.href!) }} className="flex w-full items-start gap-3 py-3 text-left">{cuerpo}</button>
                  ) : (
                    <div key={i.id} className="flex items-start gap-3 py-3">{cuerpo}</div>
                  )
                })}
              </div>
            )}

            {(              <button
                onClick={() => { setAbierto(false); router.push(agenda.rol === 'profesor' ? '/calendario-docente' : '/calendario') }}
                className="min-h-12 w-full rounded-2xl bg-zr-blue text-sm font-bold text-white"
              >
                Ver calendario completo
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
