'use client'

import { Children, isValidElement, useEffect, useState, type ReactNode } from 'react'

/**
 * Selector propio de la app, reemplazo de <select> (pedido de Dirección
 * Académica, sept. 2026): en Android el desplegable nativo sale cuadrado,
 * gris y fuera de estilo, distinto a iPhone. Este se ve igual en todos los
 * teléfonos: una hoja desde abajo con opciones grandes, fáciles de tocar con
 * el pulgar.
 *
 * Es un reemplazo directo: se usa igual que <select> (value, onChange,
 * disabled, className y hijos <option>). onChange recibe un objeto con
 * `target.value`, así los manejadores existentes no cambian.
 */

interface Opcion {
  value: string
  etiqueta: string
  deshabilitada: boolean
}

function texto(nodo: ReactNode): string {
  if (nodo === null || nodo === undefined || typeof nodo === 'boolean') return ''
  if (typeof nodo === 'string' || typeof nodo === 'number') return String(nodo)
  if (Array.isArray(nodo)) return nodo.map(texto).join('')
  if (isValidElement<{ children?: ReactNode }>(nodo)) return texto(nodo.props.children)
  return ''
}

function leerOpciones(hijos: ReactNode): Opcion[] {
  const salida: Opcion[] = []
  Children.forEach(hijos, (h) => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(h)) return
    if (h.type === 'option') {
      const etiqueta = texto(h.props.children)
      salida.push({
        value: h.props.value !== undefined ? String(h.props.value) : etiqueta,
        etiqueta,
        deshabilitada: !!h.props.disabled,
      })
    } else if (h.props.children !== undefined) {
      salida.push(...leerOpciones(h.props.children))
    }
  })
  return salida
}

export function Select({
  id,
  value,
  onChange,
  disabled,
  className = '',
  children,
}: {
  id?: string
  value: string | number | undefined
  onChange: (e: { target: { value: string } }) => void
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const opciones = leerOpciones(children)
  const actual = opciones.find((o) => o.value === String(value ?? ''))

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [abierto])

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setAbierto(true)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={`${className} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`min-w-0 truncate ${actual && actual.value !== '' ? '' : 'text-zr-text-muted'}`}>
          {actual?.etiqueta ?? ''}
        </span>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="shrink-0 text-zr-text-muted">
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center sm:p-5"
          onClick={() => setAbierto(false)}
        >
          <div
            role="listbox"
            className="max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-zr-border bg-zr-surface p-2 pb-6 sm:rounded-2xl sm:pb-2"
            onClick={(e) => e.stopPropagation()}
          >
            {opciones.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-zr-text-muted">No hay opciones para elegir.</p>
            )}
            {opciones.map((o, i) => {
              const elegida = o.value === String(value ?? '')
              return (
                <button
                  key={`${o.value}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={elegida}
                  disabled={o.deshabilitada}
                  onClick={() => {
                    onChange({ target: { value: o.value } })
                    setAbierto(false)
                  }}
                  className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-4 text-left text-sm disabled:opacity-40 ${
                    elegida ? 'bg-zr-blue/15 font-bold text-zr-text' : 'font-medium text-zr-text'
                  } ${o.value === '' ? 'text-zr-text-muted' : ''}`}
                >
                  <span>{o.etiqueta}</span>
                  {elegida && <span className="text-zr-blue">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
