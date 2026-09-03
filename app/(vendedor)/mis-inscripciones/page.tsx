'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'

interface Inscrito {
  fullName: string
  studentCode: string | null
  cohortName: string | null
  programa: string
}

export default function MisInscripciones() {
  const router = useRouter()
  const [inscritos, setInscritos] = useState<Inscrito[]>([])
  const [programa, setPrograma] = useState<'todos' | 'PTMA' | 'PFTA'>('todos')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      // Misma nota que en perfil-vendedor: students tiene DOS relaciones con
      // profiles (id y enrolled_by) desde la migración 046, así que el embed
      // de profiles necesita el nombre exacto de la FK o PostgREST no sabe
      // cuál usar y la consulta vuelve vacía en silencio.
      const { data: est } = await supabase
        .from('students')
        .select('student_code, profiles!students_id_fkey(full_name), cohorts(name, programs(name))')
        .eq('enrolled_by', user.id)
        .order('created_at', { ascending: false })

      const filas = (est ?? []) as unknown as {
        student_code: string | null
        profiles: { full_name: string } | null
        cohorts: { name: string; programs: { name: string } | null } | null
      }[]

      setInscritos(filas.map((f) => ({
        fullName: f.profiles?.full_name ?? '—',
        studentCode: f.student_code,
        cohortName: f.cohorts?.name ?? null,
        programa: f.cohorts?.programs?.name?.startsWith('PTMA') ? 'PTMA' : f.cohorts?.programs?.name?.startsWith('PFTA') ? 'PFTA' : '—',
      })))
      setCargando(false)
    }

    cargar()
  }, [router])

  const filtrados = inscritos.filter((i) => programa === 'todos' || i.programa === programa)

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-5 pt-14 pb-10">
      <Encabezado sobretitulo="Ventas" titulo="Mis inscripciones" descripcion={`${inscritos.length} en total`} />
      <Regla delay={60} />

      <div className="flex gap-2">
        {(['todos', 'PTMA', 'PFTA'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPrograma(p)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              programa === p ? 'border-zr-blue bg-zr-blue/15 text-zr-blue' : 'border-zr-border text-zr-text-muted'
            }`}
          >
            {p === 'todos' ? 'Todos' : p}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <p className="zr-card p-8 text-center text-sm text-zr-text-muted">
          {inscritos.length === 0 ? 'Todavía no has inscrito a nadie.' : 'Nada en este programa.'}
        </p>
      ) : (
        <div className="zr-card divide-y divide-zr-border">
          {filtrados.map((i, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zr-text">{i.fullName}</p>
                <p className="mt-0.5 truncate text-xs text-zr-text-muted">{i.cohortName ?? 'Sin programa'}</p>
              </div>
              <span className="shrink-0 text-xs font-bold tabular-nums text-zr-blue-mid">{i.studentCode}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
