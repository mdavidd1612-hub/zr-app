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
          'min-h-[56px] rounded-xl border border-white/15 bg-white/25 px-4 text-base text-zr-text',
          'backdrop-blur-2xl',
          'placeholder:text-zr-text-muted/50',
          'shadow-[0_8px_32px_rgba(31,38,135,0.1),inset_0_1px_0_rgba(255,255,255,0.7)]',
          error ? 'border-zr-error' : 'focus:border-zr-blue/50 focus:bg-white/30',
          'focus:outline-none transition-all duration-200',
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
