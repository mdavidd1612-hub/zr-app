'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select } from '@/components/ui/Select'

/**
 * Profesor de cada módulo de UN corte (cobertura), dentro de la ficha del
 * corte (20-nov-2026, a pedido del coordinador: "unifica dentro de la ficha
 * general del programa la cobertura"). Escribe en teacher_module_assignments,
 * igual que la pantalla /cobertura-modulos, que sigue existiendo.
 */
export function CoberturaCorte({ cohorteId }: { cohorteId: string }) {
  const [modulos, setModulos] = useState<{ id: string; nombre: string; orden: number }[]>([])
  const [profesores, setProfesores] = useState<{ id: string; nombre: string }[]>([])
  const [asig, setAsig] = useState<Map<string, string>>(new Map())
  const [guardando, setGuardando] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [tramos, setTramos] = useState<Map<string, { desde: string; hasta: string; virtual: boolean }>>(new Map())

  useEffect(() => {
    const supabase = createClient()
    supabase.from('cohorts').select('program_id').eq('id', cohorteId).maybeSingle().then(async ({ data: c }) => {
      if (!c) { setCargando(false); return }
      const [{ data: mods }, { data: profs }, { data: asigs }, { data: cal }] = await Promise.all([
        supabase.from('modules').select('id, name, order_index').eq('program_id', c.program_id).order('order_index'),
        supabase.from('profiles').select('id, full_name').eq('role', 'profesor').order('full_name'),
        supabase.from('teacher_module_assignments').select('teacher_id, module_id').eq('cohort_id', cohorteId),
        supabase.from('cohort_module_calendar').select('module_id, start_date, end_date, modalidad' as 'module_id, start_date, end_date').eq('cohort_id', cohorteId).order('start_date'),
      ])
      const t = new Map<string, { desde: string; hasta: string; virtual: boolean }>()
      for (const k of (cal ?? []) as unknown as { module_id: string; start_date: string; end_date: string; modalidad?: string }[]) {
        const ya = t.get(k.module_id)
        t.set(k.module_id, { desde: ya?.desde ?? k.start_date, hasta: k.end_date, virtual: k.modalidad === 'virtual' })
      }
      setTramos(t)
      setModulos((mods ?? []).map((m) => ({ id: m.id, nombre: m.name, orden: m.order_index })))
      setProfesores((profs ?? []).map((p) => ({ id: p.id, nombre: p.full_name })))
      setAsig(new Map(((asigs ?? []) as { teacher_id: string; module_id: string }[]).map((a) => [a.module_id, a.teacher_id])))
      setCargando(false)
    })
  }, [cohorteId])

  async function asignar(moduloId: string, profesorId: string) {
    setGuardando(moduloId)
    const supabase = createClient()
    await supabase.from('teacher_module_assignments').delete().eq('module_id', moduloId).eq('cohort_id', cohorteId)
    if (profesorId) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('teacher_module_assignments')
        .insert({ teacher_id: profesorId, module_id: moduloId, cohort_id: cohorteId, assigned_by: user?.id ?? null })
    }
    setAsig((prev) => {
      const copia = new Map(prev)
      if (profesorId) copia.set(moduloId, profesorId); else copia.delete(moduloId)
      return copia
    })
    setGuardando(null)
  }

  if (cargando) return <p className="text-sm text-zr-text-muted">Cargando módulos…</p>

  return (
    <div className="space-y-2">
      <p className="text-xs text-zr-text-muted">Quién da cada módulo en este corte. Lo que queda sin profesor se marca en amarillo.</p>
      {modulos.map((m) => {
        const actual = asig.get(m.id) ?? ''
        const t = tramos.get(m.id)
        const f = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
        return (
          <div key={m.id} className={`zr-card flex items-center justify-between gap-3 px-4 py-3 ${actual ? '' : 'border-zr-warning/40 bg-zr-warning/8'}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zr-text">{m.orden}. {m.nombre}</p>
              <p className="mt-0.5 text-[11px] text-zr-text-muted">
                {t ? `${f(t.desde)} → ${f(t.hasta)}${t.virtual ? ' · virtual' : ''}` : 'Sin fechas en el calendario'}
              </p>
            </div>
            <Select
              value={actual}
              onChange={(e) => asignar(m.id, e.target.value)}
              disabled={guardando === m.id}
              className="w-44 shrink-0 xl:w-52 rounded-lg border border-zr-border bg-zr-bg px-3 py-2 text-sm text-zr-text disabled:opacity-50"
            >
              <option value="">Sin profesor asignado</option>
              {profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Select>
          </div>
        )
      })}
    </div>
  )
}
