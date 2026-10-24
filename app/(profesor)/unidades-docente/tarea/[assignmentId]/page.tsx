'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Encabezado, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

/**
 * Aula Virtual — el profesor ve la entrega más reciente de cada estudiante
 * (v_assignment_status, migración 178) y la califica. Descarga individual
 * vía URL firmada del bucket privado 'tareas'.
 */

interface Fila {
  student_id: string
  cedula: string
  full_name: string
  submission_id: string | null
  file_path: string | null
  submitted_at: string | null
  grade: number | null
  status: string
}

const ETIQUETA: Record<string, { texto: string; tono: 'neutro' | 'exito' | 'aviso' | 'info' }> = {
  pendiente: { texto: 'Pendiente', tono: 'neutro' },
  entregada: { texto: 'Entregada', tono: 'info' },
  tardia: { texto: 'Tardía', tono: 'aviso' },
  calificada: { texto: 'Calificada', tono: 'exito' },
}

export default function CalificarTarea() {
  const router = useRouter()
  const params = useParams()
  const assignmentId = params.assignmentId as string

  const [titulo, setTitulo] = useState('')
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [guardandoId, setGuardandoId] = useState<string | null>(null)

  async function cargar() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const { data } = await supabase
      .from('v_assignment_status')
      .select('*')
      .eq('assignment_id', assignmentId)

    if (data && data.length > 0) setTitulo(data[0].assignment_title ?? '')
    setFilas((data ?? []) as unknown as Fila[])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [assignmentId]) // eslint-disable-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps

  async function descargar(filePath: string) {
    const supabase = createClient()
    const { data } = await supabase.storage.from('tareas').createSignedUrl(filePath, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function calificar(submissionId: string) {
    const valor = notas[submissionId]
    if (valor === undefined || valor === '') return
    setGuardandoId(submissionId)
    const supabase = createClient()
    await supabase.from('submissions').update({ grade: Number(valor) }).eq('id', submissionId)
    setGuardandoId(null)
    await cargar()
  }

  if (cargando) return <PantallaEsqueleto variante="tabla" />

  return (
    <div className="space-y-11 pb-20">
      <BotonVolver />

      <Encabezado sobretitulo="Calificar tarea" titulo={titulo} />

      <Regla delay={60} />

      <Seccion numero={1} titulo={`Entregas (${filas.length} estudiantes)`} delay={100}>
        <div className="space-y-3">
          {filas.map((f) => {
            const et = ETIQUETA[f.status] ?? ETIQUETA.pendiente
            return (
              <div key={f.student_id} className="zr-card space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-zr-text">{f.full_name}</p>
                    <p className="text-xs text-zr-text-muted">{f.cedula}</p>
                  </div>
                  <Etiqueta tono={et.tono}>{et.texto}</Etiqueta>
                </div>

                {f.file_path && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => descargar(f.file_path!)}
                      className="rounded-lg border border-zr-border px-4 py-2 text-xs font-bold text-zr-text"
                    >
                      Descargar PDF
                    </button>
                    {f.submitted_at && (
                      <p className="text-xs text-zr-text-muted">
                        {new Date(f.submitted_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                )}

                {f.submission_id && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={f.grade !== null ? String(f.grade) : 'Nota'}
                      value={notas[f.submission_id] ?? ''}
                      onChange={(e) => setNotas((n) => ({ ...n, [f.submission_id as string]: e.target.value }))}
                      className="min-h-11 w-24 rounded-lg border border-zr-border bg-zr-bg px-3 text-sm text-zr-text"
                    />
                    <button
                      onClick={() => calificar(f.submission_id as string)}
                      disabled={guardandoId === f.submission_id}
                      className="rounded-lg bg-zr-blue px-4 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {guardandoId === f.submission_id ? 'Guardando…' : 'Calificar'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Seccion>
    </div>
  )
}
