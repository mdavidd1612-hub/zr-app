'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { BloqueCuenta } from '@/components/ui/BloqueCuenta'
import type { UserRole } from '@/lib/types'

interface Perfil {
  nombre: string
  cedula: string
  rol: UserRole
  correo: string | null
}

interface Inscrito {
  full_name: string
  student_code: string | null
  cohort_name: string | null
}

export default function PerfilVendedor() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [inscritos, setInscritos] = useState<Inscrito[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, cedula, role, contact_email')
        .eq('id', user.id)
        .single()

      if (p) {
        setPerfil({ nombre: p.full_name, cedula: p.cedula, rol: p.role as UserRole, correo: p.contact_email })
      }

      const { data: est } = await supabase
        .from('students')
        .select('student_code, profiles(full_name), cohorts(name)')
        .eq('enrolled_by', user.id)
        .order('created_at', { ascending: false })

      const filas = (est ?? []) as unknown as {
        student_code: string | null
        profiles: { full_name: string } | null
        cohorts: { name: string } | null
      }[]

      setInscritos(filas.map((f) => ({
        full_name: f.profiles?.full_name ?? '—',
        student_code: f.student_code,
        cohort_name: f.cohorts?.name ?? null,
      })))

      setCargando(false)
    }

    cargar()
  }, [router])

  if (cargando || !perfil) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <header className="animate-rise">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Mi cuenta</p>
        <h1 className="zr-display mt-3 text-4xl text-zr-text">{perfil.nombre}</h1>
      </header>

      <Regla delay={60} />

      <Seccion numero={1} titulo="Cuenta" delay={120}>
        <BloqueCuenta nombre={perfil.nombre} cedula={perfil.cedula} rol={perfil.rol} correo={perfil.correo} />
      </Seccion>

      <Seccion numero={2} titulo={`Mis inscripciones (${inscritos.length})`} delay={200}>
        {inscritos.length === 0 ? (
          <p className="zr-card p-5 text-sm text-zr-text-muted">Todavía no has inscrito a nadie.</p>
        ) : (
          <div className="zr-card divide-y divide-zr-border">
            {inscritos.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zr-text">{i.full_name}</p>
                  <p className="mt-0.5 truncate text-xs text-zr-text-muted">{i.cohort_name ?? 'Sin cohorte'}</p>
                </div>
                <span className="shrink-0 text-xs font-bold tabular-nums text-zr-blue-mid">{i.student_code}</span>
              </div>
            ))}
          </div>
        )}
      </Seccion>
    </div>
  )
}
