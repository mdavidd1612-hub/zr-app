'use client'

/**
 * Recorrido — un camino vertical conectado, en lugar de tarjetas apiladas.
 *
 * Cada paso es un nodo sobre una espina continua. Su estado (hecho, en curso,
 * disponible, con candado) se lee de un vistazo, como un mapa de avance. Nace
 * del pedido del coordinador: que el Aula Virtual se sienta un "ecosistema
 * orgánico" y una app activa que acompaña, no un panel de cuadros sueltos.
 *
 * Reemplaza al patrón "lista de .zr-card": aquí no hay borde por fila, el aire
 * y la espina separan. Se usa en la lista de unidades, el detalle de unidad y
 * donde haga falta mostrar avance como recorrido.
 */

import Link from 'next/link'
import { IconoCheck, IconoCandado, IconoChevron } from './Iconos'

export type EstadoPaso = 'completado' | 'activo' | 'disponible' | 'bloqueado'

type IconoComponente = React.ComponentType<{ size?: number; className?: string }>

/** Contenedor del recorrido. Ordena los pasos y no dibuja nada propio. */
export function Recorrido({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <ol className={`relative ${className}`}>{children}</ol>
}

const NODO_ESTILO: Record<EstadoPaso, string> = {
  completado: 'bg-zr-success/15 text-zr-success ring-1 ring-zr-success/40',
  activo:     'bg-zr-blue/20 text-zr-blue-light ring-1 ring-zr-blue/60',
  disponible: 'bg-zr-blue/12 text-zr-blue-mid ring-1 ring-zr-blue/30',
  bloqueado:  'bg-zr-surface text-zr-text-muted ring-1 ring-zr-border',
}

interface PasoProps {
  estado: EstadoPaso
  /** Línea pequeña sobre el título: "Unidad 1", "Material", "Certificación". */
  eyebrow?: string
  titulo: string
  /** Etiquetas o meta bajo el título. */
  meta?: React.ReactNode
  /** Icono del tipo de contenido dentro del nodo. */
  icono?: IconoComponente
  /** Número dentro del nodo (p. ej. el orden de la unidad) si no hay icono. */
  indice?: number
  /** Destino. Sin href, o con estado bloqueado, el paso no navega. */
  href?: string
  /** Último paso del recorrido: no dibuja la espina hacia abajo. */
  ultimo?: boolean
  /** Retraso de entrada, en milisegundos. */
  delay?: number
  /** Contenido extra bajo el título, a todo lo ancho (texto, una barra…). */
  children?: React.ReactNode
  /** Id del elemento `<li>` — para anclar un tour guiado a un paso concreto. */
  id?: string
}

/** Un paso del recorrido: su nodo sobre la espina y su contenido al lado. */
export function Paso({
  estado, eyebrow, titulo, meta, icono: Icono, indice, href, ultimo = false, delay = 0, children, id,
}: PasoProps) {
  const navega = !!href && estado !== 'bloqueado'
  const atenuado = estado === 'bloqueado'

  // Qué va dentro del nodo: hecho → check; con candado → candado; si no, el
  // icono del tipo, o el número de orden, o un punto.
  let dentroDelNodo: React.ReactNode
  if (estado === 'completado') dentroDelNodo = <IconoCheck size={18} />
  else if (estado === 'bloqueado') dentroDelNodo = <IconoCandado size={16} />
  else if (Icono) dentroDelNodo = <Icono size={18} />
  else if (typeof indice === 'number') dentroDelNodo = <span className="cifra text-sm">{indice}</span>
  else dentroDelNodo = <span className="h-2 w-2 rounded-full bg-current" />

  const cuerpo = (
    <>
      {/* Espina hacia el siguiente paso. Arranca bajo el nodo y baja hasta el
          borde inferior del paso, donde empieza el nodo siguiente. */}
      {!ultimo && (
        <span
          aria-hidden="true"
          className="absolute left-[1.375rem] top-9 h-[calc(100%-2.25rem)] w-px -translate-x-1/2 bg-zr-border"
        />
      )}

      {/* Nodo sobre la espina. */}
      <span
        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${NODO_ESTILO[estado]}`}
      >
        {dentroDelNodo}
      </span>

      {/* Contenido. Afordancia de toque: un fondo suave al pasar o presionar,
          sin borde — eso es lo que evita el "cuadro". */}
      <span
        className={`-my-1 min-w-0 flex-1 rounded-xl px-2 py-1 transition-colors ${
          navega ? 'group-hover:bg-zr-surface/50 group-active:bg-zr-surface/70' : ''
        }`}
      >
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            {eyebrow && (
              <span className="block text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">
                {eyebrow}
              </span>
            )}
            <span className={`mt-0.5 block break-words text-base font-bold ${atenuado ? 'text-zr-text-muted' : 'text-zr-text'}`}>
              {titulo}
            </span>
            {meta && <span className="mt-2 flex flex-wrap items-center gap-2">{meta}</span>}
          </span>
          {navega && <IconoChevron size={18} className="shrink-0 -rotate-90 text-zr-text-muted" />}
        </span>
        {children && <span className="mt-3 block">{children}</span>}
      </span>
    </>
  )

  const claseBase = `group relative flex gap-3 ${ultimo ? '' : 'pb-7'}`
  const estilo = { animationDelay: `${delay}ms` }

  if (navega) {
    return (
      <li id={id} className="animate-fade-in" style={estilo}>
        <Link href={href!} className={claseBase}>
          {cuerpo}
        </Link>
      </li>
    )
  }

  return (
    <li id={id} className={`animate-fade-in ${claseBase}`} style={estilo}>
      {cuerpo}
    </li>
  )
}
