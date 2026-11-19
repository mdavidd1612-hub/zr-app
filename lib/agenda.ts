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

export async function cargarAgenda(supabase: SupabaseClient): Promise<Agenda> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rol: null, items: [] }
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const rol = (perfil?.role as string | undefined) ?? null
  if (rol !== 'estudiante' && rol !== 'profesor') return { rol, items: [] }

  const items: ItemAgenda[] = []

  // Clases: hora, módulo, profesor y salón (fn_agenda_clases, migración 217)
  const { data: clases } = await supabase.rpc('fn_agenda_clases' as never, { p_semanas: 8 } as never)
  for (const c of ((clases ?? []) as unknown as { class_date: string; hora: string | null; modulo: string | null; profesor: string | null; salon: string | null; cohort_id: string; cohort_name: string }[])) {
    const partes = [c.hora, rol === 'estudiante' ? c.profesor : null, c.salon ? `Salón: ${c.salon}` : 'Salón por confirmar'].filter(Boolean)
    items.push({
      id: `clase-${c.cohort_id}-${c.class_date}`,
      fecha: `${c.class_date}T12:00:00`,
      titulo: rol === 'profesor' ? `Clase · ${c.cohort_name}${c.modulo ? ` · ${c.modulo}` : ''}` : `Clase${c.modulo ? ` · ${c.modulo}` : ''}`,
      tipo: 'clase',
      detalle: partes.join(' · '),
    })
  }

  // Profesor: fechas de sus módulos (cuándo abre cada unidad, exámenes y entregas)
  if (rol === 'profesor') {
    const { data: asig } = await supabase.from('teacher_module_assignments').select('module_id').eq('teacher_id', user.id)
    const mods = Array.from(new Set((asig ?? []).map((a) => a.module_id)))
    if (mods.length > 0) {
      const { data } = await supabase
        .from('calendar_events')
        .select('id, source_type, source_id, title, event_at')
        .in('module_id', mods)
        .order('event_at', { ascending: true })
      const rotulo: Record<string, { pre: string; det: string; ruta: (id: string) => string }> = {
        unit_open: { pre: 'Se abre la unidad', det: 'Ten el material cargado y aprobado', ruta: (id) => `/unidades-docente/${id}` },
        unit_close: { pre: 'Se cierra la unidad', det: 'Último día para que los estudiantes entren', ruta: (id) => `/unidades-docente/${id}` },
        exam: { pre: 'Examen', det: 'Fecha del examen; revisa y califica', ruta: (id) => `/calificar/${id}` },
        assignment: { pre: 'Entrega de tarea', det: 'Fecha límite; después hay que calificar', ruta: (id) => `/unidades-docente/tarea/${id}` },
      }
      for (const e of (data ?? []) as { id: string; source_type: TipoAgenda; source_id: string; title: string; event_at: string }[]) {
        const r = rotulo[e.source_type]
        if (!r) continue
        items.push({ id: e.id, fecha: e.event_at, titulo: `${r.pre}: ${e.title}`, tipo: e.source_type, detalle: r.det, href: r.ruta(e.source_id) })
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
