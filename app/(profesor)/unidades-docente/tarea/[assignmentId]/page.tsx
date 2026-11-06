'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Encabezado, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { IconoDescargar } from '@/components/ui/Iconos'

/**
 * Aula Virtual — el profesor ve la entrega más reciente de cada estudiante
 * (v_assignment_status, migración 178) y la califica. Descarga individual
 * vía URL firmada del bucket privado 'tareas', o todas en un ZIP (G-7).
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
  const [descargandoZip, setDescargandoZip] = useState(false)

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

  // G-7 (spec §8): descargar TODAS las entregas en un ZIP. Se arma en el
  // navegador — cada PDF se baja con su URL firmada del bucket privado y se
  // empaqueta con JSZip, nombrado "cédula nombre.pdf" para que el profesor
  // no tenga que abrir una por una.
  async function descargarTodasZip() {
    const conArchivo = filas.filter((f) => f.file_path)
    if (conArchivo.length === 0 || descargandoZip) return
    setDescargandoZip(true)
    try {
      const supabase = createClient()
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const usados = new Set<string>()
      for (const f of conArchivo) {
        const { data } = await supabase.storage.from('tareas').createSignedUrl(f.file_path!, 300)
        if (!data?.signedUrl) continue
        const resp = await fetch(data.signedUrl)
        if (!resp.ok) continue
        const blob = await resp.blob()
        const base = `${f.cedula} ${f.full_name}`.replace(/[^\p{L}\p{N} .\-_]/gu, '').trim() || f.student_id
        let nombre = `${base}.pdf`
        let n = 2
        while (usados.has(nombre)) nombre = `${base} (${n++}).pdf`
        usados.add(nombre)
        zip.file(nombre, blob)
      }
      const contenido = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(contenido)
      const a = document.createElement('a')
      a.href = url
      a.download = `Entregas - ${titulo || 'tarea'}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDescargandoZip(false)
    }
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

      <Encabezado
        sobretitulo="Calificar tarea"
        titulo={titulo}
        accion={
          filas.some((f) => f.file_path) ? (
            <button
              onClick={descargarTodasZip}
              disabled={descargandoZip}
              className="inline-flex items-center gap-2 rounded-full border border-zr-border px-4 py-2.5 text-xs font-bold text-zr-text transition-colors hover:border-zr-blue/40 disabled:opacity-50"
            >
              <IconoDescargar size={16} />
              {descargandoZip ? 'Preparando ZIP…' : 'Descargar todas (ZIP)'}
            </button>
          ) : undefined
        }
      />

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
