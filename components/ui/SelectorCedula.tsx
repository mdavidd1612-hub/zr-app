'use client'

import { useId } from 'react'
import { PREFIJOS_CEDULA } from '@/lib/validators'

/**
 * Cédula = prefijo (V-/J-) + número. Antes se pedía escribir "V-12345678"
 * completo a mano; el prefijo ya viene puesto (V- por defecto, la letra que
 * casi todos tienen) y solo hace falta escribir los dígitos.
 *
 * `value` y `onChange` siguen trabajando con la cédula completa ("V-12345678")
 * para no tocar los formularios que ya validan contra cedulaSchema.
 */
interface Props {
  etiqueta: string
  value: string
  onChange: (cedulaCompleta: string) => void
  required?: boolean
  ayuda?: string
}

export function SelectorCedula({ etiqueta, value, onChange, required, ayuda }: Props) {
  const id = useId()
  const [prefijoActual, numeroActual] = (() => {
    const m = value.match(/^([VEJ]?)-?(.*)$/i)
    return [(m?.[1] || 'V').toUpperCase(), m?.[2] ?? '']
  })()

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-zr-text">{etiqueta}</label>
      <div className="flex gap-2">
        <select
          aria-label="Tipo de cédula"
          value={PREFIJOS_CEDULA.includes(prefijoActual as 'V' | 'J') ? prefijoActual : 'V'}
          onChange={(e) => onChange(`${e.target.value}-${numeroActual}`)}
          className="w-20 shrink-0 rounded-xl border border-zr-border bg-zr-surface px-3 py-4 text-base font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
        >
          {PREFIJOS_CEDULA.map((p) => (
            <option key={p} value={p}>{p}-</option>
          ))}
        </select>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required={required}
          placeholder="12345678"
          value={numeroActual}
          onChange={(e) => onChange(`${prefijoActual}-${e.target.value.replace(/\D/g, '')}`)}
          className="min-h-14 w-full min-w-0 flex-1 rounded-xl border border-zr-border bg-zr-surface px-5 py-4 text-base font-medium text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none focus:ring-2 focus:ring-zr-blue/20"
        />
      </div>
      {ayuda && <p className="text-xs text-zr-text-muted">{ayuda}</p>}
    </div>
  )
}
