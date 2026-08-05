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
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? idError : null, ayuda ? idAyuda : null]
          .filter(Boolean)
          .join(' ') || undefined}
        className={[
          'min-h-[56px] rounded-zr border-2 bg-white/30 px-4 text-base text-zr-text backdrop-blur-md',
          'placeholder:text-zr-text-muted/60',
          error ? 'border-zr-error' : 'border-white/20 focus:border-zr-blue',
          'focus:bg-white/40 transition-all',
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
