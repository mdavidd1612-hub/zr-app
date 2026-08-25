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
          .select('id, title, week_number, is_published, size_bytes, modules(name)')
          .order('created_at', { ascending: false }),
        supabase.from('cohorts').select('id, name, current_module_id, modules(name)').order('name'),
      ])

      if (!vigente) return

      const filas = (items ?? []) as unknown as {
        id: string; title: string; week_number: number | null
        is_published: boolean; size_bytes: number | null
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

  async function subir() {
    const cohorte = cohortes.find((c) => c.id === cohorteId)
    if (!archivo || !titulo.trim() || !cohorte?.moduloId) return
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
    const ruta = `${cohorte.moduloId}/${crypto.randomUUID()}-${nombreLimpio}`

    const { error: falloSubida } = await supabase.storage
      .from('contenido')
      .upload(ruta, archivo, { contentType: 'application/pdf' })

    if (falloSubida) {
      setError(`No se pudo subir el archivo: ${falloSubida.message}`)
      setSubiendo(false)
      return
    }

    const { error: falloRegistro } = await supabase.from('content_items').insert({
      module_id: cohorte.moduloId,
      week_number: semana === '' ? null : semana,
      title: titulo.trim(),
      type: 'pdf',
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
              placeholder="Ej: Guía de diagnóstico · Módulo 1"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Cohorte</label>
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
                  ? `Va al módulo actual de esta cohorte: ${cohortes.find((c) => c.id === cohorteId)?.moduloNombre}`
                  : 'Esta cohorte no tiene módulo actual asignado'}
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
        <Seccion numero={1} titulo="Archivos" delay={120}>
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
