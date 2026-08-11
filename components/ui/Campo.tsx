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
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-zr-text">
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
          'w-full min-h-[56px] px-5 py-4 bg-zr-surface border border-zr-border rounded-xl',
          'text-base font-medium text-zr-text placeholder-zr-text-muted',
          error ? 'border-zr-error' : 'focus:border-zr-blue',
          'focus:outline-none focus:ring-2 focus:ring-zr-blue/20 transition-all',
          className,
        ].join(' ')}
      />

      {ayuda && !error && (
        <p id={idAyuda} className="text-xs text-zr-text-muted">{ayuda}</p>
      )}

      {error && (
        <p id={idError} className="text-sm font-medium text-zr-error">{error}</p>
      )}
    </div>
  )
}
