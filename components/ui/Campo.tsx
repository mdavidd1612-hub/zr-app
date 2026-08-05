'use client'

import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  etiqueta: string
  error?: string
  ayuda?: string
}

export function Campo({ etiqueta, error, ayuda, className = '', ...resto }: Props) {
  const id = useId()
  const idError = `${id}-error`
  const idAyuda = `${id}-ayuda`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zr-text">
        {etiqueta}
      </label>

      <input
        {...resto}
        id={id}
        // El error se anuncia al lector de pantalla, no solo se pinta de rojo.
        // Requisito de WCAG 3.3.1: el color nunca es el único indicador.
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? idError : null, ayuda ? idAyuda : null]
          .filter(Boolean)
          .join(' ') || undefined}
        className={[
          'min-h-[56px] rounded-zr border-2 bg-white px-4 text-base text-zr-text',
          'placeholder:text-zr-text-muted',
          error ? 'border-zr-error' : 'border-zr-border focus:border-zr-blue',
          className,
        ].join(' ')}
      />

      {ayuda && !error && (
        <p id={idAyuda} className="text-sm text-zr-text-muted">{ayuda}</p>
      )}

      {error && (
        <p id={idError} className="text-sm font-medium text-zr-error">{error}</p>
      )}
    </div>
  )
}
