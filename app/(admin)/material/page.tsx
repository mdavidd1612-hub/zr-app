'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, Sprint C): material que sube
 * administración, eligiendo la cohorte (no el módulo directamente — se
 * resuelve al módulo actual de esa cohorte, que es como el contenido ya se
 * organiza en `content_items`). Mismo patrón que el material del profesor
 * (app/(profesor)/contenido-docente).
 */

interface Cohorte {
  id: string
  nombre: string
  moduloId: string | null
  moduloNombre: string | null
}

interface Material {
  id: string
  titulo: string
  modulo: string
  semana: number | null
  publicado: boolean
  tamañoKB: number | null
  rutaStorage: string | null
  subidoPor: string | null
  autor: string | null
  estadoAprobacion: 'aprobado' | 'pendiente' | 'rechazado'
}

export default function MaterialAdmin() {
  const router = useRouter()
  const [materiales, setMateriales] = useState<Material[]>([])
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  const [subiendo, setSubiendo] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [titulo, setTitulo] = useState('')
  const [cohorteId, setCohorteId] = useState('')
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

      const [{ data: items }, { data: cohs }] = await Promise.all([
        supabase
          .from('content_items')
          .select('id, title, week_number, is_published, size_bytes, storage_path, uploaded_by, approval_status, profiles!content_items_uploaded_by_fkey(full_name), modules(name)')
          .order('created_at', { ascending: false }),
        supabase.from('cohorts').select('id, name, current_module_id, modules(name)').order('name'),
      ])

      if (!vigente) return

      const filas = (items ?? []) as unknown as {
        id: string; title: string; week_number: number | null
        is_published: boolean; size_bytes: number | null; storage_path: string | null
        uploaded_by: string | null; approval_status: 'aprobado' | 'pendiente' | 'rechazado'
        profiles: { full_name: string } | null
        modules: { name: string } | null
      }[]

      setMateriales(
        filas.map((m) => ({
          id: m.id,
          titulo: m.title,
          modulo: m.modules?.name ?? 'Módulo',
          semana: m.week_number,
          publicado: m.is_published,
          tamañoKB: m.size_bytes ? Math.round(m.size_bytes / 1024) : null,
          rutaStorage: m.storage_path,
          subidoPor: m.uploaded_by,
          autor: m.profiles?.full_name ?? null,
          estadoAprobacion: m.approval_status,
        })),
      )

      const listaCohortes = (cohs ?? []).map((c) => ({
        id: c.id,
        nombre: c.name,
        moduloId: c.current_module_id,
        moduloNombre: (c as unknown as { modules: { name: string } | null }).modules?.name ?? null,
      }))
      setCohortes(listaCohortes)
      if (listaCohortes.length && !cohorteId) setCohorteId(listaCohortes[0].id)

      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, version])

  const TIPOS_ACEPTADOS: Record<string, 'pdf' | 'video'> = {
    'application/pdf': 'pdf',
    'video/mp4': 'video',
    'video/webm': 'video',
  }

  async function subir() {
    const cohorte = cohortes.find((c) => c.id === cohorteId)
    if (!archivo || !titulo.trim() || !cohorte?.moduloId) return

    const tipo = TIPOS_ACEPTADOS[archivo.type]
    if (!tipo) {
      setError('Solo se aceptan PDF o video (MP4/WebM).')
      return
    }

    setSubiendo(true)
    setError(null)

    const supabase = createClient()

    // El tope de tamaño es de negocio (regla 5 de CLAUDE.md): vive en
    // system_config, nunca escrito en el código.
    const { data: configTamano } = await supabase
      .from('system_config').select('value').eq('key', 'content.max_size_mb').maybeSingle()
    const maxMB = Number(configTamano?.value ?? 200)
    if (archivo.size > maxMB * 1024 * 1024) {
      setError(`El archivo pesa más de ${maxMB} MB. Comprímelo o pide que se suba en partes.`)
      setSubiendo(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSubiendo(false)
      return
    }

    const nombreLimpio = archivo.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const ruta = `${cohorte.moduloId}/${crypto.randomUUID()}-${nombreLimpio}`

    const { error: falloSubida } = await supabase.storage
      .from('contenido')
      .upload(ruta, archivo, { contentType: archivo.type })

    if (falloSubida) {
      setError(`No se pudo subir el archivo: ${falloSubida.message}`)
      setSubiendo(false)
      return
    }

    const { error: falloRegistro } = await supabase.from('content_items').insert({
      module_id: cohorte.moduloId,
      week_number: semana === '' ? null : semana,
      title: titulo.trim(),
      type: tipo,
      storage_path: ruta,
      size_bytes: archivo.size,
      uploaded_by: user.id,
      is_published: true,
    })

    if (falloRegistro) {
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

  async function alternarPublicado(m: Material) {
    await createClient().from('content_items').update({ is_published: !m.publicado }).eq('id', m.id)
    setVersion((v) => v + 1)
  }

  async function aprobar(m: Material) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('content_items').update({
      approval_status: 'aprobado',
      is_published: true,
      review_message: null,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', m.id)
    setVersion((v) => v + 1)
  }

  async function rechazar(m: Material) {
    const mensaje = window.prompt(`¿Qué le dices a ${m.autor ?? 'el profesor'} sobre "${m.titulo}"?`)
    if (mensaje === null) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('content_items').update({
      approval_status: 'rechazado',
      is_published: false,
      review_message: mensaje.trim() || 'Necesita algún cambio antes de publicarse.',
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', m.id)
    setVersion((v) => v + 1)
  }

  const [descargando, setDescargando] = useState<string | null>(null)

  async function descargar(m: Material) {
    if (!m.rutaStorage) return
    setDescargando(m.id)
    const supabase = createClient()
    const { data: firmada } = await supabase.storage.from('contenido').createSignedUrl(m.rutaStorage, 300)
    setDescargando(null)
    if (firmada?.signedUrl) {
      window.open(firmada.signedUrl, '_blank', 'noopener,noreferrer')
    }
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
      <BotonVolver href="/panel" />

      <Encabezado
        sobretitulo="Administración"
        titulo="Material"
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
            <label className="mb-2 block text-sm font-semibold text-zr-text">Archivo (PDF o video)</label>
            <input
              type="file"
              accept="application/pdf,video/mp4,video/webm"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-sm text-zr-text file:mr-4 file:rounded file:border-0 file:bg-zr-blue file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Guía de diagnóstico · Módulo 1"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Programa</label>
              <select
                value={cohorteId}
                onChange={(e) => setCohorteId(e.target.value)}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              >
                {cohortes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-zr-text-muted">
                {cohortes.find((c) => c.id === cohorteId)?.moduloNombre
                  ? `Va al módulo actual de este programa: ${cohortes.find((c) => c.id === cohorteId)?.moduloNombre}`
                  : 'Este programa no tiene módulo actual asignado'}
              </p>
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

          {error && <p className="text-sm font-medium text-zr-error">{error}</p>}

          <button
            onClick={subir}
            disabled={!archivo || !titulo.trim() || !cohortes.find((c) => c.id === cohorteId)?.moduloId || subiendo}
            className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
          >
            {subiendo ? 'Subiendo…' : 'Subir material'}
          </button>
        </div>
      )}

      {materiales.length === 0 ? (
        <div className="zr-card p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Todavía no se ha subido material</p>
        </div>
      ) : (
        <>
          {materiales.some((m) => m.estadoAprobacion === 'pendiente') && (
            <Seccion numero={1} titulo="Pendientes de aprobación" delay={100}>
              <div className="space-y-3">
                {materiales.filter((m) => m.estadoAprobacion === 'pendiente').map((m) => (
                  <div key={m.id} className="zr-card space-y-3 border-zr-warning/30 bg-zr-warning/8 p-5">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-zr-text">{m.titulo}</p>
                      <p className="mt-1 text-sm text-zr-text-muted">
                        {m.autor ?? 'Profesor'} · {m.modulo}
                        {m.semana ? ` · Semana ${m.semana}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => descargar(m)}
                        disabled={descargando === m.id}
                        className="flex-1 rounded-lg border border-zr-border py-2.5 text-sm font-semibold text-zr-text disabled:opacity-50"
                      >
                        Descargar
                      </button>
                      <button
                        onClick={() => aprobar(m)}
                        className="flex-1 rounded-lg bg-zr-success py-2.5 text-sm font-bold text-white"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => rechazar(m)}
                        className="flex-1 rounded-lg border border-zr-error/40 py-2.5 text-sm font-bold text-zr-error"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Seccion>
          )}

        <Seccion numero={2} titulo="Archivos" delay={120}>
          <div className="space-y-3">
            {materiales.filter((m) => m.estadoAprobacion !== 'pendiente').map((m) => (
              <div key={m.id} className="zr-card flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-zr-text">{m.titulo}</p>
                  <p className="mt-1 text-sm text-zr-text-muted">
                    {m.autor ? `${m.autor} · ` : ''}{m.modulo}
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
                  {m.estadoAprobacion === 'rechazado' ? (
                    <Etiqueta tono="error">Rechazado</Etiqueta>
                  ) : (
                    <button onClick={() => alternarPublicado(m)}>
                      <Etiqueta tono={m.publicado ? 'exito' : 'neutro'}>
                        {m.publicado ? 'Publicado' : 'Borrador'}
                      </Etiqueta>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Seccion>
        </>
      )}
    </div>
  )
}
