'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { IconoDocumento, IconoAviso } from '@/components/ui/Iconos'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, Sprint C): material que sube
 * administración, organizado en carpetas por módulo — a pedido explícito
 * del coordinador ("como Classroom, separado por carpetas"). Dirección
 * académica y super_admin pueden crear carpetas propias, como un explorador
 * de archivos; el resto de personal solo navega.
 *
 * Los archivos que ya existían quedan "sueltos" en la raíz del módulo
 * (folder_id null) — no se perdió ni se movió nada al agregar carpetas.
 */

interface Cohorte {
  id: string
  nombre: string
  moduloId: string | null
  moduloNombre: string | null
}

interface Carpeta {
  id: string
  nombre: string
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
  const [rol, setRol] = useState<UserRole | null>(null)
  const [pendientes, setPendientes] = useState<Material[]>([])
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [programaId, setProgramaId] = useState('')
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  const [pilaCarpetas, setPilaCarpetas] = useState<Carpeta[]>([])
  const [subcarpetas, setSubcarpetas] = useState<Carpeta[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])
  const [cargandoCarpeta, setCargandoCarpeta] = useState(false)

  const [creandoCarpeta, setCreandoCarpeta] = useState(false)
  const [nombreCarpeta, setNombreCarpeta] = useState('')

  const [subiendo, setSubiendo] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [titulo, setTitulo] = useState('')
  const [semana, setSemana] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [formAbierto, setFormAbierto] = useState(false)

  const programa = cohortes.find((c) => c.id === programaId)
  const carpetaActual = pilaCarpetas[pilaCarpetas.length - 1]?.id ?? null
  const puedeCrearCarpetas = esDireccionAcademica(rol)

  useEffect(() => {
    let vigente = true

    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [{ data: perfil }, { data: pend }, { data: cohs }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).single(),
        supabase
          .from('content_items')
          .select('id, title, week_number, is_published, size_bytes, storage_path, uploaded_by, approval_status, profiles!content_items_uploaded_by_fkey(full_name), modules(name)')
          .eq('approval_status', 'pendiente')
          .order('created_at', { ascending: false }),
        supabase.from('cohorts').select('id, name, current_module_id, modules(name)').order('name'),
      ])

      if (!vigente) return
      setRol((perfil?.role as UserRole) ?? null)

      const filasPend = (pend ?? []) as unknown as {
        id: string; title: string; week_number: number | null
        is_published: boolean; size_bytes: number | null; storage_path: string | null
        uploaded_by: string | null; approval_status: 'aprobado' | 'pendiente' | 'rechazado'
        profiles: { full_name: string } | null
        modules: { name: string } | null
      }[]

      setPendientes(
        filasPend.map((m) => ({
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
      if (listaCohortes.length && !programaId) setProgramaId(listaCohortes[0].id)

      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, version])

  // Se recarga la carpeta actual cada vez que cambia el programa (vuelve a
  // la raíz de su módulo) o la posición dentro del explorador.
  useEffect(() => {
    async function cargarCarpeta() {
      if (!programa?.moduloId) {
        setSubcarpetas([])
        setMateriales([])
        return
      }
      setCargandoCarpeta(true)
      const supabase = createClient()

      const consultaCarpetas = supabase
        .from('content_folders').select('id, name').eq('module_id', programa.moduloId)
      const consultaItems = supabase
        .from('content_items')
        .select('id, title, week_number, is_published, size_bytes, storage_path, uploaded_by, approval_status, profiles!content_items_uploaded_by_fkey(full_name)')
        .eq('module_id', programa.moduloId)
        .neq('approval_status', 'pendiente')

      const [{ data: subs }, { data: items }] = await Promise.all([
        (carpetaActual
          ? consultaCarpetas.eq('parent_folder_id', carpetaActual)
          : consultaCarpetas.is('parent_folder_id', null)
        ).order('name'),
        (carpetaActual
          ? consultaItems.eq('folder_id', carpetaActual)
          : consultaItems.is('folder_id', null)
        ).order('title'),
      ])

      setSubcarpetas((subs ?? []).map((c) => ({ id: c.id, nombre: c.name })))

      const filas = (items ?? []) as unknown as {
        id: string; title: string; week_number: number | null
        is_published: boolean; size_bytes: number | null; storage_path: string | null
        uploaded_by: string | null; approval_status: 'aprobado' | 'pendiente' | 'rechazado'
        profiles: { full_name: string } | null
      }[]

      setMateriales(
        filas.map((m) => ({
          id: m.id,
          titulo: m.title,
          modulo: programa.moduloNombre ?? 'Módulo',
          semana: m.week_number,
          publicado: m.is_published,
          tamañoKB: m.size_bytes ? Math.round(m.size_bytes / 1024) : null,
          rutaStorage: m.storage_path,
          subidoPor: m.uploaded_by,
          autor: m.profiles?.full_name ?? null,
          estadoAprobacion: m.approval_status,
        })),
      )
      setCargandoCarpeta(false)
    }

    cargarCarpeta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, carpetaActual, version])

  function cambiarPrograma(id: string) {
    setProgramaId(id)
    setPilaCarpetas([])
  }

  function abrirCarpeta(c: Carpeta) {
    setPilaCarpetas((p) => [...p, c])
  }

  function irARaiz() {
    setPilaCarpetas([])
  }

  function volverA(indice: number) {
    setPilaCarpetas((p) => p.slice(0, indice + 1))
  }

  async function crearCarpeta() {
    if (!nombreCarpeta.trim() || !programa?.moduloId) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: fallo } = await supabase.from('content_folders').insert({
      module_id: programa.moduloId,
      parent_folder_id: carpetaActual,
      name: nombreCarpeta.trim(),
      created_by: user?.id ?? null,
    })
    if (!fallo) {
      setNombreCarpeta('')
      setCreandoCarpeta(false)
      setVersion((v) => v + 1)
    }
  }

  const TIPOS_ACEPTADOS: Record<string, 'pdf' | 'video' | 'presentacion'> = {
    'application/pdf': 'pdf',
    'video/mp4': 'video',
    'video/webm': 'video',
    'application/vnd.ms-powerpoint': 'presentacion',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentacion',
  }

  async function subir() {
    if (!archivo || !titulo.trim() || !programa?.moduloId) return

    const tipo = TIPOS_ACEPTADOS[archivo.type]
    if (!tipo) {
      setError('Solo se aceptan PDF, PowerPoint o video (MP4/WebM).')
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
    const ruta = `${programa.moduloId}/${crypto.randomUUID()}-${nombreLimpio}`

    const { error: falloSubida } = await supabase.storage
      .from('contenido')
      .upload(ruta, archivo, { contentType: archivo.type })

    if (falloSubida) {
      setError(`No se pudo subir el archivo: ${falloSubida.message}`)
      setSubiendo(false)
      return
    }

    const { error: falloRegistro } = await supabase.from('content_items').insert({
      module_id: programa.moduloId,
      folder_id: carpetaActual,
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
        descripcion="Organizado en carpetas por programa, como Classroom."
        accion={
          // Subir y aprobar material es de Dirección Académica/super_admin
          // (reafirmado explícitamente por el coordinador) — un admin
          // normal navega y descarga, pero no publica ni aprueba nada.
          puedeCrearCarpetas ? (
            <button
              onClick={() => setFormAbierto((f) => !f)}
              className="rounded-lg bg-zr-blue px-5 py-3.5 text-sm font-bold text-white"
            >
              {formAbierto ? 'Cancelar' : '+ Subir archivo'}
            </button>
          ) : undefined
        }
      />

      <Regla delay={60} />

      {puedeCrearCarpetas && pendientes.length > 0 && (
        <Seccion numero={1} titulo="Pendientes de aprobación" delay={80}>
          <div className="space-y-3">
            {pendientes.map((m) => (
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

      <Seccion numero={puedeCrearCarpetas && pendientes.length > 0 ? 2 : 1} titulo="Explorador de material" delay={120}>
        <div>
          <label className="mb-2 block text-sm font-semibold text-zr-text">Programa</label>
          <select
            value={programaId}
            onChange={(e) => cambiarPrograma(e.target.value)}
            className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
          >
            {cohortes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {!programa?.moduloId ? (
          <div className="flex gap-3 rounded-lg border border-zr-warning/30 bg-zr-warning/10 p-4">
            <IconoAviso size={18} className="mt-0.5 shrink-0 text-zr-warning" />
            <p className="text-sm text-zr-text">Este programa no tiene módulo actual asignado.</p>
          </div>
        ) : (
          <>
            {/* Ruta de carpetas — tipo explorador de archivos */}
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <button
                onClick={irARaiz}
                className={`font-semibold ${pilaCarpetas.length === 0 ? 'text-zr-text' : 'text-zr-blue-mid'}`}
              >
                {programa.moduloNombre ?? 'Módulo'}
              </button>
              {pilaCarpetas.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1.5">
                  <span className="text-zr-text-muted">/</span>
                  <button
                    onClick={() => volverA(i)}
                    className={`font-semibold ${i === pilaCarpetas.length - 1 ? 'text-zr-text' : 'text-zr-blue-mid'}`}
                  >
                    {c.nombre}
                  </button>
                </span>
              ))}
            </div>

            {puedeCrearCarpetas && (
              creandoCarpeta ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={nombreCarpeta}
                    onChange={(e) => setNombreCarpeta(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && crearCarpeta()}
                    placeholder="Nombre de la carpeta"
                    className="min-w-0 flex-1 rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-sm text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                  />
                  <button onClick={crearCarpeta} className="shrink-0 rounded-lg bg-zr-blue px-4 text-sm font-bold text-white">
                    Crear
                  </button>
                  <button
                    onClick={() => { setCreandoCarpeta(false); setNombreCarpeta('') }}
                    className="shrink-0 rounded-lg border border-zr-border px-4 text-sm font-semibold text-zr-text"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreandoCarpeta(true)}
                  className="flex min-h-12 items-center gap-2 rounded-lg border border-dashed border-zr-border px-4 text-sm font-semibold text-zr-text-muted"
                >
                  + Nueva carpeta aquí
                </button>
              )
            )}

            {cargandoCarpeta ? (
              <p className="text-sm text-zr-text-muted">Cargando…</p>
            ) : subcarpetas.length === 0 && materiales.length === 0 ? (
              <div className="zr-card p-8 text-center">
                <p className="text-base font-semibold text-zr-text">Esta carpeta está vacía</p>
              </div>
            ) : (
              <div className="space-y-2">
                {subcarpetas.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => abrirCarpeta(c)}
                    className="zr-card zr-card-interactive flex w-full items-center gap-3 p-4 text-left"
                  >
                    <span className="text-xl">📁</span>
                    <span className="text-sm font-semibold text-zr-text">{c.nombre}</span>
                  </button>
                ))}

                {materiales.map((m) => (
                  <div key={m.id} className="zr-card flex items-center justify-between gap-4 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <IconoDocumento size={20} className="shrink-0 text-zr-text-muted" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zr-text">{m.titulo}</p>
                        <p className="mt-0.5 text-xs text-zr-text-muted">
                          {m.autor ? `${m.autor} · ` : ''}
                          {m.semana ? `Semana ${m.semana}` : ''}
                          {m.tamañoKB ? ` · ${(m.tamañoKB / 1024).toFixed(1)} MB` : ''}
                        </p>
                      </div>
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
            )}
          </>
        )}
      </Seccion>

      {formAbierto && (
        <div className="zr-card space-y-5 p-6">
          <p className="text-sm font-semibold text-zr-text">
            Sube a: {programa?.moduloNombre ?? 'Módulo'}
            {pilaCarpetas.length > 0 && ` / ${pilaCarpetas[pilaCarpetas.length - 1].nombre}`}
          </p>
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Archivo (PDF, PowerPoint o video)</label>
            <input
              type="file"
              accept="application/pdf,video/mp4,video/webm,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
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

          {error && <p className="text-sm font-medium text-zr-error">{error}</p>}

          <button
            onClick={subir}
            disabled={!archivo || !titulo.trim() || !programa?.moduloId || subiendo}
            className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
          >
            {subiendo ? 'Subiendo…' : 'Subir material'}
          </button>
        </div>
      )}
    </div>
  )
}
