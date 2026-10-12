'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

/**
 * Temario por módulo: qué debe impartir el profesor cada semana (guías de
 * aprendizaje del módulo). Solo los módulos vigentes de cada programa donde
 * está asignado; el siguiente aparece solo cuando llega su fecha.
 */

interface Guia {
  id: string
  semana: number
  orden: number
  tema: string
  antes: string | null
  practica: string | null
}

interface Bloque {
  clave: string
  titulo: string
  guias: Guia[]
}

export default function TemarioDocente() {
  const router = useRouter()
  const [bloques, setBloques] = useState<Bloque[]>([])
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
      const [{ data: mods }, { data: cohs }, { data: guias }] = await Promise.all([
        idsMod.length ? supabase.from('modules').select('id, name, order_index').in('id', idsMod) : Promise.resolve({ data: [] }),
        idsCoh.length ? supabase.from('cohorts').select('id, name, sede').in('id', idsCoh) : Promise.resolve({ data: [] }),
        idsMod.length
          ? supabase
              .from('learning_guides')
              .select('id, module_id, week_number, order_in_week, sub_competency_name, pre_practice_description, practice_description')
              .in('module_id', idsMod)
              .order('week_number')
              .order('order_in_week')
          : Promise.resolve({ data: [] }),
      ])
      if (!vigente) return

      const modPor = new Map(((mods ?? []) as unknown as { id: string; name: string; order_index: number }[]).map((m) => [m.id, m]))
      const cohPor = new Map(((cohs ?? []) as unknown as { id: string; name: string; sede: string | null }[]).map((c) => [c.id, c]))
      const guiasPor = new Map<string, Guia[]>()
      for (const g of (guias ?? []) as unknown as {
        id: string; module_id: string; week_number: number; order_in_week: number
        sub_competency_name: string; pre_practice_description: string | null; practice_description: string | null
      }[]) {
        const lista = guiasPor.get(g.module_id) ?? []
        lista.push({ id: g.id, semana: g.week_number, orden: g.order_in_week, tema: g.sub_competency_name, antes: g.pre_practice_description, practica: g.practice_description })
        guiasPor.set(g.module_id, lista)
      }

      setBloques(
        vigentes
          .filter((p) => modPor.has(p.module_id) && cohPor.has(p.cohort_id))
          .map((p) => {
            const m = modPor.get(p.module_id)!
            const c = cohPor.get(p.cohort_id)!
            return {
              clave: `${p.cohort_id}|${p.module_id}`,
              titulo: `${c.name}${c.sede ? ` · ${c.sede}` : ''} · Módulo ${m.order_index} · ${m.name}`,
              guias: guiasPor.get(p.module_id) ?? [],
            }
          }),
      )
      setCargando(false)
    }
    cargar()
    return () => { vigente = false }
  }, [router])

  if (cargando) return <PantallaEsqueleto />

  return (
    <div className="space-y-8 px-5 pb-10 pt-14">
      <BotonVolver href="/perfil-docente" />
      <Encabezado
        sobretitulo="Temario"
        titulo="Qué debo impartir"
        descripcion="Los temas de cada semana, de los módulos que dictas ahora. El siguiente módulo aparece cuando le toca."
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
          <section key={b.clave} className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zr-blue-mid">{b.titulo}</h2>
            {b.guias.length === 0 ? (
              <p className="text-sm text-zr-text-muted">Este módulo aún no tiene temario cargado.</p>
            ) : (
              b.guias.map((g) => (
                <div key={g.id} className="zr-card p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zr-text-muted">Semana {g.semana}</p>
                  <p className="mt-1 text-base font-semibold text-zr-text">{g.tema}</p>
                  {g.antes && <p className="mt-2 text-sm text-zr-text-muted"><span className="font-semibold text-zr-text">Antes de la práctica:</span> {g.antes}</p>}
                  {g.practica && <p className="mt-1.5 text-sm text-zr-text-muted"><span className="font-semibold text-zr-text">Práctica:</span> {g.practica}</p>}
                </div>
              ))
            )}
          </section>
        ))
      )}
    </div>
  )
}
