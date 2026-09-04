'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * T-401 · Subida de material de estudio por el profesor.
 *
 * PDF o PowerPoint. El archivo va al bucket privado 'contenido'; la fila en
 * content_items es lo que decide si el estudiante lo ve — is_published en
 * falso lo deja como borrador aunque el archivo ya esté subido.
 */

const TIPOS_ACEPTADOS: Record<string, 'pdf' | 'presentacion'> = {
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'presentacion',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentacion',
}

interface Material {
  id: string
  titulo: string
  modulo: string
  semana: number | null
  publicado: boolean
  visibleDesde: string | null
  tamañoKB: number | null
  rutaStorage: string | null
  estadoAprobacion: 'aprobado' | 'pendiente' | 'rechazado'
  mensajeRevision: string | null
}

export default function ContenidoProfesor() {
  const router = useRouter()
  const [materiales, setMateriales] = useState<Material[]>([])
  const [modulos, setModulos] = useState<{ id: string; name: string }[]>([])
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  const [subiendo, setSubiendo] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [titulo, setTitulo] = useState('')
  const [moduloId, setModuloId] = useState('')
  const [semana, setSemana] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [formAbierto, setFormAbierto] = useState(false)

  useEffect(() => {
    let vigente = true

    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      // Ve el material publicado (de administración) y todo lo suyo propio,
      // sea cual sea su estado de aprobación — Fase 0
      // (docs/16_FASE0_PLAN_PROFESOR.md, Sprint E).
      const [{ data: items }, { data: mods }] = await Promise.all([
        supabase
          .from('content_items')
          .select('id, title, week_number, is_published, visible_from, size_bytes, storage_path, uploaded_by, approval_status, review_message, modules(name)')
          .or(`is_published.eq.true,uploaded_by.eq.${user.id}`)
          .order('created_at', { ascending: false }),
        supabase.from('modules').select('id, name').order('order_index'),
      ])

      if (!vigente) return

      const filas = (items ?? []) as unknown as {
        id: string; title: string; week_number: number | null
        is_published: boolean; visible_from: string | null; size_bytes: number | null
        storage_path: string | null; uploaded_by: string | null
        approval_status: 'aprobado' | 'pendiente' | 'rechazado'; review_message: string | null
        modules: { name: string } | null
      }[]

      setMateriales(
        filas.map((m) => ({
          id: m.id,
          titulo: m.title,
          modulo: m.modules?.name ?? 'Módulo',
          semana: m.week_number,
          publicado: m.is_published,
          visibleDesde: m.visible_from,
          tamañoKB: m.size_bytes ? Math.round(m.size_bytes / 1024) : null,
          rutaStorage: m.storage_path,
          estadoAprobacion: m.approval_status,
          mensajeRevision: m.review_message,
        })),
      )

      setModulos(mods ?? [])
      if (mods?.length && !moduloId) setModuloId(mods[0].id)
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, version])

  async function subir() {
    if (!archivo || !titulo.trim() || !moduloId) return
    const tipo = TIPOS_ACEPTADOS[archivo.type]
    if (!tipo) {
      setError('Solo se aceptan archivos PDF o PowerPoint.')
      return
    }

    setSubiendo(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSubiendo(false)
      return
    }

    const nombreLimpio = archivo.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const ruta = `${moduloId}/${crypto.randomUUID()}-${nombreLimpio}`

    const { error: falloSubida } = await supabase.storage
      .from('contenido')
      .upload(ruta, archivo, { contentType: archivo.type })

    if (falloSubida) {
      setError(`No se pudo subir el archivo: ${falloSubida.message}`)
      setSubiendo(false)
      return
    }

    // Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, Sprint E): lo que sube el
    // profesor queda pendiente hasta que administración lo revise — nunca
    // se publica solo, aunque el profesor lo marque como listo.
    const { error: falloRegistro } = await supabase.from('content_items').insert({
      module_id: moduloId,
      week_number: semana === '' ? null : semana,
      title: titulo.trim(),
      type: tipo,
      storage_path: ruta,
      size_bytes: archivo.size,
      uploaded_by: user.id,
      is_published: false,
      approval_status: 'pendiente',
    })

    if (falloRegistro) {
      // El archivo ya se subió; se limpia para no dejar huérfanos en el bucket.
      await supabase.storage.from('contenido').remove([ruta])
      setError(falloRegistro.message)
      setSubiendo(false)
      return
    }

    setArchivo(null)
    setTitulo('')
    setSemana('')
    setFormAbierto(false)
    setSubiendo(false)
    setVersion((v) => v + 1)
  }

  const [descargando, setDescargando] = useState<string | null>(null)

  async function descargar(m: Material) {
    if (!m.rutaStorage) return
    setDescargando(m.id)
    const { data: firmada } = await createClient().storage.from('contenido').createSignedUrl(m.rutaStorage, 300)
    setDescargando(null)
    if (firmada?.signedUrl) window.open(firmada.signedUrl, '_blank', 'noopener,noreferrer')
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando material…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pb-28 pt-14">
      <BotonVolver href="/hoy" />

      <Encabezado
        sobretitulo="Docencia"
        titulo="Material de estudio"
        descripcion={`${materiales.length} archivo${materiales.length === 1 ? '' : 's'} subido${materiales.length === 1 ? '' : 's'}`}
        accion={
          <button
            onClick={() => setFormAbierto((f) => !f)}
            className="rounded-lg bg-zr-blue px-5 py-3.5 text-sm font-bold text-white"
          >
            {formAbierto ? 'Cancelar' : '+ Subir archivo'}
          </button>
        }
      />

      <Regla delay={60} />

      {formAbierto && (
        <div className="zr-card space-y-5 p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Archivo (PDF o PowerPoint)</label>
            <input
              type="file"
              accept="application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-sm text-zr-text file:mr-4 file:rounded file:border-0 file:bg-zr-blue file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Guía de Ley de Ohm aplicada"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Módulo</label>
              <select
                value={moduloId}
                onChange={(e) => setModuloId(e.target.value)}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              >
                {modulos.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">
                Semana <span className="font-normal text-zr-text-muted">(opcional)</span>
              </label>
              <input
                type="number"
                min={1}
                value={semana}
                onChange={(e) => setSemana(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="1"
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base tabular-nums text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
              />
            </div>
          </div>

          <p className="rounded-lg border border-zr-blue/25 bg-zr-blue/10 p-4 text-sm leading-relaxed text-zr-text">
            Administración revisa lo que subas antes de publicarlo. Te avisa aquí mismo cuando lo
            apruebe o si necesita algún cambio.
          </p>

          {error && <p className="text-sm font-medium text-zr-error">{error}</p>}

          <button
            onClick={subir}
            disabled={!archivo || !titulo.trim() || !moduloId || subiendo}
            className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
          >
            {subiendo ? 'Subiendo…' : 'Subir material'}
          </button>
        </div>
      )}

      {materiales.length === 0 ? (
        <div className="zr-card p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Todavía no has subido material</p>
          <p className="mt-2 text-sm text-zr-text-muted">
            Sube guías en PDF o PowerPoint para que tus estudiantes las consulten antes de cada clase.
          </p>
        </div>
      ) : (
        <Seccion numero={1} titulo="Archivos" delay={120}>
          <div className="space-y-3">
            {materiales.map((m) => (
              <div key={m.id} className="zr-card space-y-3 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-zr-text">{m.titulo}</p>
                    <p className="mt-1 text-sm text-zr-text-muted">
                      {m.modulo}
                      {m.semana ? ` · Semana ${m.semana}` : ''}
                      {m.tamañoKB ? ` · ${(m.tamañoKB / 1024).toFixed(1)} MB` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => descargar(m)}
                      disabled={descargando === m.id || !m.rutaStorage}
                      className="rounded-full border border-zr-border px-3 py-1.5 text-xs font-bold text-zr-text disabled:opacity-50"
                    >
                      {descargando === m.id ? '…' : 'Descargar'}
                    </button>
                    <Etiqueta
                      tono={
                        m.estadoAprobacion === 'aprobado' ? 'exito'
                          : m.estadoAprobacion === 'rechazado' ? 'error'
                          : 'aviso'
                      }
                    >
                      {m.estadoAprobacion === 'aprobado'
                        ? (m.publicado ? 'Publicado' : 'Aprobado')
                        : m.estadoAprobacion === 'rechazado' ? 'Rechazado'
                        : 'Pendiente'}
                    </Etiqueta>
                  </div>
                </div>
                {m.estadoAprobacion === 'rechazado' && m.mensajeRevision && (
                  <p className="rounded-lg border border-zr-error/30 bg-zr-error/10 px-4 py-3 text-sm text-zr-text">
                    {m.mensajeRevision}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Seccion>
      )}
    </div>
  )
}
