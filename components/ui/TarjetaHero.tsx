'use client'

import type { ReactNode } from 'react'

/**
 * Tarjeta destacada con el degradado granulado de la marca (clase .zr-hero en
 * globals.css). Se usa para lo ÚNICO importante de una pantalla: en el inicio
 * del estudiante, "lo que sigue". Una por pantalla, para que siga siendo
 * destacada.
 */
export function TarjetaHero({
  sobretitulo, titulo, texto, accion, onAccion, icono, children,
}: {
  sobretitulo?: string
  titulo: string
  texto?: string
  accion?: string
  onAccion?: () => void
  icono?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="zr-hero p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {sobretitulo && (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">{sobretitulo}</p>
          )}
          <h2 className="zr-display mt-2 text-2xl leading-tight text-white">{titulo}</h2>
          {texto && <p className="mt-2 text-sm leading-relaxed text-white/80">{texto}</p>}
        </div>
        {icono && (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-white backdrop-blur-sm">
            {icono}
          </span>
        )}
      </div>
      {children}
      {accion && onAccion && (
        <button
          onClick={onAccion}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-base font-bold text-[#14315F] shadow-lg shadow-black/20"
        >
          {accion}
          <span aria-hidden>›</span>
        </button>
      )}
    </div>
  )
}
