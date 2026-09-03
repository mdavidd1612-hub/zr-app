'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * Malla curricular (especificacion-funcional-zrm-academy.md §9, Módulo 7):
 * todos los módulos del programa y el ORDEN en que se cursan. El estudiante
 * necesita ver el camino completo, no solo el módulo de esta semana — que es
 * lo único que muestra /clases.
 *
 * No es "Mi progreso" ni el mapa de dominio: aquí no hay competencias
 * dominadas ni notas, solo tres estados derivados de dónde está su cohorte
 * (cursado / actual / por cursar), que es lo que pide la spec.
 */

type Estado = 'cursado' | 'actual' | 'pendiente'

interface ModuloMalla {
  id: string
  orden: number
  nombre: string
  descripcion: string | null
  semanas: number
  homologado: boolean
  estado: Estado
}

export default function MallaCurricular() {
  const router = useRouter()
  const [programa, setPrograma] = useState<string | null>(null)
  const [modulos, setModulos] = useState<ModuloMalla[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: est } = await supabase
        .from('students')
        .select('cohorts(current_module_id, programs(id, name))')
        .eq('id', user.id)
        .single()

      const cohorte = (est as unknown as {
        cohorts: { current_module_id: string | null; programs: { id: string; name: string } | null } | null
      } | null)?.cohorts

      if (!cohorte?.programs) {
        setCargando(false)
        return
      }

      const { data: mods } = await supabase
        .from('modules')
        .select('id, order_index, name, description, duration_weeks, inces_homologado')
        .eq('program_id', cohorte.programs.id)
        .order('order_index', { ascending: true })

      // El orden del módulo actual marca el corte: lo anterior ya se cursó,
      // lo posterior está por cursar.
      const ordenActual = (mods ?? []).find((m) => m.id === cohorte.current_module_id)?.order_index ?? null

      setPrograma(cohorte.programs.name)
      setModulos((mods ?? []).map((m) => ({
        id: m.id,
        orden: m.order_index,
        nombre: m.name,
        descripcion: m.description,
        semanas: m.duration_weeks,
        homologado: m.inces_homologado,
        estado:
          ordenActual === null ? 'pendiente'
          : m.order_index < ordenActual ? 'cursado'
          : m.order_index === ordenActual ? 'actual'
          : 'pendiente',
      })))
      setCargando(false)
    }

    cargar()
  }, [router])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando la malla…</p>
      </div>
    )
  }

  return (
    <div className="space-y-9 px-5 pt-14 pb-28">
      <BotonVolver />

      <Encabezado
        sobretitulo={programa ?? 'Programa'}
        titulo="Malla curricular"
        descripcion="Todos los módulos del programa, en el orden en que se cursan."
      />

      <Regla delay={60} />

      {modulos.length === 0 ? (
        <p className="text-sm text-zr-text-muted">
          Todavía no tienes un programa asignado. Cuando administración te lo
          asigne, aquí verás la malla completa.
        </p>
      ) : (
        <ol className="space-y-3">
          {modulos.map((m) => (
            <li
              key={m.id}
              className={`zr-card p-5 ${m.estado === 'actual' ? 'border-zr-blue' : ''}`}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                    m.estado === 'cursado'
                      ? 'bg-zr-success/15 text-zr-success'
                      : m.estado === 'actual'
                        ? 'bg-zr-blue text-white'
                        : 'bg-zr-surface text-zr-text-muted'
                  }`}
                >
                  {m.orden}
                </span>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-zr-text">{m.nombre}</p>
                    {m.estado === 'actual' && <Etiqueta tono="info">Cursando ahora</Etiqueta>}
                    {m.estado === 'cursado' && <Etiqueta tono="exito">Cursado</Etiqueta>}
                    {m.homologado && <Etiqueta tono="neutro">Homologado INCES</Etiqueta>}
                  </div>

                  {m.descripcion && (
                    <p className="text-sm leading-relaxed text-zr-text-muted">{m.descripcion}</p>
                  )}

                  <p className="text-xs text-zr-text-muted">
                    {m.semanas} {m.semanas === 1 ? 'semana' : 'semanas'}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
