'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * Cobertura de módulos por profesor (pedido explícito del coordinador):
 * pantalla APARTE de Personal — solo Dirección Académica y super_admin.
 * Primero se elige una cohorte real (PTMA-2026-II, PFTA-2026-I…) en vez de
 * mostrar los catorce módulos de golpe; elegir una cohorte lleva al
 * programa al que pertenece, y ahí sí, módulo por módulo, se elige un
 * profesor. Escribe en teacher_module_assignments — la misma tabla que ya
 * usa el toggle de Personal, solo que aquí se ve "por módulo" en vez de
 * "por profesor", más fácil para ver qué quedó sin cubrir.
 */

interface Cohorte {
  id: string
  nombre: string
  programaId: string
  programaNombre: string
}

interface Modulo {
  id: string
  nombre: string
  orden: number
}

interface Profesor {
  id: string
  nombre: string
}

export default function CoberturaModulos() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [cargando, setCargando] = useState(true)
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [profesores, setProfesores] = useState<Profesor[]>([])
  const [cohorteId, setCohorteId] = useState<string | null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [asignaciones, setAsignaciones] = useState<Map<string, string>>(new Map())
  const [cargandoModulos, setCargandoModulos] = useState(false)
  const [guardando, setGuardando] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const rol = perfil?.role as UserRole | undefined
      if (!esDireccionAcademica(rol)) {
        setAutorizado(false)
        setCargando(false)
        return
      }
      setAutorizado(true)

      const [{ data: cohs }, { data: profs }] = await Promise.all([
        supabase
          .from('cohorts')
          .select('id, name, program_id, programs(name)')
          .eq('status', 'activa')
          .order('name'),
        supabase.from('profiles').select('id, full_name').eq('role', 'profesor').order('full_name'),
      ])

      setCohortes(
        ((cohs ?? []) as unknown as { id: string; name: string; program_id: string; programs: { name: string } | null }[])
          .map((c) => ({ id: c.id, nombre: c.name, programaId: c.program_id, programaNombre: c.programs?.name ?? '—' })),
      )
      setProfesores((profs ?? []).map((p) => ({ id: p.id, nombre: p.full_name })))
      setCargando(false)
    }

    cargar()
  }, [router])

  async function elegirCohorte(c: Cohorte) {
    setCohorteId(c.id)
    setCargandoModulos(true)
    const supabase = createClient()

    const [{ data: mods }, { data: asigs }] = await Promise.all([
      supabase.from('modules').select('id, name, order_index').eq('program_id', c.programaId).order('order_index'),
      supabase.from('teacher_module_assignments').select('teacher_id, module_id, modules!inner(program_id)').eq('modules.program_id', c.programaId),
    ])

    setModulos((mods ?? []).map((m) => ({ id: m.id, nombre: m.name, orden: m.order_index })))

    const mapa = new Map<string, string>()
    for (const a of (asigs ?? []) as { teacher_id: string; module_id: string }[]) {
      mapa.set(a.module_id, a.teacher_id)
    }
    setAsignaciones(mapa)
    setCargandoModulos(false)
  }

  async function asignarProfesor(moduloId: string, nuevoProfesorId: string) {
    setGuardando(moduloId)
    const supabase = createClient()

    await supabase.from('teacher_module_assignments').delete().eq('module_id', moduloId)

    if (nuevoProfesorId) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('teacher_module_assignments')
        .insert({ teacher_id: nuevoProfesorId, module_id: moduloId, assigned_by: user?.id ?? null })
    }

    setAsignaciones((prev) => {
      const copia = new Map(prev)
      if (nuevoProfesorId) copia.set(moduloId, nuevoProfesorId)
      else copia.delete(moduloId)
      return copia
    })
    setGuardando(null)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  if (!autorizado) {
    return (
      <div className="space-y-5 px-5 pt-14">
        <BotonVolver href="/panel" />
        <p className="text-sm text-zr-text-muted">Solo Dirección Académica o super_admin pueden entrar aquí.</p>
      </div>
    )
  }

  const cohorteActual = cohortes.find((c) => c.id === cohorteId) ?? null

  return (
    <div className="space-y-9 px-5 pb-16 pt-14">
      {cohorteActual ? (
        <button
          onClick={() => setCohorteId(null)}
          className="-ml-1 flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-zr-text-muted transition-colors active:text-zr-text"
        >
          ‹ Elegir otra cohorte
        </button>
      ) : (
        <BotonVolver href="/personal" />
      )}

      <Encabezado
        sobretitulo="Dirección académica"
        titulo="Cobertura de módulos"
        descripcion={
          cohorteActual
            ? `${cohorteActual.programaNombre} · ${cohorteActual.nombre}`
            : 'Elige una cohorte para ver y asignar el profesor de cada módulo.'
        }
      />

      <Regla delay={60} />

      {!cohorteActual ? (
        cohortes.length === 0 ? (
          <p className="text-sm text-zr-text-muted">No hay cohortes activas todavía.</p>
        ) : (
          <div className="space-y-3">
            {cohortes.map((c) => (
              <button
                key={c.id}
                onClick={() => elegirCohorte(c)}
                className="zr-card zr-card-interactive flex w-full items-center justify-between gap-3 p-5 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-zr-text">{c.nombre}</p>
                  <p className="mt-0.5 truncate text-sm text-zr-text-muted">{c.programaNombre}</p>
                </div>
                <span aria-hidden className="shrink-0 text-zr-text-muted">›</span>
              </button>
            ))}
          </div>
        )
      ) : cargandoModulos ? (
        <p className="text-sm text-zr-text-muted">Cargando módulos…</p>
      ) : (
        <div className="space-y-2">
          {modulos.map((m) => {
            const profesorActualId = asignaciones.get(m.id) ?? ''
            const sinCubrir = !profesorActualId
            const ocupado = guardando === m.id
            return (
              <div
                key={m.id}
                className={`zr-card flex items-center justify-between gap-3 p-4 ${sinCubrir ? 'border-zr-warning/40 bg-zr-warning/8' : ''}`}
              >
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-zr-text">
                  {m.orden}. {m.nombre}
                </p>
                <select
                  value={profesorActualId}
                  onChange={(e) => asignarProfesor(m.id, e.target.value)}
                  disabled={ocupado}
                  className="shrink-0 max-w-[50%] rounded-lg border border-zr-border bg-zr-bg px-3 py-2 text-sm text-zr-text disabled:opacity-50"
                >
                  <option value="">Sin profesor asignado</option>
                  {profesores.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
