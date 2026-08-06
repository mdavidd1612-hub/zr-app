'use client'

import { IconoAviso } from '@/components/ui/Iconos'

interface EstadoVacioProps {
  titulo: string
  explicacion: string
}

/** Tarjeta para cuando una lista no tiene nada que mostrar. Siempre dice por
 *  qué está vacía: spec/04 §0 lo exige, no es cosmético. */
export function EstadoVacio({ titulo, explicacion }: EstadoVacioProps) {
  return (
    <div className="zr-card space-y-4 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zr-border text-zr-text-muted">
        <IconoAviso size={22} />
      </div>
      <h2 className="text-lg font-bold text-zr-text">{titulo}</h2>
      <p className="mx-auto max-w-sm text-sm leading-relaxed text-zr-text-muted">{explicacion}</p>
    </div>
  )
}
