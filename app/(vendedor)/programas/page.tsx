'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'

interface Cohorte {
  id: string
  name: string
  sede: string | null
  turno: string | null
  misEstudiantes: number
}

interface Programa {
  id: string
  name: string
  cohortes: Cohorte[]
}

export default function ProgramasVendedor() {
  const router = useRouter()
  const [programas, setProgramas] = useState<Programa[]>([])
  const [cargando, setCargando] = useState(true)

  const [creando, setCreando] = useState<string | null>(null) // program_id
  const [nombreCohorte, setNombreCohorte] = useState('')
  const [sede, setSede] = useState('')
  const [turno, setTurno] = useState<'mañana' | 'tarde'>('mañana')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [{ data: progs }, { data: mias }] = await Promise.all([
        supabase.from('programs').select('id, name, cohorts(id, name, sede, turno)').order('name'),
        supabase.from('students').select('cohort_id').eq('enrolled_by', user.id),
      ])

      const conteoPorCohorte = new Map<string, number>()
      for (const m of mias ?? []) {
        if (!m.cohort_id) continue
        conteoPorCohorte.set(m.cohort_id, (conteoPorCohorte.get(m.cohort_id) ?? 0) + 1)
      }

      const filas = (progs ?? []) as unknown as {
        id: string; name: string
        cohorts: { id: string; name: string; sede: string | null; turno: string | null }[]
      }[]

      setProgramas(filas.map((p) => ({
        id: p.id,
        name: p.name,
        cohortes: p.cohorts.map((c) => ({
          id: c.id, name: c.name, sede: c.sede, turno: c.turno,
          misEstudiantes: conteoPorCohorte.get(c.id) ?? 0,
        })),
      })))
      setCargando(false)
    }

    cargar()
  }, [router, version])

  async function crearCohorte(programId: string) {
    setGuardando(true)
    setError(null)

    const { error: fallo } = await createClient().from('cohorts').insert({
      program_id: programId,
      name: nombreCohorte.trim(),
      sede: sede.trim() || null,
      turno,
      status: 'activa',
    })

    if (fallo) {
      setError(fallo.message)
      setGuardando(false)
      return
    }

    setNombreCohorte(''); setSede(''); setTurno('mañana'); setCreando(null)
    setGuardando(false)
    setVersion((v) => v + 1)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <Encabezado sobretitulo="Ventas" titulo="Programas" descripcion="PTMA y PFTA, con sus cohortes activas" />
      <Regla delay={60} />

      {programas.map((p, i) => (
        <Seccion key={p.id} numero={i + 1} titulo={p.name} delay={100 + i * 60}>
          <div className="space-y-3">
            {p.cohortes.length === 0 && (
              <p className="zr-card p-5 text-sm text-zr-text-muted">Todavía no hay cohortes en este programa.</p>
            )}
            {p.cohortes.map((c) => (
              <div key={c.id} className="zr-card flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zr-text">{c.name}</p>
                  <p className="mt-0.5 text-xs text-zr-text-muted">
                    {c.sede ?? '—'} · {c.turno ?? '—'}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold tabular-nums text-zr-blue-mid">
                  {c.misEstudiantes} inscritos por mí
                </span>
              </div>
            ))}

            {creando === p.id ? (
              <div className="zr-card space-y-4 p-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zr-text">Nombre de la cohorte</label>
                  <input
                    value={nombreCohorte}
                    onChange={(e) => setNombreCohorte(e.target.value)}
                    placeholder={`${p.name.split(' ')[0]}-2027-I`}
                    className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zr-text">Sede</label>
                  <input
                    value={sede}
                    onChange={(e) => setSede(e.target.value)}
                    placeholder="San Antonio de Los Altos / UCV"
                    className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zr-text">Turno</label>
                  <select
                    value={turno}
                    onChange={(e) => setTurno(e.target.value as 'mañana' | 'tarde')}
                    className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
                  >
                    <option value="mañana">Mañana</option>
                    <option value="tarde">Tarde</option>
                  </select>
                </div>
                {error && <p className="text-sm font-medium text-zr-error">{error}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => setCreando(null)}
                    className="min-h-14 flex-1 rounded-lg border border-zr-border text-base font-semibold text-zr-text"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => crearCohorte(p.id)}
                    disabled={!nombreCohorte.trim() || guardando}
                    className="min-h-14 flex-1 rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
                  >
                    {guardando ? 'Creando…' : 'Crear'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreando(p.id)}
                className="zr-card zr-card-interactive flex min-h-14 w-full items-center justify-center px-6 text-sm font-bold text-zr-blue"
              >
                + Nueva cohorte de {p.name.split(' ')[0]}
              </button>
            )}
          </div>
        </Seccion>
      ))}
    </div>
  )
}
