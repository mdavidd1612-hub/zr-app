'use client'

import type { ComponentType } from 'react'
import { IconoAviso } from '@/components/ui/Iconos'

interface EstadoVacioProps {
  titulo: string
  explicacion: string
  /** Ícono grande que explica de qué trata la pantalla (por defecto, un aviso). */
  Icono?: ComponentType<{ size?: number; className?: string }>
  /** Botón opcional con el siguiente paso. */
  accion?: { texto: string; onClick: () => void }
}

/** Tarjeta para cuando una lista no tiene nada que mostrar. Siempre dice por
 *  qué está vacía: spec/04 §0 lo exige, no es cosmético. Con ícono grande para
 *  que se entienda de un vistazo (pedido del coordinador, 17-nov-2026). */
export function EstadoVacio({ titulo, explicacion, Icono = IconoAviso, accion }: EstadoVacioProps) {
  return (
    <div className="zr-card space-y-4 p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-zr-blue/30 to-zr-blue-deep/10 text-zr-blue-mid ring-1 ring-zr-blue/25">
        <Icono size={28} />
      </div>
      <h2 className="text-lg font-bold text-zr-text">{titulo}</h2>
      <p className="mx-auto max-w-sm text-sm leading-relaxed text-zr-text-muted">{explicacion}</p>
      {accion && (
        <button
          onClick={accion.onClick}
          className="mx-auto min-h-12 rounded-2xl bg-zr-blue px-6 text-sm font-bold text-white"
        >
          {accion.texto}
        </button>
      )}
    </div>
  )
}
