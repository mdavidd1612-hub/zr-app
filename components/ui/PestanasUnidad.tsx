'use client'

import Link from 'next/link'

/**
 * Aula Virtual — fila de pestañas horizontales con todas las unidades del
 * módulo, como el aula virtual de referencia que trajo el coordinador
 * (reunión 31-oct-2026): arriba una fila de secciones, se toca una y el
 * contenido cambia debajo, sin "entrar" a otra pantalla aparte. Aquí cada
 * pestaña sigue siendo una ruta propia (`hrefBase/[id]`) -- así el botón
 * "atrás" del teléfono y compartir un enlace directo siguen funcionando --
 * pero visualmente es la misma fila de pestañas que el video.
 *
 * El estudiante solo recibe las unidades que RLS ya le deja ver (abierta o
 * cerrada) -- nunca hay que decidir aquí qué ocultar. El profesor ve todas,
 * incluidas borrador/programada, con el mismo color que ya usa en otras
 * pantallas (Etiqueta: neutro/aviso/éxito) para que sepa de un vistazo cuál
 * todavía no ve el estudiante.
 */

export interface PestanaUnidad {
  id: string
  title: string
  tono?: 'exito' | 'aviso' | 'neutro'
}

const COLOR_TONO: Record<'exito' | 'aviso' | 'neutro', string> = {
  exito: 'text-zr-text',
  aviso: 'text-zr-warning',
  neutro: 'text-zr-text-muted',
}

export function PestanasUnidad({
  unidades,
  activaId,
  hrefBase,
}: {
  unidades: PestanaUnidad[]
  activaId: string | null
  hrefBase: string
}) {
  if (unidades.length === 0) return null

  return (
    <nav
      className="-mx-5 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Unidades del módulo"
    >
      <div className="flex w-max gap-1 border-b border-zr-border">
        {unidades.map((u, i) => {
          const activa = u.id === activaId
          return (
            <Link
              key={u.id}
              href={`${hrefBase}/${u.id}`}
              aria-current={activa ? 'page' : undefined}
              className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
                activa
                  ? 'border-zr-blue text-zr-blue'
                  : `border-transparent ${u.tono ? COLOR_TONO[u.tono] : 'text-zr-text'} active:bg-zr-border/30`
              }`}
            >
              U{i + 1} · {u.title}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
