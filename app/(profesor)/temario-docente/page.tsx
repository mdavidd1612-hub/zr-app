'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { IconoCheck } from '@/components/ui/Iconos'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

/**
 * Temario del profesor: sale tal cual de lo que ven los estudiantes en
 * "Mi módulo" y en la malla curricular (tabla `modules`: resumen,
 * competencias, duración). Así el profesor enseña exactamente lo que el
 * estudiante ve que va a aprender, sin una segunda fuente que mantener.
 *
 * Solo los módulos vigentes de cada programa donde está asignado; el
 * siguiente aparece solo cuando llega su fecha en el calendario.
 */

interface ModuloCrudo {
  id: string
  name: string
  order_index: number
  program_id: string | null
  resumen_largo: string | null
  description: string | null
  competencias: string[] | null
  duration_weeks: number
}

interface Bloque {
  clave: string
  programa: string
  titulo: string
  semanaActual: number | null
  duracionSemanas: number
  resumen: string | null
  competencias: string[]
}

interface ModuloMalla {
  id: string
  orden: number
  nombre: string
  descripcion: string | null
}

export default function TemarioDocente() {
  const router = useRouter()
  const [bloques, setBloques] = useState<Bloque[]>([])
  const [mallas, setMallas] = useState<{ programa: string; modulos: ModuloMalla[]; vigentes: Set<string> }[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: pares } = await supabase.rpc('mis_asignaciones_docente')
      const asignados = (pares ?? []) as unknown as { cohort_id: string; module_id: string }[]
      const estados = await Promise.all(
        asignados.map((p) => supabase.rpc('estado_modulo_cohorte', { p_cohort: p.cohort_id, p_module: p.module_id })),
      )
      const vigentes = asignados.filter((_, i) => ['en_curso', 'sin_calendario'].includes(String(estados[i].data)))

      const idsMod = [...new Set(vigentes.map((p) => p.module_id))]
      const idsCoh = [...new Set(vigentes.map((p) => p.cohort_id))]
      const columnas = 'id, name, order_index, program_id, resumen_largo, description, competencias, duration_weeks'
      const [{ data: mods }, { data: cohs }, { data: sesiones }] = await Promise.all([
        idsMod.length ? supabase.from('modules').select(columnas).in('id', idsMod) : Promise.resolve({ data: [] }),
        idsCoh.length ? supabase.from('cohorts').select('id, name, sede, programs(name)').in('id', idsCoh) : Promise.resolve({ data: [] }),
        idsCoh.length
          ? supabase.from('class_sessions').select('cohort_id, module_id, week_number, session_date').in('cohort_id', idsCoh).in('module_id', idsMod)
          : Promise.resolve({ data: [] }),
      ])

      const modPor = new Map(((mods ?? []) as unknown as ModuloCrudo[]).map((m) => [m.id, m]))
      const cohPor = new Map(
        ((cohs ?? []) as unknown as { id: string; name: string; sede: string | null; programs: { name: string } | null }[]).map((c) => [c.id, c]),
      )

      // Misma regla que "Mi módulo" del estudiante: la semana actual es la de
      // la sesión más cercana a hoy; antes de la primera clase, la 1.
      const hoy = new Date().toISOString().slice(0, 10)
      const semanaDe = (cohortId: string, moduleId: string): number | null => {
        const filas = ((sesiones ?? []) as unknown as { cohort_id: string; module_id: string; week_number: number; session_date: string }[])
          .filter((s) => s.cohort_id === cohortId && s.module_id === moduleId)
          .sort((a, b) => a.session_date.localeCompare(b.session_date))
        if (filas.length === 0) return null
        return (filas.find((s) => s.session_date >= hoy) ?? filas[filas.length - 1]).week_number
      }

      const lista: Bloque[] = vigentes
        .filter((p) => modPor.has(p.module_id) && cohPor.has(p.cohort_id))
        .map((p) => {
          const m = modPor.get(p.module_id)!
          const c = cohPor.get(p.cohort_id)!
          return {
            clave: `${p.cohort_id}|${p.module_id}`,
            programa: c.programs?.name ?? '',
            titulo: `${c.name}${c.sede ? ` · ${c.sede}` : ''} · Módulo ${m.order_index} · ${m.name}`,
            semanaActual: semanaDe(p.cohort_id, p.module_id),
            duracionSemanas: m.duration_weeks,
            resumen: m.resumen_largo?.split(/\n\s*\n/)[0]?.trim() || m.description,
            competencias: m.competencias ?? [],
          }
        })

      // Malla curricular de cada programa donde el profesor tiene módulos
      // vigentes (la misma lista que ve el estudiante).
      const idsPrograma = [...new Set([...modPor.values()].map((m) => m.program_id).filter((x): x is string => !!x))]
      const { data: todos } = idsPrograma.length
        ? await supabase.from('modules').select('id, name, order_index, description, program_id, programs(name)').in('program_id', idsPrograma).order('order_index')
        : { data: [] }
      if (!vigente) return

      const porPrograma = new Map<string, { programa: string; modulos: ModuloMalla[]; vigentes: Set<string> }>()
      for (const m of (todos ?? []) as unknown as { id: string; name: string; order_index: number; description: string | null; program_id: string; programs: { name: string } | null }[]) {
        const g = porPrograma.get(m.program_id) ?? { programa: m.programs?.name ?? '', modulos: [], vigentes: new Set<string>() }
        g.modulos.push({ id: m.id, orden: m.order_index, nombre: m.name, descripcion: m.description })
        if (idsMod.includes(m.id)) g.vigentes.add(m.id)
        porPrograma.set(m.program_id, g)
      }

      setBloques(lista)
      setMallas([...porPrograma.values()])
      setCargando(false)
    }
    cargar()
    return () => { vigente = false }
  }, [router])

  if (cargando) return <PantallaEsqueleto />

  return (
    <div className="space-y-8 px-5 pb-28 pt-14">
      <BotonVolver href="/perfil-docente" />
      <Encabezado
        sobretitulo="Temario"
        titulo="Qué debo impartir"
        descripcion="Es lo mismo que ven tus estudiantes en «Mi módulo» y en la malla curricular. Solo aparecen los módulos que dictas ahora; el siguiente aparece cuando le toca."
      />
      <Regla />

      {bloques.length === 0 ? (
        <div className="zr-card p-6">
          <p className="text-base font-semibold text-zr-text">Sin módulos vigentes</p>
          <p className="mt-2 text-sm text-zr-text-muted">
            Cuando empiece un módulo que tengas asignado, su temario aparece aquí.
          </p>
        </div>
      ) : (
        bloques.map((b) => (
          <section key={b.clave} className="space-y-4">
            <div className="overflow-hidden rounded-xl bg-gradient-to-br from-zr-blue-deep to-zr-blue p-5 text-white">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                {b.semanaActual ? `Semana ${b.semanaActual} de ${b.duracionSemanas}` : `${b.duracionSemanas} semanas`}
              </p>
              <p className="zr-display text-lg">{b.titulo}</p>
            </div>
            {b.resumen ? (
              <p className="zr-card p-5 text-sm leading-relaxed text-zr-text-muted">{b.resumen}</p>
            ) : b.competencias.length === 0 ? (
              <p className="text-sm text-zr-text-muted">Todavía no se ha cargado el contenido de este módulo.</p>
            ) : null}
            {b.competencias.length > 0 && (
              <ul className="space-y-1.5">
                {b.competencias.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zr-text">
                    <IconoCheck size={14} className="mt-0.5 shrink-0 text-zr-blue-mid" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}

      {mallas.map((g) => (
        <section key={g.programa} className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zr-blue-mid">Malla curricular · {g.programa}</h2>
          {g.modulos.map((m) => (
            <div key={m.id} className={`zr-card p-4 ${g.vigentes.has(m.id) ? 'border-zr-blue/40' : ''}`}>
              <p className="text-sm font-semibold text-zr-text">
                {m.orden}. {m.nombre}
                {g.vigentes.has(m.id) && <span className="ml-2 text-[11px] font-bold uppercase text-zr-blue-mid">el tuyo</span>}
              </p>
              {m.descripcion && <p className="mt-1 text-sm text-zr-text-muted">{m.descripcion}</p>}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
