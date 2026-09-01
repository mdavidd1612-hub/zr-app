'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'

interface Solicitud {
  id: string
  razon: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  solicitadoHace: string
  estudiante: string
  examen: string
  attemptId: string
  examId: string
}

function hace(iso: string): string {
  const horas = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (horas < 1) return 'hace minutos'
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return `hace ${dias} día${dias > 1 ? 's' : ''}`
}

export default function Rehabilitaciones() {
  const router = useRouter()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(true)
  const [respondiendo, setRespondiendo] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      // Solo los exámenes de este profesor
      const { data: misExamenes } = await supabase
        .from('exams').select('id').eq('teacher_id', user.id)
      const misIds = (misExamenes ?? []).map(e => e.id)

      if (misIds.length === 0) { setCargando(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('exam_rehabilitation_requests')
        .select(`
          id, reason, status, requested_at,
          exams(title),
          exam_attempts!inner(
            id,
            students(profiles!students_id_fkey(full_name))
          )
        `)
        .in('exam_id', misIds)
        .order('requested_at', { ascending: false })

      if (error) console.error(error.message)

      const filas = data as unknown as {
        id: string; reason: string; status: string; requested_at: string
        exams: { title: string } | null
        exam_attempts: {
          id: string
          students: { profiles: { full_name: string } | null } | null
        } | null
      }[] | null

      setSolicitudes(
        (filas ?? []).map(s => ({
          id: s.id,
          razon: s.reason,
          estado: s.status as Solicitud['estado'],
          solicitadoHace: hace(s.requested_at),
          estudiante: s.exam_attempts?.students?.profiles?.full_name ?? 'Estudiante',
          examen: s.exams?.title ?? 'Examen',
          attemptId: s.exam_attempts?.id ?? '',
          examId: '',
        })),
      )
      setCargando(false)
    }

    cargar()
  }, [router])

  async function responder(id: string, accion: 'aprobada' | 'rechazada') {
    setRespondiendo(id)
    setError(null)

    const { error: fallo } = await createClient().functions.invoke('respond-rehabilitation', {
      body: { requestId: id, accion, responseNote: nota || null },
    })

    if (fallo) {
      setError('No se pudo procesar la solicitud. Inténtalo otra vez.')
      setRespondiendo(null)
      return
    }

    setSolicitudes(prev =>
      prev.map(s => s.id === id ? { ...s, estado: accion } : s)
    )
    setNota('')
    setRespondiendo(null)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-zr-text-muted">Cargando solicitudes…</p>
      </div>
    )
  }

  const pendientes = solicitudes.filter(s => s.estado === 'pendiente')
  const respondidas = solicitudes.filter(s => s.estado !== 'pendiente')

  return (
    <div className="space-y-11 px-5 pt-14 pb-24">
      <Encabezado
        sobretitulo="Exámenes"
        titulo="Rehabilitaciones"
        descripcion={pendientes.length === 0
          ? 'Ninguna solicitud pendiente'
          : `${pendientes.length} solicitud${pendientes.length > 1 ? 'es' : ''} esperando tu respuesta`}
      />

      <Regla delay={60} />

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {solicitudes.length === 0 ? (
        <div className="zr-card animate-rise p-10 text-center" style={{ animationDelay: '120ms' }}>
          <p className="text-lg font-semibold text-zr-text">Sin solicitudes</p>
          <p className="mt-3 text-sm text-zr-text-muted">
            Cuando un estudiante abandone un examen y solicite una nueva oportunidad, aparecerá aquí.
          </p>
        </div>
      ) : (
        <>
          {pendientes.length > 0 && (
            <div className="space-y-5">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-text-muted">
                Pendientes
              </h2>
              {pendientes.map((s, i) => (
                <div
                  key={s.id}
                  className="zr-card animate-rise space-y-4 p-6"
                  style={{ animationDelay: `${120 + i * 60}ms` }}
                >
                  <div>
                    <p className="text-base font-bold text-zr-text">{s.estudiante}</p>
                    <p className="text-sm text-zr-text-muted">{s.examen} · {s.solicitadoHace}</p>
                  </div>

                  <div className="rounded-lg border border-zr-border bg-zr-bg px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted mb-1">Motivo</p>
                    <p className="text-sm text-zr-text leading-relaxed">{s.razon}</p>
                  </div>

                  <textarea
                    value={respondiendo === s.id ? nota : ''}
                    onChange={(e) => setNota(e.target.value)}
                    onFocus={() => setRespondiendo(s.id)}
                    placeholder="Nota para el estudiante (opcional)…"
                    className="w-full min-h-16 resize-none rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-sm text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                  />

                  <div className="flex gap-3">
                    <button
                      onClick={() => responder(s.id, 'rechazada')}
                      disabled={respondiendo === s.id}
                      className="flex-1 rounded-lg border border-zr-error px-4 py-3 text-sm font-semibold text-zr-error disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => responder(s.id, 'aprobada')}
                      disabled={respondiendo === s.id}
                      className="flex-1 rounded-lg bg-zr-success px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {respondiendo === s.id ? 'Procesando…' : 'Aprobar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {respondidas.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-text-muted">
                Historial
              </h2>
              {respondidas.map(s => (
                <div key={s.id} className="zr-card flex items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zr-text">{s.estudiante}</p>
                    <p className="text-xs text-zr-text-muted">{s.examen}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    s.estado === 'aprobada'
                      ? 'bg-zr-success/15 text-zr-success'
                      : 'bg-zr-error/15 text-zr-error'
                  }`}>
                    {s.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
