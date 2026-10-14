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

// Confeti: piezas de colores que caen una sola vez (CSS puro, sin librerías).
const COLORES = ['#2f6bff', '#22c55e', '#f5b514', '#ef4444', '#a855f7', '#06b6d4']
const PIEZAS = Array.from({ length: 48 }, (_, i) => ({
  izq: (i * 37) % 100,
  demora: ((i * 53) % 100) / 100 * 0.9,
  dura: 2.4 + ((i * 29) % 10) / 10 * 1.6,
  color: COLORES[i % COLORES.length],
  ancho: 6 + (i % 4) * 2,
  giro: (i % 2 ? 1 : -1) * (180 + (i * 47) % 360),
  redonda: i % 3 === 0,
}))

function Confeti() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[91] overflow-hidden">
      <style>{`@keyframes zrConfeti{0%{transform:translate3d(0,-12vh,0) rotate(0);opacity:1}100%{transform:translate3d(var(--dx),108vh,0) rotate(var(--giro));opacity:.9}}`}</style>
      {PIEZAS.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.izq}%`,
            width: p.ancho,
            height: p.ancho * (p.redonda ? 1 : 1.8),
            background: p.color,
            borderRadius: p.redonda ? '50%' : 2,
            animation: `zrConfeti ${p.dura}s ${p.demora}s ease-in forwards`,
            ['--giro' as string]: `${p.giro}deg`,
            ['--dx' as string]: `${((i % 5) - 2) * 14}px`,
          }}
        />
      ))}
    </div>
  )
}

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

  const cifra = actual.nota.toFixed(2)

  function cerrar() {
    marcarVisto(actual.clave)
    setCola((c) => c.slice(1))
  }

  return (
    <>
    {actual.aprobo && <Confeti key={actual.clave} />}
    <div
      className={`fixed inset-0 z-[90] flex items-center justify-center p-5 backdrop-blur-md ${
        actual.aprobo ? 'bg-emerald-950/70' : 'animate-[zrSacudir_.5s_ease-in-out_1] bg-red-950/80'
      }`}
    >
      <style>{`@keyframes zrSacudir{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(9px)}60%{transform:translateX(-6px)}80%{transform:translateX(4px)}}`}</style>
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full max-w-sm space-y-5 rounded-2xl border-2 p-7 text-center backdrop-blur-xl ${
          actual.aprobo
            ? 'border-zr-success/60 bg-emerald-950/80 shadow-[0_0_60px_rgba(34,197,94,0.35)]'
            : 'border-zr-error/70 bg-red-950/85 shadow-[0_0_60px_rgba(239,68,68,0.45)]'
        }`}
      >
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
            actual.aprobo ? 'bg-zr-success/20 text-zr-success' : 'bg-zr-error/25 text-red-300'
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
          <p className={`zr-metric text-5xl ${actual.aprobo ? 'text-zr-success' : 'text-red-300'}`}>{cifra}</p>
          <p className="text-sm text-zr-text-muted">
            {actual.aprobo
              ? 'Esta es tu nota final. ¡Buen trabajo!'
              : 'Esta fue tu nota final. Habla con tu profesor para ver cómo seguir.'}
          </p>
        </div>
        <button
          onClick={cerrar}
          className={`min-h-12 w-full rounded-lg text-base font-bold text-white ${actual.aprobo ? 'bg-zr-success' : 'bg-zr-error'}`}
        >
          Entendido
        </button>
      </div>
    </div>
    </>
  )
}
