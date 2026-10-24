'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Encabezado, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

/**
 * Aula Virtual — entrega de una tarea en PDF. Reemplazar antes de la fecha
 * límite crea una versión nueva (migración 178); después, el servidor
 * rechaza el reemplazo pero la primera entrega tardía sí se acepta.
 */

interface Tarea {
  title: string
  instructions: string | null
  due_at: string | null
  max_mb: number
}

interface Entrega {
  id: string
  version: number
  file_path: string
  submitted_at: string
  grade: number | null
  feedback: string | null
}

export default function TareaDeUnidad() {
  const router = useRouter()
  const params = useParams()
  const assignmentId = params.assignmentId as string
  const inputRef = useRef<HTMLInputElement>(null)

  const [tarea, setTarea] = useState<Tarea | null>(null)
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [vencida, setVencida] = useState(false)

  async function cargar() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    setUserId(user.id)

    const { data: a } = await supabase
      .from('assignments').select('title, instructions, due_at, max_mb').eq('id', assignmentId).maybeSingle()
    if (!a) { router.back(); return }
    setTarea(a)
    setVencida(a.due_at ? new Date(a.due_at).getTime() < Date.now() : false)

    const { data: subs } = await supabase
      .from('submissions')
      .select('id, version, file_path, submitted_at, grade, feedback')
      .eq('assignment_id', assignmentId)
      .eq('student_id', user.id)
      .order('version', { ascending: false })
    setEntregas((subs ?? []) as Entrega[])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [assignmentId]) // eslint-disable-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps

  async function subirPDF(archivo: File) {
    setError(null)
    if (archivo.type !== 'application/pdf') {
      setError('Solo se aceptan archivos PDF.')
      return
    }
    if (tarea && archivo.size > tarea.max_mb * 1024 * 1024) {
      setError(`El archivo pesa más de ${tarea.max_mb} MB.`)
      return
    }
    setSubiendo(true)
    const supabase = createClient()
    const ruta = `${userId}/${assignmentId}-${crypto.randomUUID()}.pdf`

    const { error: subErr } = await supabase.storage
      .from('tareas')
      .upload(ruta, archivo, { contentType: 'application/pdf' })

    if (subErr) {
      setError('No se pudo subir el archivo. Intenta de nuevo.')
      setSubiendo(false)
      return
    }

    // La validación real del tipo (no solo la extensión) y el servidor
    // deciden si se acepta (fecha límite, versión) -- el insert puede
    // rechazarse con el mensaje real del disparador (178).
    const { error: insErr } = await supabase.from('submissions').insert({
      assignment_id: assignmentId,
      student_id: userId,
      file_path: ruta,
      mime_type: 'application/pdf',
      size_bytes: archivo.size,
    })

    if (insErr) {
      setError(insErr.message)
    } else {
      await cargar()
    }
    setSubiendo(false)
  }

  if (cargando || !tarea) return <PantallaEsqueleto />

  const ultima = entregas[0]

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-11">
        <BotonVolver href={`/unidades/${params.unitId}`} />

        <Encabezado sobretitulo="Tarea" titulo={tarea.title} descripcion={tarea.instructions ?? undefined} />

        <Regla delay={60} />

        <Seccion numero={1} titulo="Fecha límite" delay={100}>
          <div className="zr-card p-5">
            <p className="text-sm text-zr-text">
              {tarea.due_at
                ? new Date(tarea.due_at).toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' })
                : 'Sin fecha límite'}
            </p>
            {vencida && (
              <p className="mt-2">
                <Etiqueta tono="aviso">Ya pasó la fecha — tu primera entrega se acepta tardía; no podrás reemplazarla.</Etiqueta>
              </p>
            )}
          </div>
        </Seccion>

        <Regla delay={140} />

        <Seccion numero={2} titulo={ultima ? 'Reemplazar entrega' : 'Entregar'} delay={180}>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subirPDF(f) }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-50"
          >
            {subiendo ? 'Subiendo…' : ultima ? 'Subir otra versión (PDF)' : 'Subir mi tarea (PDF)'}
          </button>
          {error && (
            <p className="mt-3 rounded-lg border border-zr-error/30 bg-zr-error/10 px-4 py-3 text-sm text-zr-error">
              {error}
            </p>
          )}
        </Seccion>

        {entregas.length > 0 && (
          <>
            <Regla delay={220} />
            <Seccion numero={3} titulo="Tus entregas" delay={260}>
              <div className="space-y-3">
                {entregas.map((e) => (
                  <div key={e.id} className="zr-card p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-zr-text">Versión {e.version}</p>
                      {e.grade !== null ? (
                        <Etiqueta tono="exito">Calificada: {e.grade}</Etiqueta>
                      ) : (
                        <Etiqueta tono="info">Entregada</Etiqueta>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zr-text-muted">
                      {new Date(e.submitted_at).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    {e.feedback && (
                      <p className="mt-3 rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-sm text-zr-text">
                        {e.feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Seccion>
          </>
        )}
      </div>
    </div>
  )
}
