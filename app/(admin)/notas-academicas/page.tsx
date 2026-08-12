'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

// Notas de CUALQUIER cohorte, para Dirección Académica y super_admin — el
// profesor solo ve la suya propia en /notas/[cohortId]. Se agrupa por
// programa (no por el código interno de la cohorte) porque es lo que tiene
// sentido para quien supervisa varios grupos a la vez.

interface Fila {
  id: string
  nombre: string
  moduloNombre: string | null
  programaNombre: string | null
  profesorNombre: string | null
  estudiantes: number
}

export default function NotasAcademicas() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [cohortes, setCohortes] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!vigente) return

      if (!esDireccionAcademica(perfil?.role as UserRole | undefined)) {
        setAutorizado(false)
        return
      }
      setAutorizado(true)

      const { data } = await supabase
        .from('cohorts')
        .select('id, name, modules(name, programs(name)), teachers(profiles(full_name)), students(count)')
        .order('name')

      if (!vigente) return

      type FilaCruda = {
        id: string
        name: string
        modules: { name: string; programs: { name: string } | null } | null
        teachers: { profiles: { full_name: string } | null } | null
        students: { count: number }[]
      }

      setCohortes(
        ((data ?? []) as unknown as FilaCruda[]).map((c) => ({
          id: c.id,
          nombre: c.name,
          moduloNombre: c.modules?.name ?? null,
          programaNombre: c.modules?.programs?.name ?? null,
          profesorNombre: c.teachers?.profiles?.full_name ?? null,
          estudiantes: c.students?.[0]?.count ?? 0,
        })),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  if (autorizado === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg px-5 text-center">
        <p className="text-sm text-zr-text-muted">Esta pantalla es solo para Dirección Académica.</p>
      </div>
    )
  }

  if (cargando || autorizado === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando cohortes…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <BotonVolver href="/panel" />

      <Encabezado sobretitulo="Dirección Académica" titulo="Notas" descripcion="Calificaciones por cohorte, agrupadas por programa" />

      <Regla delay={60} />

      {cohortes.length === 0 ? (
        <EstadoVacio titulo="Sin cohortes" explicacion="Todavía no hay ninguna cohorte creada." />
      ) : (
        <div className="space-y-3">
          {cohortes.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/notas-academicas/${c.id}`)}
              className="zr-card zr-card-interactive flex w-full items-center justify-between gap-3 p-5 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-zr-text">
                  {c.programaNombre ?? c.nombre}
                </p>
                <p className="mt-1 truncate text-sm text-zr-text-muted">
                  {c.moduloNombre ? `${c.moduloNombre} · ` : ''}{c.nombre}
                </p>
                <p className="mt-1 text-xs text-zr-text-muted">
                  {c.profesorNombre ?? 'Sin profesor asignado'} · {c.estudiantes} estudiante{c.estudiantes === 1 ? '' : 's'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
