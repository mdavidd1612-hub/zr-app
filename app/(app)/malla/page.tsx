'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { IconoCheck } from '@/components/ui/Iconos'

/**
 * Malla curricular (especificacion-funcional-zrm-academy.md §9, Módulo 7):
 * todos los módulos del programa y el ORDEN en que se cursan — reemplaza a
 * "Mi módulo" del todo, a pedido explícito del coordinador ("que esa
 * sección sea una malla curricular"). El resumen es corto (2-3 frases) más
 * las competencias que se adquieren — nada de párrafos largos, "nadie los
 * lee" (pedido explícito, migración 079).
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
  competencias: string[] | null
  semanas: number
  fechas: string | null
  homologado: boolean
  estado: Estado
}

export default function MallaCurricular() {
  const router = useRouter()
  const [programa, setPrograma] = useState<string | null>(null)
  const [modulos, setModulos] = useState<ModuloMalla[]>([])
  const [horasPorSabado, setHorasPorSabado] = useState(4)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: config } = await supabase
        .from('system_config').select('value').eq('key', 'academia.horas_por_sabado').maybeSingle()
      if (config?.value != null) setHorasPorSabado(Number(config.value))

      const { data: est } = await supabase
        .from('students')
        .select('cohort_id, cohorts(current_module_id, programs(id, name))')
        .eq('id', user.id)
        .single()

      const cohorteId = (est as unknown as { cohort_id: string | null } | null)?.cohort_id ?? null
      const cohorte = (est as unknown as {
        cohorts: { current_module_id: string | null; programs: { id: string; name: string } | null } | null
      } | null)?.cohorts

      const columnas = 'id, order_index, name, description, competencias, duration_weeks, inces_homologado'

      if (!cohorte?.programs) {
        // Sin programa asignado todavía (o vista de recorrido de super_admin,
        // sin fila en students): el contenido de los módulos es el mismo
        // en PTMA y PFTA — se muestra la malla completa estática, sin
        // estados de cursado/actual (no hay una cohorte real de la que
        // derivarlos), en vez de un mensaje vacío.
        const { data: todos } = await supabase
          .from('modules').select(columnas).order('order_index', { ascending: true })

        interface ModuloCrudo {
          order_index: number; name: string; description: string | null; competencias: string[] | null
          duration_weeks: number; inces_homologado: boolean
        }
        const unicos = new Map<number, ModuloCrudo>()
        for (const m of (todos ?? []) as unknown as ModuloCrudo[]) {
          if (!unicos.has(m.order_index)) unicos.set(m.order_index, m)
        }

        setPrograma(null)
        setModulos(
          [...unicos.values()].map((m) => ({
            id: `estatico-${m.order_index}`,
            orden: m.order_index,
            nombre: m.name,
            descripcion: m.description,
            competencias: m.competencias,
            semanas: m.duration_weeks,
            fechas: null,
            homologado: m.inces_homologado,
            estado: 'pendiente',
          })),
        )
        setCargando(false)
        return
      }

      const { data: mods } = await supabase
        .from('modules')
        .select(columnas)
        .eq('program_id', cohorte.programs.id)
        .order('order_index', { ascending: true })

      // Con calendario (Configuración → Calendario de módulos) la malla sigue
      // el orden y las fechas REALES de la cohorte: el orden de cursado no es
      // igual para todas (p. ej. Performance y Aire acondicionado se
      // intercambian según el corte). Sin calendario, el orden del programa.
      const { data: cal } = cohorteId
        ? await supabase.from('cohort_module_calendar').select('module_id, start_date, end_date').eq('cohort_id', cohorteId).order('start_date')
        : { data: [] }

      setPrograma(cohorte.programs.name)

      if (cal && cal.length > 0) {
        const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })
        const dia = (iso: string, conAnio = false) =>
          new Date(`${iso}T12:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', ...(conAnio ? { year: 'numeric' } : {}) })
        const sabados = (ini: string, fin: string) => {
          let n = 0
          for (const d = new Date(`${ini}T12:00:00`); d.toISOString().slice(0, 10) <= fin; d.setDate(d.getDate() + 1)) if (d.getDay() === 6) n++
          return n
        }
        const porModulo = new Map<string, { tramos: { ini: string; fin: string }[] }>()
        for (const t of cal) {
          const e = porModulo.get(t.module_id) ?? { tramos: [] }
          e.tramos.push({ ini: t.start_date, fin: t.end_date })
          porModulo.set(t.module_id, e)
        }
        const enCalendario = [...porModulo.entries()]
          .sort((x, y) => x[1].tramos[0].ini.localeCompare(y[1].tramos[0].ini))
        // Módulo vigente: el del tramo con inicio más reciente que ya llegó.
        const vigente = [...cal].filter((t) => t.start_date <= hoy).sort((x, y) => y.start_date.localeCompare(x.start_date))[0]?.module_id ?? null
        const posVigente = enCalendario.findIndex(([id]) => id === vigente)
        const infoModulo = new Map((mods ?? []).map((m) => [m.id, m]))

        const lista: ModuloMalla[] = enCalendario.flatMap(([id, e], i) => {
          const m = infoModulo.get(id)
          if (!m) return []
          return [{
            id,
            orden: i + 1,
            nombre: m.name,
            descripcion: m.description,
            competencias: m.competencias,
            semanas: e.tramos.reduce((suma, t) => suma + sabados(t.ini, t.fin), 0),
            fechas: e.tramos.map((t, k) => `${dia(t.ini)} – ${dia(t.fin, k === e.tramos.length - 1)}`).join(' y '),
            homologado: m.inces_homologado,
            estado: (posVigente < 0 ? 'pendiente' : i < posVigente ? 'cursado' : i === posVigente ? 'actual' : 'pendiente') as Estado,
          }]
        })
        // Módulos del programa sin fecha en el calendario (p. ej. el proyecto integrador) van al final.
        const sinFecha = (mods ?? []).filter((m) => !porModulo.has(m.id)).map((m, k) => ({
          id: m.id,
          orden: lista.length + k + 1,
          nombre: m.name,
          descripcion: m.description,
          competencias: m.competencias,
          semanas: m.duration_weeks,
          fechas: null,
          homologado: m.inces_homologado,
          estado: 'pendiente' as Estado,
        }))
        setModulos([...lista, ...sinFecha])
        setCargando(false)
        return
      }

      // El orden del módulo actual marca el corte: lo anterior ya se cursó,
      // lo posterior está por cursar.
      const ordenActual = (mods ?? []).find((m) => m.id === cohorte.current_module_id)?.order_index ?? null

      setModulos((mods ?? []).map((m) => ({
        id: m.id,
        orden: m.order_index,
        nombre: m.name,
        descripcion: m.description,
        competencias: m.competencias,
        semanas: m.duration_weeks,
        fechas: null,
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
        sobretitulo={programa ?? 'Todos los programas'}
        titulo="Malla curricular"
        descripcion={
          programa
            ? 'Todos los módulos del programa, en el orden en que se cursan.'
            : 'Los 13 módulos del plan de estudio — el contenido es el mismo en PTMA y PFTA.'
        }
      />

      <Regla delay={60} />

      {modulos.length === 0 ? (
        <p className="text-sm text-zr-text-muted">
          Todavía no tienes un programa asignado. Cuando administración te lo
          asigne, aquí verás la malla completa.
        </p>
      ) : (
        <ol id="tour-malla" className="space-y-3">
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

                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-zr-text">{m.nombre}</p>
                    {m.estado === 'actual' && <Etiqueta tono="info">Cursando ahora</Etiqueta>}
                    {m.estado === 'cursado' && <Etiqueta tono="exito">Cursado</Etiqueta>}
                    {m.homologado && <Etiqueta tono="neutro">Homologado INCES</Etiqueta>}
                  </div>

                  {m.descripcion && (
                    <p className="text-sm leading-relaxed text-zr-text-muted">{m.descripcion}</p>
                  )}

                  {/* Lista completa, sin recortar (a pedido explícito del
                      coordinador, sept. 2026 — revierte el límite de 3 +
                      "+N más" que él mismo había pedido antes). */}
                  {m.competencias && m.competencias.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {m.competencias.map((c, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full border border-zr-blue/20 bg-zr-blue/8 px-2.5 py-1 text-xs font-medium text-zr-text"
                        >
                          <IconoCheck size={12} className="shrink-0 text-zr-blue-mid" />
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="pt-0.5 text-xs font-bold uppercase tracking-wide text-zr-blue-mid">
                    {m.semanas * horasPorSabado} horas académicas · {m.semanas} {m.semanas === 1 ? 'sábado' : 'sábados'}
                    {m.fechas ? ` · ${m.fechas}` : ''}
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
