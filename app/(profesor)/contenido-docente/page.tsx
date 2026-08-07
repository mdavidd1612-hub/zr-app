'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * T-401 · Subida de material de estudio por el profesor.
 *
 * Solo PDF en Fase 1 (ver AGENTS.md §1). El archivo va al bucket privado
 * 'contenido'; la fila en content_items es lo que decide si el estudiante lo
 * ve — is_published en falso lo deja como borrador aunque el archivo ya esté
 * subido.
 */

interface Material {
  id: string
  titulo: string
  modulo: string
  semana: number | null
  publicado: boolean
  visibleDesde: string | null
  tamañoKB: number | null
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
  const [publicarAhora, setPublicarAhora] = useState(true)
  const [fechaVisible, setFechaVisible] = useState('')
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

      const [{ data: items }, { data: mods }] = await Promise.all([
        supabase
          .from('content_items')
          .select('id, title, week_number, is_published, visible_from, size_bytes, modules(name)')
          .eq('uploaded_by', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('modules').select('id, name').order('order_index'),
      ])

      if (!vigente) return

      const filas = (items ?? []) as unknown as {
        id: string; title: string; week_number: number | null
        is_published: boolean; visible_from: string | null; size_bytes: number | null
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
    if (archivo.type !== 'application/pdf') {
      setError('Solo se aceptan archivos PDF en esta fase.')
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
      .upload(ruta, archivo, { contentType: 'application/pdf' })

    if (falloSubida) {
      setError(`No se pudo subir el archivo: ${falloSubida.message}`)
      setSubiendo(false)
      return
    }

    const { error: falloRegistro } = await supabase.from('content_items').insert({
      module_id: moduloId,
      week_number: semana === '' ? null : semana,
      title: titulo.trim(),
      type: 'pdf',
      storage_path: ruta,
      size_bytes: archivo.size,
      uploaded_by: user.id,
      is_published: publicarAhora,
      visible_from: publicarAhora ? null : (fechaVisible || null),
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
    setPublicarAhora(true)
    setFechaVisible('')
    setFormAbierto(false)
    setSubiendo(false)
    setVersion((v) => v + 1)
  }

  async function alternarPublicado(m: Material) {
    await createClient()
      .from('content_items')
      .update({ is_published: !m.publicado })
      .eq('id', m.id)
    setVersion((v) => v + 1)
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
            {formAbierto ? 'Cancelar' : '+ Subir PDF'}
          </button>
        }
      />

      <Regla delay={60} />

      {formAbierto && (
        <div className="zr-card space-y-5 p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Archivo (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
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

          <div className="space-y-3 rounded-lg border border-zr-border bg-zr-bg/60 p-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-zr-text">
              <input
                type="checkbox"
                checked={publicarAhora}
                onChange={(e) => setPublicarAhora(e.target.checked)}
              />
              Publicar de inmediato
            </label>
            {!publicarAhora && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-zr-text">
                  Visible a partir de
                </label>
                <input
                  type="datetime-local"
                  value={fechaVisible}
                  onChange={(e) => setFechaVisible(e.target.value)}
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
                />
              </div>
            )}
          </div>

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
            Sube guías en PDF para que tus estudiantes las consulten antes de cada clase.
          </p>
        </div>
      ) : (
        <Seccion numero={1} titulo="Tus archivos" delay={120}>
          <div className="space-y-3">
            {materiales.map((m) => (
              <div key={m.id} className="zr-card flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-zr-text">{m.titulo}</p>
                  <p className="mt-1 text-sm text-zr-text-muted">
                    {m.modulo}
                    {m.semana ? ` · Semana ${m.semana}` : ''}
                    {m.tamañoKB ? ` · ${(m.tamañoKB / 1024).toFixed(1)} MB` : ''}
                  </p>
                </div>
                <button onClick={() => alternarPublicado(m)} className="shrink-0">
                  <Etiqueta tono={m.publicado ? 'exito' : 'neutro'}>
                    {m.publicado ? 'Publicado' : 'Borrador'}
                  </Etiqueta>
                </button>
              </div>
            ))}
          </div>
        </Seccion>
      )}
    </div>
  )
}
