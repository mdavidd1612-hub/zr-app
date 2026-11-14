'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta } from '@/components/ui/Editorial'
import { Recorrido, Paso, type EstadoPaso } from '@/components/ui/Recorrido'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { IconoCalendario, IconoExamen } from '@/components/ui/Iconos'

/**
 * Aula Virtual — las unidades del módulo como un recorrido, no una lista de
 * cuadros. RLS ya filtra: solo unidades 'abierta' o 'cerrada' de SU módulo
 * (migración 174); aquí solo se pide y se dibuja el camino.
 */

interface UnidadFila {
  id: string
  module_id: string
  title: string
  effective_status: string
  prerequisite_met: boolean
}

export default function Unidades() {
  const router = useRouter()
  const [unidades, setUnidades] = useState<UnidadFila[]>([])
  const [cargando, setCargando] = useState(true)
  // Módulos que ya cursó + el actual (los futuros no aparecen). Reunión 14-nov-2026.
  const [modulos, setModulos] = useState<{ id: string; name: string; order_index: number }[]>([])
  const [actualId, setActualId] = useState<string | null>(null)
  const [moduloSel, setModuloSel] = useState<string | null>(null)

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
        .select('id, module_id, title, effective_status, order_index, prerequisite_met')
        .order('order_index', { ascending: true })

      const { data: idsCursados } = await supabase.rpc('mis_modulos_cursados' as never) as { data: string[] | null }
      const { data: miActual } = await supabase.rpc('my_module_id' as never) as { data: string | null }
      const ids = (idsCursados ?? []) as string[]
      const { data: mods } = ids.length
        ? await supabase.from('modules').select('id, name, order_index').in('id', ids).order('order_index')
        : { data: [] as { id: string; name: string; order_index: number }[] }
      setModulos(mods ?? [])
      setActualId(miActual ?? null)
      setModuloSel(
        (miActual && ids.includes(miActual) ? miActual : null) ?? (mods && mods.length ? mods[mods.length - 1].id : null),
      )

      // Casteo: v_units_status gana la columna prerequisite_met en la
      // migración 185; los tipos generados se regeneran en el próximo barrido.
      setUnidades((data ?? []) as unknown as UnidadFila[])
      setCargando(false)
    }
    cargar()
  }, [router])

  if (cargando) return <PantallaEsqueleto variante="lista" />

  // "Dónde vas": la primera unidad abierta y no bloqueada se marca como activa
  // (nodo resaltado), para que el recorrido tenga un punto de atención claro.
  const unidadesDelModulo = moduloSel ? unidades.filter((u) => u.module_id === moduloSel) : unidades
  const indiceActiva = unidadesDelModulo.findIndex(
    (u) => u.effective_status === 'abierta' && u.prerequisite_met !== false,
  )

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-9">
        <BotonVolver href="/" />

        <Encabezado
          sobretitulo="Aula Virtual"
          titulo="Tu recorrido"
          descripcion="El material, los exámenes y las tareas de tu módulo, paso a paso."
          accion={
            <div className="flex flex-wrap gap-2">
              {/* Sin esto, /examenes (notas, revisión, rehabilitación) no
                  tenía ningún acceso desde el menú -- bug real reportado en
                  vivo (8-nov-2026). */}
              <Link
                href="/examenes"
                className="inline-flex items-center gap-2 rounded-full border border-zr-border px-4 py-2.5 text-xs font-bold text-zr-text transition-colors hover:border-zr-blue/40"
              >
                <IconoExamen size={16} />
                Mis exámenes
              </Link>
              <Link
                href="/calendario"
                className="inline-flex items-center gap-2 rounded-full border border-zr-border px-4 py-2.5 text-xs font-bold text-zr-text transition-colors hover:border-zr-blue/40"
              >
                <IconoCalendario size={16} />
                Calendario
              </Link>
            </div>
          }
        />

        <Regla delay={60} />

        {modulos.length > 1 && (
          <div className="-mx-5 overflow-x-auto px-5">
            <div className="flex gap-2 pb-1">
              {modulos.map((m) => {
                const activo = m.id === moduloSel
                return (
                  <button
                    key={m.id}
                    onClick={() => setModuloSel(m.id)}
                    className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${
                      activo ? 'border-zr-blue bg-zr-blue/15 text-zr-text' : 'border-zr-border text-zr-text-muted'
                    }`}
                  >
                    Módulo {m.order_index} · {m.name}{m.id === actualId ? ' (actual)' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {unidadesDelModulo.length === 0 ? (
          <p className="text-sm text-zr-text-muted">
            Todavía no hay unidades abiertas en este módulo. Cuando tu profesor publique una, aparece aquí sola.
          </p>
        ) : (
          <Recorrido>
            {unidadesDelModulo.map((u, i) => {
              const bloqueada = u.prerequisite_met === false
              const cerrada = u.effective_status === 'cerrada'
              const activa = i === indiceActiva

              const estado: EstadoPaso = bloqueada
                ? 'bloqueado'
                : activa
                  ? 'activo'
                  : 'disponible'

              const meta = bloqueada ? (
                <Etiqueta tono="neutro">Se abre al aprobar la unidad anterior</Etiqueta>
              ) : cerrada ? (
                <Etiqueta tono="neutro">Cerrada · repaso</Etiqueta>
              ) : activa ? (
                <Etiqueta tono="info">Vas aquí</Etiqueta>
              ) : (
                <Etiqueta tono="exito">Abierta</Etiqueta>
              )

              return (
                <Paso
                  key={u.id}
                  estado={estado}
                  indice={i + 1}
                  eyebrow={`Unidad ${i + 1}`}
                  titulo={u.title}
                  meta={meta}
                  href={bloqueada ? undefined : `/unidades/${u.id}`}
                  ultimo={i === unidadesDelModulo.length - 1}
                  delay={80 + i * 50}
                />
              )
            })}
          </Recorrido>
        )}
      </div>
    </div>
  )
}
