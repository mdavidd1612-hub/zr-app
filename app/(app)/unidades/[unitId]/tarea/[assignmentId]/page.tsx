'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Encabezado, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { IconoDocumento, IconoCheck, IconoReloj, IconoCalendario } from '@/components/ui/Iconos'
import { prepararArchivo } from '@/lib/subida'
import { descargarEventoICS } from '@/lib/ics'

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
  // El archivo elegido NO se sube de una: primero se muestra para que el
  // estudiante confirme (antes se subía al instante al elegirlo — riesgo de
  // mandar el archivo equivocado sin darse cuenta).
  const [archivoSel, setArchivoSel] = useState<File | null>(null)
  const [viendo, setViendo] = useState<string | null>(null)

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

  async function subirPDF(archivoOriginal: File) {
    setError(null)
    if (archivoOriginal.type !== 'application/pdf') {
      setError('Solo se aceptan archivos PDF.')
      return
    }
    setSubiendo(true)

    // Bug real de la reunión 7-nov-2026: la entrega de tareas subía el PDF
    // tal cual, sin pasar por el mismo comprimidor que ya tiene el material
    // del profesor -- un PDF pesado rechazaba con "excede el tamaño máximo"
    // en vez de intentar reducirlo primero.
    const { archivo } = await prepararArchivo(archivoOriginal)

    if (tarea && archivo.size > tarea.max_mb * 1024 * 1024) {
      setError(`El archivo pesa más de ${tarea.max_mb} MB incluso comprimido.`)
      setSubiendo(false)
      return
    }
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
      setArchivoSel(null)
      await cargar()
    }
    setSubiendo(false)
  }

  // Al elegir un archivo NO se sube: se valida y se deja a la vista para que
  // el estudiante confirme (ver nota en el estado archivoSel).
  function elegirArchivo(archivo: File) {
    setError(null)
    if (archivo.type !== 'application/pdf') {
      setError('Solo se aceptan archivos PDF.')
      return
    }
    if (tarea && archivo.size > tarea.max_mb * 1024 * 1024) {
      setError(`El archivo pesa más de ${tarea.max_mb} MB.`)
      return
    }
    setArchivoSel(archivo)
  }

  // Ver la propia entrega: URL firmada de corta vida del bucket privado.
  async function verPDF(filePath: string, id: string) {
    setViendo(id)
    const pestana = window.open('', '_blank')
    const { data } = await createClient().storage.from('tareas').createSignedUrl(filePath, 300)
    setViendo(null)
    if (!data?.signedUrl) { pestana?.close(); return }
    if (pestana) pestana.location.href = data.signedUrl
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  if (cargando || !tarea) return <PantallaEsqueleto />

  const ultima = entregas[0]

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-11">
        <BotonVolver href={`/unidades/${params.unitId}`} />

        <Encabezado sobretitulo="Tarea" titulo={tarea.title} descripcion={tarea.instructions ?? undefined} />

        <Regla delay={60} />

        {/* Fecha límite tejida sin cuadro: un rótulo y el dato. */}
        <div className="flex items-center gap-2 text-sm">
          <IconoReloj size={16} className="shrink-0 text-zr-text-muted" />
          <span className="text-zr-text-muted">Fecha límite:</span>
          <span className="font-semibold text-zr-text">
            {tarea.due_at
              ? new Date(tarea.due_at).toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' })
              : 'sin fecha'}
          </span>
        </div>
        {vencida && (
          <Etiqueta tono="aviso">Ya pasó la fecha — tu primera entrega se acepta tardía; no podrás reemplazarla.</Etiqueta>
        )}

        {tarea.due_at && !vencida && (
          <button
            onClick={() => descargarEventoICS({
              titulo: `Entregar: ${tarea.title}`,
              descripcion: tarea.instructions ?? undefined,
              inicio: new Date(tarea.due_at as string),
              nombreArchivo: `${tarea.title}.ics`,
            })}
            className="inline-flex items-center gap-2 rounded-full border border-zr-border px-4 py-2 text-xs font-bold text-zr-text transition-colors hover:border-zr-blue/40"
          >
            <IconoCalendario size={14} />
            Agregar a mi calendario
          </button>
        )}

        <Regla delay={140} />

        <Seccion numero={1} titulo={ultima ? 'Reemplazar entrega' : 'Entregar'} delay={180}>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) elegirArchivo(f) }}
          />

          {archivoSel ? (
            // Paso de confirmación: se ve qué archivo se va a entregar.
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-zr-blue/30 bg-zr-blue/10 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zr-blue/15 text-zr-blue-mid">
                  <IconoDocumento size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-zr-text">{archivoSel.name}</span>
                  <span className="text-xs text-zr-text-muted">{(archivoSel.size / (1024 * 1024)).toFixed(2)} MB · PDF</span>
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => subirPDF(archivoSel)}
                  disabled={subiendo}
                  className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-50"
                >
                  <IconoCheck size={18} />
                  {subiendo ? 'Enviando…' : 'Confirmar entrega'}
                </button>
                <button
                  onClick={() => { setArchivoSel(null); inputRef.current?.click() }}
                  disabled={subiendo}
                  className="min-h-14 rounded-lg border border-zr-border px-5 text-sm font-semibold text-zr-text disabled:opacity-50"
                >
                  Elegir otro
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-zr-blue text-base font-bold text-white"
            >
              <IconoDocumento size={18} />
              {ultima ? 'Elegir otra versión (PDF)' : 'Elegir mi tarea (PDF)'}
            </button>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-zr-error/30 bg-zr-error/10 px-4 py-3 text-sm text-zr-error">
              {error}
            </p>
          )}
        </Seccion>

        {entregas.length > 0 && (
          <>
            <Regla delay={220} />
            <Seccion numero={2} titulo="Tus entregas" delay={260}>
              <div className="divide-y divide-zr-border/60">
                {entregas.map((e) => (
                  <div key={e.id} className="space-y-2 py-4 first:pt-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-zr-text">Versión {e.version}</p>
                      {e.grade !== null ? (
                        <Etiqueta tono="exito">Calificada: {Number(e.grade).toFixed(2)}</Etiqueta>
                      ) : (
                        <Etiqueta tono="info">Entregada</Etiqueta>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-zr-text-muted">
                        {new Date(e.submitted_at).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      <button
                        onClick={() => verPDF(e.file_path, e.id)}
                        disabled={viendo === e.id}
                        className="text-xs font-bold text-zr-blue-mid disabled:opacity-50"
                      >
                        {viendo === e.id ? '…' : 'Ver mi PDF'}
                      </button>
                    </div>
                    {e.feedback && (
                      <p className="rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-sm text-zr-text">
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
