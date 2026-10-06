'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { IconoDocumento, IconoAviso } from '@/components/ui/Iconos'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import { ordenarCohortesPorPrioridad } from '@/lib/cohortes'
import type { UserRole } from '@/lib/types'
import {
  ACCEPT_MATERIAL, MENSAJE_FORMATOS, nombreDescarga, rutaDeStorage, tipoDeArchivo,
} from '@/lib/material'

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
  programId: string | null
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
  nombreOriginal: string | null
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
  const [avisoPeso, setAvisoPeso] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [semana, setSemana] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [formAbierto, setFormAbierto] = useState(false)

  // Un material pertenece a un módulo, y cada módulo a un programa (migración
  // 123): "programa + módulo" son las etiquetas del material. Se puede
  // explorar cualquier módulo del programa, no solo el actual de la cohorte.
  const [moduloSelId, setModuloSelId] = useState<string | null>(null)
  const [modulosPrograma, setModulosPrograma] = useState<{ id: string; nombre: string; orden: number }[]>([])
  const cohorteBase = cohortes.find((c) => c.id === programaId)
  const moduloElegido = modulosPrograma.find((m) => m.id === moduloSelId)
  const programa = cohorteBase
    ? {
        ...cohorteBase,
        moduloId: moduloSelId ?? cohorteBase.moduloId,
        moduloNombre: moduloElegido?.nombre ?? cohorteBase.moduloNombre,
      }
    : undefined
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

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!vigente) return

      // Material (pedido explícito del coordinador, sept. 2026): exclusivo de
      // Dirección Académica y super_admin -- administración normal ya no
      // entra, ni siquiera de solo lectura. Redirige a quien llegue por URL
      // directa sin tener el enlace en su menú.
      if (!esDireccionAcademica(perfil?.role as UserRole | undefined)) {
        router.replace('/panel')
        return
      }

      const [{ data: pend }, { data: cohs }] = await Promise.all([
        supabase
          .from('content_items')
          .select('id, title, week_number, is_published, size_bytes, storage_path, original_name, uploaded_by, approval_status, profiles!content_items_uploaded_by_fkey(full_name), modules(name)')
          .eq('approval_status', 'pendiente')
          .order('created_at', { ascending: false }),
        supabase.from('cohorts').select('id, name, current_module_id, program_id, modules(name)'),
      ])

      if (!vigente) return
      setRol((perfil?.role as UserRole) ?? null)

      const filasPend = (pend ?? []) as unknown as {
        id: string; title: string; week_number: number | null
        is_published: boolean; size_bytes: number | null; storage_path: string | null; original_name: string | null
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
          nombreOriginal: m.original_name,
          subidoPor: m.uploaded_by,
          autor: m.profiles?.full_name ?? null,
          estadoAprobacion: m.approval_status,
        })),
      )

      const listaCohortes = ordenarCohortesPorPrioridad(cohs ?? []).map((c) => ({
        id: c.id,
        nombre: c.name,
        moduloId: c.current_module_id,
        moduloNombre: (c as unknown as { modules: { name: string } | null }).modules?.name ?? null,
        programId: c.program_id,
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
        .select('id, title, week_number, is_published, size_bytes, storage_path, original_name, uploaded_by, approval_status, profiles!content_items_uploaded_by_fkey(full_name)')
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
        is_published: boolean; size_bytes: number | null; storage_path: string | null; original_name: string | null
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
          nombreOriginal: m.original_name,
          subidoPor: m.uploaded_by,
          autor: m.profiles?.full_name ?? null,
          estadoAprobacion: m.approval_status,
        })),
      )
      setCargandoCarpeta(false)
    }

    cargarCarpeta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, moduloSelId, carpetaActual, version])

  useEffect(() => {
    const programId = cohorteBase?.programId
    if (!programId) return
    createClient()
      .from('modules').select('id, name, order_index').eq('program_id', programId).order('order_index')
      .then(({ data }) => setModulosPrograma((data ?? []).map((m) => ({ id: m.id, nombre: m.name, orden: m.order_index }))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohorteBase?.programId])

  function cambiarPrograma(id: string) {
    setProgramaId(id)
    setModuloSelId(null)
    setPilaCarpetas([])
  }

  function cambiarModulo(id: string) {
    setModuloSelId(id)
    setPilaCarpetas([])
  }

  // ---- Mover (reunión de oct. 2026): botón "Mover" con selector de carpeta
  // (sirve en teléfono/tableta) y arrastrar y soltar en computador. Solo
  // dentro del mismo módulo -- lo exige además un trigger en la base (123).
  type Movible = { tipo: 'item' | 'carpeta'; id: string; nombre: string }
  const [moviendo, setMoviendo] = useState<Movible | null>(null)
  const [arbol, setArbol] = useState<{ id: string; nombre: string; padre: string | null }[]>([])
  const [moviendoEnCurso, setMoviendoEnCurso] = useState(false)
  const [mensajeMovido, setMensajeMovido] = useState<string | null>(null)

  async function abrirMover(m: Movible) {
    if (!programa?.moduloId) return
    setMoviendo(m)
    const { data } = await createClient()
      .from('content_folders').select('id, name, parent_folder_id').eq('module_id', programa.moduloId).order('name')
    setArbol((data ?? []).map((f) => ({ id: f.id, nombre: f.name, padre: f.parent_folder_id })))
  }

  async function moverA(m: Movible, destinoId: string | null, nombreDestino: string) {
    if (m.tipo === 'carpeta' && destinoId === m.id) return
    setMoviendoEnCurso(true)
    setError(null)
    const supabase = createClient()
    const { error: fallo } = m.tipo === 'item'
      ? await supabase.from('content_items').update({ folder_id: destinoId }).eq('id', m.id)
      : await supabase.from('content_folders').update({ parent_folder_id: destinoId }).eq('id', m.id)
    setMoviendoEnCurso(false)
    setMoviendo(null)
    if (fallo) {
      setError(fallo.message.includes('mismo módulo') || fallo.message.includes('sí misma')
        ? fallo.message
        : 'No se pudo mover. Intenta de nuevo.')
      return
    }
    setMensajeMovido(`"${m.nombre}" se movió a ${nombreDestino}.`)
    setTimeout(() => setMensajeMovido(null), 4000)
    setVersion((v) => v + 1)
  }

  // Arrastrar y soltar (solo computador; en teléfono se usa el botón Mover).
  function iniciarArrastre(e: React.DragEvent, m: Movible) {
    e.dataTransfer.setData('application/x-zr-mover', JSON.stringify(m))
    e.dataTransfer.effectAllowed = 'move'
  }
  function soltarEn(e: React.DragEvent, destinoId: string | null, nombreDestino: string) {
    e.preventDefault()
    const crudo = e.dataTransfer.getData('application/x-zr-mover')
    if (!crudo) return
    void moverA(JSON.parse(crudo) as Movible, destinoId, nombreDestino)
  }
  function permitirSoltar(e: React.DragEvent) {
    if (puedeCrearCarpetas) e.preventDefault()
  }

  // Carpetas destino con sangría; se excluye la carpeta movida y sus hijas.
  function opcionesDestino(): { id: string | null; nombre: string; nivel: number }[] {
    const excluidas = new Set<string>()
    if (moviendo?.tipo === 'carpeta') {
      excluidas.add(moviendo.id)
      let creciendo = true
      while (creciendo) {
        creciendo = false
        for (const f of arbol) {
          if (f.padre && excluidas.has(f.padre) && !excluidas.has(f.id)) {
            excluidas.add(f.id)
            creciendo = true
          }
        }
      }
    }
    const salida: { id: string | null; nombre: string; nivel: number }[] = [
      { id: null, nombre: programa?.moduloNombre ?? 'Raíz del módulo', nivel: 0 },
    ]
    const agregar = (padre: string | null, nivel: number) => {
      for (const f of arbol.filter((x) => x.padre === padre)) {
        if (excluidas.has(f.id)) continue
        salida.push({ id: f.id, nombre: f.nombre, nivel })
        agregar(f.id, nivel + 1)
      }
    }
    agregar(null, 1)
    return salida
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

  async function subir() {
    if (!archivo || !titulo.trim() || !programa?.moduloId) return

    const tipo = tipoDeArchivo(archivo)
    if (!tipo) {
      setError(MENSAJE_FORMATOS)
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

    const ruta = rutaDeStorage(programa.moduloId, archivo.name)

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
      original_name: archivo.name,
      mime_type: archivo.type || null,
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
    // Despublicar es lo peligroso -- un clic sin querer deja el archivo
    // invisible para todos los estudiantes sin ningún aviso. Publicar no
    // necesita confirmación, la otra dirección sí (bug real reportado por
    // Dirección Académica, sept. 2026).
    if (m.publicado && !confirm(`¿Quitar "${m.titulo}" de publicado? Los estudiantes dejarán de verlo de inmediato.`)) {
      return
    }
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
  const [eliminando, setEliminando] = useState<string | null>(null)

  // Editar carpeta (renombrar) y material (título/semana) — pedido explícito
  // del coordinador: quien puede crear/subir tiene que poder corregirlo
  // después sin tener que borrar y rehacer todo.
  const [editandoCarpetaId, setEditandoCarpetaId] = useState<string | null>(null)
  const [nombreEdicionCarpeta, setNombreEdicionCarpeta] = useState('')
  const [editandoMaterialId, setEditandoMaterialId] = useState<string | null>(null)
  const [formEdicionMaterial, setFormEdicionMaterial] = useState<{ titulo: string; semana: number | '' }>({ titulo: '', semana: '' })
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  // window.open(url, '_blank') después de un await casi siempre lo bloquea
  // el navegador — para cuando la promesa se resuelve, ya pasó la ventana
  // corta en la que un click cuenta como "gesto del usuario". Un <a download>
  // clickeado por código no tiene ese problema (no abre pestaña, descarga
  // directo), y con { download: true } el propio Storage manda el nombre de
  // archivo correcto en la respuesta.
  function descargarDesdeUrl(url: string, nombre: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function descargar(m: Material) {
    if (!m.rutaStorage) return
    setDescargando(m.id)
    const supabase = createClient()
    const { data: firmada } = await supabase.storage
      .from('contenido')
      .createSignedUrl(m.rutaStorage, 300, { download: nombreDescarga({ originalName: m.nombreOriginal, titulo: m.titulo, rutaStorage: m.rutaStorage }) })
    setDescargando(null)
    if (firmada?.signedUrl) {
      descargarDesdeUrl(firmada.signedUrl, m.titulo)
    } else {
      setError('No se pudo descargar el archivo. Intenta de nuevo.')
    }
  }

  async function eliminarCarpeta(c: Carpeta) {
    if (!confirm(`¿Borrar la carpeta "${c.nombre}"? El material que tenga adentro no se borra, queda suelto en la carpeta anterior.`)) return
    setEliminando(c.id)
    const { error: fallo } = await createClient().from('content_folders').delete().eq('id', c.id)
    setEliminando(null)
    if (fallo) {
      setError('No se pudo borrar la carpeta. Intenta de nuevo.')
      return
    }
    setVersion((v) => v + 1)
  }

  function abrirEdicionCarpeta(c: Carpeta) {
    setEditandoCarpetaId(c.id)
    setNombreEdicionCarpeta(c.nombre)
  }

  async function guardarNombreCarpeta(c: Carpeta) {
    const nuevoNombre = nombreEdicionCarpeta.trim()
    if (!nuevoNombre || nuevoNombre === c.nombre) {
      setEditandoCarpetaId(null)
      return
    }
    setGuardandoEdicion(true)
    const { error: fallo } = await createClient().from('content_folders').update({ name: nuevoNombre }).eq('id', c.id)
    setGuardandoEdicion(false)
    if (fallo) {
      setError('No se pudo renombrar la carpeta. Intenta de nuevo.')
      return
    }
    setEditandoCarpetaId(null)
    setVersion((v) => v + 1)
  }

  function abrirEdicionMaterial(m: Material) {
    setEditandoMaterialId(m.id)
    setFormEdicionMaterial({ titulo: m.titulo, semana: m.semana ?? '' })
  }

  async function guardarEdicionMaterial(m: Material) {
    if (!formEdicionMaterial.titulo.trim()) return
    setGuardandoEdicion(true)
    const { error: fallo } = await createClient()
      .from('content_items')
      .update({
        title: formEdicionMaterial.titulo.trim(),
        week_number: formEdicionMaterial.semana === '' ? null : formEdicionMaterial.semana,
      })
      .eq('id', m.id)
    setGuardandoEdicion(false)
    if (fallo) {
      setError('No se pudo guardar el material. Intenta de nuevo.')
      return
    }
    setEditandoMaterialId(null)
    setVersion((v) => v + 1)
  }

  async function eliminarMaterial(m: Material) {
    if (!confirm(`¿Borrar "${m.titulo}"? Esto no se puede deshacer.`)) return
    setEliminando(m.id)
    const supabase = createClient()

    if (m.rutaStorage) {
      await supabase.storage.from('contenido').remove([m.rutaStorage])
    }
    const { error: fallo } = await supabase.from('content_items').delete().eq('id', m.id)

    setEliminando(null)
    if (fallo) {
      setError('No se pudo borrar el material. Intenta de nuevo.')
      return
    }
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

      {(rol === 'admin' || rol === 'super_admin') && (
        <a href="/metricas-material" className="block text-sm font-semibold text-zr-blue-mid underline">
          Ver métricas de uso del material
        </a>
      )}

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
        {/* Antes este aviso solo vivía dentro del formulario de subida — un
            error al borrar o descargar (con el formulario cerrado, el caso
            normal) no se veía en ningún lado. */}
        {error && !formAbierto && (
          <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
            {error}
          </p>
        )}
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

        {modulosPrograma.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Módulo</label>
            <select
              value={programa?.moduloId ?? ''}
              onChange={(e) => cambiarModulo(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            >
              {modulosPrograma.map((m) => (
                <option key={m.id} value={m.id}>
                  Módulo {m.orden} · {m.nombre}{m.id === cohorteBase?.moduloId ? ' (actual)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

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
                onDragOver={permitirSoltar}
                onDrop={(e) => soltarEn(e, null, programa.moduloNombre ?? 'el módulo')}
                className={`font-semibold ${pilaCarpetas.length === 0 ? 'text-zr-text' : 'text-zr-blue-mid'}`}
              >
                {programa.moduloNombre ?? 'Módulo'}
              </button>
              {pilaCarpetas.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1.5">
                  <span className="text-zr-text-muted">/</span>
                  <button
                    onClick={() => volverA(i)}
                    onDragOver={permitirSoltar}
                    onDrop={(e) => soltarEn(e, c.id, c.nombre)}
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
                  <div
                    key={c.id}
                    className="zr-card flex items-center gap-3 p-4"
                    draggable={puedeCrearCarpetas && editandoCarpetaId !== c.id}
                    onDragStart={(e) => iniciarArrastre(e, { tipo: 'carpeta', id: c.id, nombre: c.nombre })}
                    onDragOver={permitirSoltar}
                    onDrop={(e) => soltarEn(e, c.id, c.nombre)}
                  >
                    {editandoCarpetaId === c.id ? (
                      <>
                        <input
                          autoFocus
                          value={nombreEdicionCarpeta}
                          onChange={(e) => setNombreEdicionCarpeta(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && guardarNombreCarpeta(c)}
                          className="min-w-0 flex-1 rounded-lg border border-zr-border bg-zr-bg px-3 py-2 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
                        />
                        <button
                          onClick={() => guardarNombreCarpeta(c)}
                          disabled={guardandoEdicion}
                          className="shrink-0 rounded-full bg-zr-blue px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditandoCarpetaId(null)}
                          className="shrink-0 rounded-full border border-zr-border px-3 py-1.5 text-xs font-semibold text-zr-text"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => abrirCarpeta(c)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className="text-xl">📁</span>
                          <span className="truncate text-sm font-semibold text-zr-text">{c.nombre}</span>
                        </button>
                        {puedeCrearCarpetas && (
                          <>
                            <button
                              onClick={() => abrirMover({ tipo: 'carpeta', id: c.id, nombre: c.nombre })}
                              className="shrink-0 rounded-full border border-zr-border px-3 py-1.5 text-xs font-bold text-zr-text"
                            >
                              Mover
                            </button>
                            <button
                              onClick={() => abrirEdicionCarpeta(c)}
                              className="shrink-0 rounded-full border border-zr-border px-3 py-1.5 text-xs font-bold text-zr-text"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => eliminarCarpeta(c)}
                              disabled={eliminando === c.id}
                              className="shrink-0 rounded-full border border-zr-error/40 px-3 py-1.5 text-xs font-bold text-zr-error disabled:opacity-50"
                            >
                              {eliminando === c.id ? '…' : 'Borrar'}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {materiales.map((m) => (
                  <div
                    key={m.id}
                    draggable={puedeCrearCarpetas && editandoMaterialId !== m.id}
                    onDragStart={(e) => iniciarArrastre(e, { tipo: 'item', id: m.id, nombre: m.titulo })}
                    className={`zr-card p-4 ${
                      !m.publicado && m.estadoAprobacion !== 'rechazado' ? 'border-2 border-zr-warning/60' : ''
                    }`}
                  >
                    {!m.publicado && m.estadoAprobacion !== 'rechazado' && (
                      <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-zr-warning">
                        <IconoAviso size={14} />
                        Los estudiantes NO ven este archivo todavía
                      </p>
                    )}
                    {editandoMaterialId === m.id ? (
                      <div className="space-y-2.5">
                        <input
                          autoFocus
                          value={formEdicionMaterial.titulo}
                          onChange={(e) => setFormEdicionMaterial((f) => ({ ...f, titulo: e.target.value }))}
                          placeholder="Título"
                          className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
                        />
                        <input
                          type="number"
                          min={1}
                          value={formEdicionMaterial.semana}
                          onChange={(e) => setFormEdicionMaterial((f) => ({ ...f, semana: e.target.value === '' ? '' : Number(e.target.value) }))}
                          placeholder="Semana (opcional)"
                          className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-2 text-sm tabular-nums text-zr-text focus:border-zr-blue focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => guardarEdicionMaterial(m)}
                            disabled={guardandoEdicion || !formEdicionMaterial.titulo.trim()}
                            className="flex-1 rounded-lg bg-zr-blue py-2 text-sm font-bold text-white disabled:opacity-50"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditandoMaterialId(null)}
                            className="flex-1 rounded-lg border border-zr-border py-2 text-sm font-semibold text-zr-text"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
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
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          <button
                            onClick={() => descargar(m)}
                            disabled={descargando === m.id || !m.rutaStorage}
                            className="rounded-full border border-zr-border px-3 py-1.5 text-xs font-bold text-zr-text disabled:opacity-50"
                          >
                            {descargando === m.id ? '…' : 'Descargar'}
                          </button>
                          {puedeCrearCarpetas && (
                            <button
                              onClick={() => abrirMover({ tipo: 'item', id: m.id, nombre: m.titulo })}
                              className="rounded-full border border-zr-border px-3 py-1.5 text-xs font-bold text-zr-text"
                            >
                              Mover
                            </button>
                          )}
                          <button
                            onClick={() => abrirEdicionMaterial(m)}
                            className="rounded-full border border-zr-border px-3 py-1.5 text-xs font-bold text-zr-text"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => eliminarMaterial(m)}
                            disabled={eliminando === m.id}
                            className="rounded-full border border-zr-error/40 px-3 py-1.5 text-xs font-bold text-zr-error disabled:opacity-50"
                          >
                            {eliminando === m.id ? '…' : 'Borrar'}
                          </button>
                          {m.estadoAprobacion === 'rechazado' ? (
                            <Etiqueta tono="error">Rechazado</Etiqueta>
                          ) : (
                            <button onClick={() => alternarPublicado(m)}>
                              <Etiqueta tono={m.publicado ? 'exito' : 'aviso'}>
                                {m.publicado ? 'Publicado' : 'Borrador — sin publicar'}
                              </Etiqueta>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Seccion>

      {mensajeMovido && (
        <p className="fixed inset-x-5 bottom-24 z-40 rounded-lg bg-zr-success px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
          {mensajeMovido}
        </p>
      )}

      {moviendo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-5">
          <div className="max-h-[80dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl bg-zr-surface p-5 sm:rounded-2xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zr-text-muted">
                Mover {moviendo.tipo === 'item' ? 'archivo' : 'carpeta'}
              </p>
              <p className="mt-1 break-words text-base font-semibold text-zr-text">{moviendo.nombre}</p>
              <p className="mt-1 text-xs text-zr-text-muted">
                Elige la carpeta de destino (dentro de {programa?.moduloNombre ?? 'este módulo'}).
              </p>
            </div>
            <div className="space-y-1.5">
              {opcionesDestino().map((o) => (
                <button
                  key={o.id ?? 'raiz'}
                  disabled={moviendoEnCurso}
                  onClick={() => moverA(moviendo, o.id, o.nombre)}
                  style={{ paddingLeft: 12 + o.nivel * 18 }}
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-zr-border pr-3 text-left text-sm font-semibold text-zr-text disabled:opacity-50"
                >
                  <span>{o.id === null ? '🏠' : '📁'}</span>
                  <span className="truncate">{o.nombre}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setMoviendo(null)}
              className="min-h-11 w-full rounded-lg border border-zr-border text-sm font-bold text-zr-text"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {formAbierto && (
        <div className="zr-card space-y-5 p-6">
          <p className="text-sm font-semibold text-zr-text">
            Sube a: {programa?.moduloNombre ?? 'Módulo'}
            {pilaCarpetas.length > 0 && ` / ${pilaCarpetas[pilaCarpetas.length - 1].nombre}`}
          </p>
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Archivo (PDF, PowerPoint, Word, Excel, imagen, video o audio)</label>
            <input
              type="file"
              accept={ACCEPT_MATERIAL}
              onChange={async (e) => {
                const f = e.target.files?.[0] ?? null
                setArchivo(f)
                setAvisoPeso(null)
                if (!f) return
                // Aviso suave, no bloquea (migración 117): un archivo muy
                // pesado se ve lento o mal en teléfonos de gama baja.
                const { data } = await createClient()
                  .from('system_config').select('value').eq('key', 'content.aviso_pesado_mb').maybeSingle()
                const limiteMB = Number(data?.value)
                if (limiteMB && f.size > limiteMB * 1024 * 1024) {
                  setAvisoPeso(
                    `Este archivo pesa ${(f.size / 1024 / 1024).toFixed(0)} MB. En teléfonos de gama baja puede tardar mucho o verse mal. Conviene comprimirlo (por debajo de ${limiteMB} MB) antes de subirlo.`,
                  )
                }
              }}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-sm text-zr-text file:mr-4 file:rounded file:border-0 file:bg-zr-blue file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
            {avisoPeso && (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-zr-warning">
                <IconoAviso size={14} className="mt-0.5 shrink-0" />
                {avisoPeso}
              </p>
            )}
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
