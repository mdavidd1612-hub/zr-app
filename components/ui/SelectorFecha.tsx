'use client'

import { useId, useMemo, useState, useEffect } from 'react'

type Props = {
  etiqueta: string
  value: string // yyyy-mm-dd, igual que un <input type="date">
  onChange: (value: string) => void
  ayuda?: string
  required?: boolean
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const clase =
  'min-h-[56px] rounded-xl border border-zr-border bg-zr-surface px-3 text-base font-medium text-zr-text ' +
  'focus:border-zr-blue focus:outline-none focus:ring-2 focus:ring-zr-blue/20 transition-all'

// Día y mes se eligen (nada que escribir mal); el año se escribe porque
// desplazarse por selects hasta 1995 o antes es tedioso con el dedo.
export function SelectorFecha({ etiqueta, value, onChange, ayuda, required }: Props) {
  const id = useId()

  // Estado propio para los tres campos: si dependieran solo de `value`, el
  // día y el mes se "borrarían" visualmente cada vez que el conjunto todavía
  // no forma una fecha completa (por ejemplo, apenas se elige el día, antes
  // de elegir el mes) — un select controlado por un value vacío se ve vacío.
  const [dia, setDia] = useState('')
  const [mes, setMes] = useState('')
  const [anioTexto, setAnioTexto] = useState('')

  // Si el formulario resetea `value` desde afuera (por ejemplo, al limpiar
  // el formulario tras enviarlo), refleja el cambio.
  useEffect(() => {
    if (!value) {
      const t = setTimeout(() => { setDia(''); setMes(''); setAnioTexto('') }, 0)
      return () => clearTimeout(t)
    }
    const [y, m, d] = value.split('-')
    const t = setTimeout(() => { setAnioTexto(y ?? ''); setMes(m ?? ''); setDia(d ?? '') }, 0)
    return () => clearTimeout(t)
  }, [value])

  const diasEnMes = useMemo(() => {
    if (!mes) return 31
    const anioValido = /^\d{4}$/.test(anioTexto) ? Number(anioTexto) : 2000
    return new Date(anioValido, Number(mes), 0).getDate()
  }, [mes, anioTexto])

  function emitir(nuevoDia: string, nuevoMes: string, nuevoAnioTexto: string) {
    setDia(nuevoDia); setMes(nuevoMes); setAnioTexto(nuevoAnioTexto)

    if (nuevoDia && nuevoMes && /^\d{4}$/.test(nuevoAnioTexto)) {
      const diaOk = String(Math.min(Number(nuevoDia), new Date(Number(nuevoAnioTexto), Number(nuevoMes), 0).getDate())).padStart(2, '0')
      onChange(`${nuevoAnioTexto}-${nuevoMes.padStart(2, '0')}-${diaOk}`)
    } else {
      onChange('')
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-dia`} className="text-sm font-medium text-zr-text">
        {etiqueta}
      </label>

      <div className="grid grid-cols-[1fr_1.6fr_1.1fr] gap-2">
        <select
          id={`${id}-dia`}
          value={dia ?? ''}
          onChange={(e) => emitir(e.target.value, mes ?? '', anioTexto)}
          required={required}
          className={clase}
        >
          <option value="">Día</option>
          {Array.from({ length: diasEnMes }, (_, i) => i + 1).map((d) => (
            <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
          ))}
        </select>

        <select
          value={mes ?? ''}
          onChange={(e) => emitir(dia ?? '', e.target.value, anioTexto)}
          required={required}
          className={clase}
        >
          <option value="">Mes</option>
          {MESES.map((nombre, i) => (
            <option key={nombre} value={String(i + 1).padStart(2, '0')}>{nombre}</option>
          ))}
        </select>

        <input
          type="text"
          inputMode="numeric"
          placeholder="Año"
          maxLength={4}
          value={anioTexto}
          onChange={(e) => {
            const limpio = e.target.value.replace(/\D/g, '').slice(0, 4)
            setAnioTexto(limpio)
            emitir(dia ?? '', mes ?? '', limpio)
          }}
          required={required}
          className={clase + ' text-center'}
        />
      </div>

      {ayuda && <p className="text-sm text-zr-text-muted">{ayuda}</p>}
    </div>
  )
}
