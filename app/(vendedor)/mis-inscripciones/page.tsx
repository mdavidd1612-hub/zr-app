'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'

/**
 * R-31 · docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md
 *
 * Lo que ya tenía esta pantalla (lista + filtro por sigla) sirve para VER.
 * Lo que le faltaba para "llevar control" de verdad: saber si administración
 * ya validó cada inscripción (planilla firmada), cuándo se hizo, y poder
 * buscar una en concreto sin desplazarse por toda la lista.
 */

interface Inscrito {
  fullName: string
  cedula: string
  studentCode: string | null
  cohortName: string | null
  fecha: string | null
  validado: boolean
  siglas: string
}

export default function MisInscripciones() {
  const router = useRouter()
  const [inscritos, setInscritos] = useState<Inscrito[]>([])
  const [siglas, setSiglas] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
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
        .select('student_code, enrollment_date, validated_at, profiles!students_id_fkey(full_name, cedula), cohorts(name, programs(siglas))')
        .eq('enrolled_by', user.id)
        .order('created_at', { ascending: false })

      const filas = (est ?? []) as unknown as {
        student_code: string | null
        enrollment_date: string | null
        validated_at: string | null
        profiles: { full_name: string; cedula: string } | null
        cohorts: { name: string; programs: { siglas: string } | null } | null
      }[]

      setInscritos(filas.map((f) => ({
        fullName: f.profiles?.full_name ?? '—',
        cedula: f.profiles?.cedula ?? '',
        studentCode: f.student_code,
        cohortName: f.cohorts?.name ?? null,
        fecha: f.enrollment_date,
        validado: Boolean(f.validated_at),
        // Siglas reales de la base (migración 067), no adivinadas con
        // startsWith — ese era el mismo defecto que ya se corrigió en
        // set_student_code_calc(). Con una sede nueva, esto seguía roto.
        siglas: f.cohorts?.programs?.siglas ?? '—',
      })))
      setCargando(false)
    }

    cargar()
  }, [router])

  // Los tabs de programa salen de lo que el vendedor de verdad inscribió, no
  // de una lista fija de dos — así una sede nueva aparece sola, sin tocar
  // código.
  const siglasDisponibles = useMemo(
    () => [...new Set(inscritos.map((i) => i.siglas))].filter((s) => s !== '—').sort(),
    [inscritos],
  )

  const totalesPorSiglas = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const i of inscritos) mapa.set(i.siglas, (mapa.get(i.siglas) ?? 0) + 1)
    return mapa
  }, [inscritos])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return inscritos.filter((i) => {
      if (siglas !== 'todos' && i.siglas !== siglas) return false
      if (!q) return true
      return i.fullName.toLowerCase().includes(q) || i.cedula.toLowerCase().includes(q)
    })
  }, [inscritos, siglas, busqueda])

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

      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o cédula…"
        className="w-full rounded-lg border border-zr-border bg-zr-surface px-5 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSiglas('todos')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
            siglas === 'todos' ? 'border-zr-blue bg-zr-blue/15 text-zr-blue' : 'border-zr-border text-zr-text-muted'
          }`}
        >
          Todos · {inscritos.length}
        </button>
        {siglasDisponibles.map((s) => (
          <button
            key={s}
            onClick={() => setSiglas(s)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              siglas === s ? 'border-zr-blue bg-zr-blue/15 text-zr-blue' : 'border-zr-border text-zr-text-muted'
            }`}
          >
            {s} · {totalesPorSiglas.get(s) ?? 0}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <p className="zr-card p-8 text-center text-sm text-zr-text-muted">
          {inscritos.length === 0 ? 'Todavía no has inscrito a nadie.' : 'Nadie coincide con la búsqueda.'}
        </p>
      ) : (
        <div className="zr-card divide-y divide-zr-border">
          {filtrados.map((i, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zr-text">{i.fullName}</p>
                <p className="mt-0.5 truncate text-xs text-zr-text-muted">
                  {i.cohortName ?? 'Sin programa'}
                  {i.fecha && ` · ${new Date(i.fecha + 'T00:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="text-xs font-bold tabular-nums text-zr-blue-mid">{i.studentCode}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    i.validado
                      ? 'border-zr-success/40 bg-zr-success/15 text-zr-success'
                      : 'border-zr-warning/40 bg-zr-warning/15 text-zr-warning'
                  }`}
                >
                  {i.validado ? 'Validado' : 'Pendiente'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
