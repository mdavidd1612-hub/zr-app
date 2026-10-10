'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Aviso flotante al cerrar un módulo (pedido de Dirección Académica, oct.
 * 2026): cuando Dirección valida y el módulo queda 100 % evaluado, el
 * estudiante ve una vez un mensaje con un check (aprobó) o una X (reprobó) y
 * su nota. La nota y el resultado los calcula la base (mis_notas_modulos).
 * Se recuerda en este teléfono para no repetirlo; si la nota cambia, vuelve a salir.
 */

interface Resultado { moduloId: string; modulo: string; nota: number; aprobo: boolean; clave: string }

function yaVisto(clave: string): boolean {
  try { return localStorage.getItem(clave) === '1' } catch { return false }
}
function marcarVisto(clave: string) {
  try { localStorage.setItem(clave, '1') } catch { /* sin almacenamiento: saldrá de nuevo */ }
}

export function ResultadoModulo() {
  const [cola, setCola] = useState<Resultado[]>([])

  useEffect(() => {
    let vigente = true
    async function cargar() {
      const supabase = createClient()
      const { data } = await supabase.rpc('mis_notas_modulos')
      const cerrados = (data ?? []).filter((f) => f.estado === 'aprobado' || f.estado === 'reprobado')
      if (cerrados.length === 0 || !vigente) return
      const { data: mods } = await supabase.from('modules').select('id, name').in('id', cerrados.map((f) => f.module_id))
      const nombres = new Map((mods ?? []).map((m) => [m.id, m.name]))
      const pendientes = cerrados
        .map((f) => ({
          moduloId: f.module_id,
          modulo: nombres.get(f.module_id) ?? 'el módulo',
          nota: Number(f.puntos),
          aprobo: f.estado === 'aprobado',
          clave: `zr-resultado-${f.module_id}-${Number(f.puntos)}`,
        }))
        .filter((r) => !yaVisto(r.clave))
      if (vigente) setCola(pendientes)
    }
    cargar()
    return () => { vigente = false }
  }, [])

  const actual = cola[0]
  if (!actual) return null

  const cifra = actual.nota.toFixed(actual.nota % 1 === 0 ? 0 : 1)

  function cerrar() {
    marcarVisto(actual.clave)
    setCola((c) => c.slice(1))
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-5 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm space-y-5 rounded-2xl border border-white/15 bg-zr-surface/90 p-7 text-center shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
            actual.aprobo ? 'bg-zr-success/15 text-zr-success' : 'bg-zr-error/15 text-zr-error'
          }`}
        >
          {actual.aprobo ? (
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <div className="space-y-2">
          <p className="zr-display text-2xl text-zr-text">
            {actual.aprobo ? 'Has aprobado el módulo' : 'No aprobaste el módulo'}
          </p>
          <p className="text-sm font-semibold text-zr-text">{actual.modulo}</p>
          <p className={`zr-metric text-5xl ${actual.aprobo ? 'text-zr-success' : 'text-zr-error'}`}>{cifra}</p>
          <p className="text-sm text-zr-text-muted">
            {actual.aprobo
              ? 'Esta es tu nota final. ¡Buen trabajo!'
              : 'Esta fue tu nota final. Habla con tu profesor para ver cómo seguir.'}
          </p>
        </div>
        <button
          onClick={cerrar}
          className="min-h-12 w-full rounded-lg bg-zr-blue text-base font-bold text-white"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
