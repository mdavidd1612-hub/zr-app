'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Campo para notas, porcentajes y puntos: SIEMPRE con dos decimales
 * (0.00, 12.50, 100.00), incluso cuando vale cero. Pedido del coordinador
 * (16-nov-2026): una sola forma de mostrar las cifras en toda la app.
 *
 * Se escribe libremente (con punto o coma); al salir del campo se normaliza a
 * dos decimales y, si queda vacío, vale 0.00 (a menos que `permitirVacio`).
 * Sirve para cualquier lugar donde antes había un `<input type="number">` de
 * notas.
 */
export function formatoNota(n: number | ''): string {
  return n === '' || !Number.isFinite(n) ? '' : n.toFixed(2)
}

export function InputNota({
  value, onChange, min = 0, max, id, className, placeholder = '0.00', permitirVacio = false, disabled, ariaLabel,
}: {
  value: number | ''
  onChange: (v: number | '') => void
  min?: number
  max?: number
  id?: string
  className?: string
  placeholder?: string
  /** Para una nota que todavía no se pone (vacío = sin nota), en vez de 0.00. */
  permitirVacio?: boolean
  disabled?: boolean
  ariaLabel?: string
}) {
  const [texto, setTexto] = useState(formatoNota(value))
  const enFoco = useRef(false)

  // Si el valor cambia desde afuera (cargar un examen, aplicar una plantilla),
  // se refleja con dos decimales -- salvo mientras la persona está escribiendo.
  useEffect(() => {
    if (!enFoco.current) setTexto(formatoNota(value))
  }, [value])

  function alEscribir(t: string) {
    const limpio = t.replace(',', '.')
    if (!/^\d*\.?\d{0,2}$/.test(limpio)) return
    setTexto(limpio)
    if (limpio === '' || limpio === '.') { onChange(''); return }
    const n = Number(limpio)
    if (Number.isFinite(n)) onChange(n)
  }

  function alSalir() {
    enFoco.current = false
    let n = texto === '' || texto === '.' ? NaN : Number(texto)
    if (!Number.isFinite(n)) {
      if (permitirVacio) { setTexto(''); onChange(''); return }
      n = Math.max(min, 0)
    }
    if (n < min) n = min
    if (max !== undefined && n > max) n = max
    const redondeado = Math.round(n * 100) / 100
    setTexto(redondeado.toFixed(2))
    onChange(redondeado)
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={texto}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      onFocus={(e) => { enFoco.current = true; e.currentTarget.select() }}
      onChange={(e) => alEscribir(e.target.value)}
      onBlur={alSalir}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className={className}
    />
  )
}
