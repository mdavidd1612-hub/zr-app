'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EtiquetaSede } from './EtiquetaSede'

export interface OpcionCohorte {
  id: string
  name: string
  sede: string | null
  turno: string | null
}

// Un <select> nativo no permite pintar nada dentro de sus <option>: son texto
// plano y punto. Como lo que hacía falta era mostrar la sede como etiqueta al
// lado de cada nombre —para no volver a confundir dos cortes del mismo
// programa—, hay que construir la lista a mano.
//
// La lista se monta en un portal sobre <body>, no dentro de la tarjeta. No es
// capricho: `.zr-card` tiene backdrop-filter, que crea un contexto de
// apilamiento propio y encierra el z-index de todo lo que hay dentro. Puesta
// dentro, la lista se dibujaba DEBAJO de la barra flotante de navegación y del
// botón de inscribir, por muy alto que fuera su z-index.
//
// Se mantiene lo que el <select> nativo daba gratis y aquí importa de verdad,
// porque esto se usa de pie y con las manos sucias: filas altas (56 px), cierre
// al tocar fuera, Escape para salir y foco visible.
export function SelectorCohorte({
  opciones,
  valor,
  onChange,
  // "Programa", no "Cohorte": así lo llama la academia — para ellos PTMA-2026-II
  // ya ES el programa, no hay un nivel intermedio con nombre propio.
  etiqueta = 'Programa',
}: {
  opciones: OpcionCohorte[]
  valor: string
  onChange: (id: string) => void
  etiqueta?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [caja, setCaja] = useState<{ left: number; top: number; width: number } | null>(null)
  const disparador = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLUListElement>(null)

  const elegida = opciones.find((o) => o.id === valor)

  const recalcular = useCallback(() => {
    const r = disparador.current?.getBoundingClientRect()
    if (r) setCaja({ left: r.left, top: r.bottom + 8, width: r.width })
  }, [])

  useLayoutEffect(() => {
    if (abierto) recalcular()
  }, [abierto, recalcular])

  useEffect(() => {
    if (!abierto) return

    function fuera(e: MouseEvent) {
      const destino = e.target as Node
      if (disparador.current?.contains(destino) || lista.current?.contains(destino)) return
      setAbierto(false)
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }

    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    // La lista va en posición fija: si la página se mueve por debajo, quedaría
    // flotando en el sitio equivocado. Se resitúa en vez de cerrarse.
    window.addEventListener('scroll', recalcular, true)
    window.addEventListener('resize', recalcular)

    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', recalcular, true)
      window.removeEventListener('resize', recalcular)
    }
  }, [abierto, recalcular])

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-zr-text">{etiqueta}</label>

      <button
        ref={disparador}
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-left text-base text-zr-text focus:border-zr-blue focus:outline-none"
      >
        {elegida ? (
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{elegida.name}</span>
            <EtiquetaSede sede={elegida.sede} turno={elegida.turno} />
          </span>
        ) : (
          <span className="text-zr-text-muted">Selecciona un programa</span>
        )}
        <span aria-hidden className={`shrink-0 text-zr-text-muted transition-transform ${abierto ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {abierto && caja && createPortal(
        <ul
          ref={lista}
          role="listbox"
          style={{ position: 'fixed', left: caja.left, top: caja.top, width: caja.width }}
          className="z-[70] max-h-[50dvh] overflow-y-auto rounded-lg border border-zr-border bg-zr-surface shadow-2xl"
        >
          {opciones.length === 0 && (
            <li className="px-4 py-4 text-sm text-zr-text-muted">
              No hay programas abiertos para inscribir.
            </li>
          )}

          {opciones.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === valor}
                onClick={() => {
                  onChange(o.id)
                  setAbierto(false)
                }}
                className={`flex min-h-14 w-full flex-wrap items-center gap-2 px-4 py-3 text-left text-base transition-colors ${
                  o.id === valor ? 'bg-zr-blue/15 text-zr-text' : 'text-zr-text hover:bg-zr-blue/10'
                }`}
              >
                <span className="font-semibold">{o.name}</span>
                <EtiquetaSede sede={o.sede} turno={o.turno} />
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  )
}
