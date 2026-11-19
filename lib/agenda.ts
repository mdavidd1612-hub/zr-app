import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Agenda compartida (18-nov-2026): la usan el calendario completo del estudiante
 * y el calendario flotante de estudiante y profesor. Junta los eventos del Aula
 * Virtual (calendar_events: unidades, exámenes y tareas) con las clases de los
 * próximos sábados y su salón (cohort_room_days, migración 216). Solo lee.
 */

export type TipoAgenda = 'clase' | 'exam' | 'assignment' | 'unit_open' | 'unit_close'

export interface ItemAgenda {
  id: string
  fecha: string // ISO
  titulo: string
  tipo: TipoAgenda
  detalle?: string
  href?: string | null
}

export interface Agenda {
  rol: string | null
  items: ItemAgenda[]
}

function proximosSabados(n: number): string[] {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7))
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d)
    x.setDate(d.getDate() + i * 7)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  })
}

export async function cargarAgenda(supabase: SupabaseClient): Promise<Agenda> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rol: null, items: [] }
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const rol = (perfil?.role as string | undefined) ?? null
  if (rol !== 'estudiante' && rol !== 'profesor') return { rol, items: [] }

  const items: ItemAgenda[] = []

  // Clases + salón
  let cohortes: { id: string; name: string }[] = []
  if (rol === 'estudiante') {
    const { data: est } = await supabase.from('students').select('cohort_id').eq('id', user.id).maybeSingle()
    if (est?.cohort_id) {
      const { data } = await supabase.from('cohorts').select('id, name').eq('id', est.cohort_id)
      cohortes = data ?? []
    }
  } else {
    const { data } = await supabase.from('cohorts').select('id, name').eq('teacher_id', user.id).eq('status', 'activa')
    cohortes = data ?? []
  }
  if (cohortes.length > 0) {
    const { data: filas } = await supabase
      .from('cohort_room_days' as never)
      .select('cohort_id, class_date, rooms(nombre)')
      .in('cohort_id', cohortes.map((c) => c.id))
    const dias = (filas ?? []) as unknown as { cohort_id: string; class_date: string; rooms: { nombre: string } | { nombre: string }[] | null }[]
    const nombreDe = (r: { nombre: string } | { nombre: string }[] | null) => (Array.isArray(r) ? r[0]?.nombre : r?.nombre)
    for (const c of cohortes) {
      const propios = dias.filter((d) => d.cohort_id === c.id).sort((a, b) => b.class_date.localeCompare(a.class_date))
      for (const f of proximosSabados(8)) {
        const vigente = propios.find((d) => d.class_date <= f)
        const salon = vigente ? nombreDe(vigente.rooms) : undefined
        items.push({
          id: `clase-${c.id}-${f}`,
          fecha: `${f}T12:00:00`,
          titulo: rol === 'profesor' ? `Clase · ${c.name}` : 'Clase del sábado',
          tipo: 'clase',
          detalle: salon ? `Salón: ${salon}` : 'Salón por confirmar',
        })
      }
    }
  }

  // Eventos del Aula Virtual (solo estudiante: RLS los acota a su módulo)
  if (rol === 'estudiante') {
    const { data } = await supabase
      .from('calendar_events')
      .select('id, source_type, source_id, title, event_at')
      .order('event_at', { ascending: true })
    const filas = (data ?? []) as { id: string; source_type: TipoAgenda; source_id: string; title: string; event_at: string }[]
    const idsTareas = filas.filter((e) => e.source_type === 'assignment').map((e) => e.source_id)
    let unidadDeTarea: Record<string, string> = {}
    if (idsTareas.length > 0) {
      const { data: tareas } = await supabase.from('assignments').select('id, unit_id').in('id', idsTareas)
      unidadDeTarea = Object.fromEntries((tareas ?? []).map((t) => [t.id, t.unit_id]))
    }
    for (const e of filas) {
      let href: string | null = null
      if (e.source_type === 'unit_open' || e.source_type === 'unit_close') href = `/unidades/${e.source_id}`
      else if (e.source_type === 'exam') href = `/examenes/${e.source_id}`
      else if (e.source_type === 'assignment') {
        const u = unidadDeTarea[e.source_id]
        href = u ? `/unidades/${u}/tarea/${e.source_id}` : null
      }
      items.push({ id: e.id, fecha: e.event_at, titulo: e.title, tipo: e.source_type, href })
    }
  }

  items.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return { rol, items }
}
