'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Encabezado, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { IconoChevron } from '@/components/ui/Iconos'

/**
 * Aula Virtual — lista de unidades del módulo que cursa el estudiante.
 * RLS ya filtra: solo unidades en estado 'abierta' o 'cerrada' de SU módulo
 * (migración 174) -- aquí no se repite ese filtro, solo se pide y se pinta.
 */

interface UnidadFila {
  id: string
  title: string
  effective_status: string
}

const ETIQUETA_ESTADO: Record<string, { texto: string; tono: 'exito' | 'neutro' }> = {
  abierta: { texto: 'Abierta', tono: 'exito' },
  cerrada: { texto: 'Cerrada · repaso', tono: 'neutro' },
}

export default function Unidades() {
  const router = useRouter()
  const [unidades, setUnidades] = useState<UnidadFila[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('v_units_status')
        .select('id, title, effective_status, order_index')
        .order('order_index', { ascending: true })

      setUnidades((data ?? []) as UnidadFila[])
      setCargando(false)
    }
    cargar()
  }, [router])

  if (cargando) return <PantallaEsqueleto variante="lista" />

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-11">
        <BotonVolver href="/" />

        <Encabezado
          sobretitulo="Aula Virtual"
          titulo="Unidades"
          descripcion="El material, los exámenes y las tareas de tu módulo, organizados por tema."
          accion={
            <Link
              href="/calendario"
              className="rounded-lg border border-zr-border px-4 py-2.5 text-xs font-bold text-zr-text"
            >
              Ver calendario
            </Link>
          }
        />

        <Regla delay={60} />

        <Seccion numero={1} titulo="Tus unidades" delay={100}>
          {unidades.length === 0 ? (
            <p className="text-sm text-zr-text-muted">
              Todavía no hay unidades abiertas para tu módulo. Cuando tu profesor publique una, aparece aquí sola.
            </p>
          ) : (
            <div className="space-y-3">
              {unidades.map((u, i) => {
                const estado = ETIQUETA_ESTADO[u.effective_status] ?? ETIQUETA_ESTADO.cerrada
                return (
                  <Link
                    key={u.id}
                    href={`/unidades/${u.id}`}
                    className="zr-card zr-card-interactive flex items-center justify-between gap-3 p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-zr-text-muted">
                        Unidad {i + 1}
                      </p>
                      <p className="mt-1 truncate text-base font-bold text-zr-text">{u.title}</p>
                      <div className="mt-2">
                        <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
                      </div>
                    </div>
                    <IconoChevron size={20} className="shrink-0 text-zr-text-muted" />
                  </Link>
                )
              })}
            </div>
          )}
        </Seccion>
      </div>
    </div>
  )
}
