'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconoDocumento, IconoVideo, IconoAviso } from '@/components/ui/Iconos'
import { BotonVolver } from '@/components/ui/BotonVolver'
import {
  ETIQUETA_TIPO, nombreDescarga, registrarEvento, urlDelVisor, visorDe,
} from '@/lib/material'

/**
 * T-402 · Repositorio de contenido del estudiante.
 *
 * Organizado en carpetas, como Classroom — a pedido explícito del
 * coordinador. RLS ya filtra: solo material publicado, con visible_from
 * vencido y del módulo del estudiante (migración 012); las carpetas también
 * se filtran solas por su propio módulo (migración 081). Aquí no se repite
 * ese filtro, solo se navega y se pide la data.
 *
 * Bug real de producción (sept. 2026, primera vuelta): el visor embebido
 * -- un <iframe> DENTRO de esta pantalla -- se quedaba en blanco cargando
 * para siempre en Android. Se quitó el botón "Ver" hasta arreglarlo de
 * verdad, dejando solo "Descargar".
 *
 * "Ver" vuelve (pedido explícito del coordinador, sept. 2026, segunda
 * vuelta): muchos estudiantes no tienen con qué abrir un .pptx en el
 * teléfono una vez descargado. La solución no es un iframe propio (eso fue
 * justo lo que se rompió) -- es una pestaña nueva de verdad, como cuando en
 * WhatsApp Web un archivo abre en Google Drive: PDF y video los renderiza
 * el propio navegador con solo navegar a la URL firmada; una presentación
 * (.pptx) no la puede renderizar ningún navegador, así que esa URL se le
 * pasa al visor de Office de Microsoft (view.officeapps.live.com), que la
 * descarga él mismo del lado del servidor y la muestra como páginas web --
 * el estudiante nunca necesita tener PowerPoint instalado. "Descargar"
 * se queda como respaldo para quien de verdad quiera guardar el archivo.
 */

interface Carpeta {
  id: string
  nombre: string
}

interface ModuloVisible {
  id: string
  nombre: string
  orden: number
  esActual: boolean
}

interface Material {
  id: string
  titulo: string
  semana: number | null
  tamañoKB: number | null
  tipo: string
  nombreOriginal: string | null
}

export default function Contenido() {
  const router = useRouter()
  const [pilaCarpetas, setPilaCarpetas] = useState<Carpeta[]>([])
  const [subcarpetas, setSubcarpetas] = useState<Carpeta[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])
  const [cargando, setCargando] = useState(true)
  const [descargando, setDescargando] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Último material abierto con un visor externo: si no cargó, se ofrece
  // descargarlo y se anota el fallo (métrica de visores).
  const [sinAbrir, setSinAbrir] = useState<Material | null>(null)

  // Desde la migración 123 el estudiante ve el material de todos los módulos
  // que ya cursó de su programa (nunca los que aún no le tocan). La raíz
  // lista esos módulos; si solo hay uno, se entra directo.
  const [modulos, setModulos] = useState<ModuloVisible[]>([])
  const [moduloActual, setModuloActual] = useState<ModuloVisible | null>(null)
  const [modulosListos, setModulosListos] = useState(false)
  // 'No solvente' también bloquea Material (reunión de sept. 2026, migración
  // 128). La base ya no entrega nada; esto solo explica por qué.
  const [bloqueado, setBloqueado] = useState(false)

  const carpetaActual = pilaCarpetas[pilaCarpetas.length - 1]?.id ?? null

  useEffect(() => {
    async function cargarModulos() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: yo } = await supabase.from('students').select('payment_status').eq('id', user.id).maybeSingle()
        if (yo?.payment_status === 'no_solvente') {
          setBloqueado(true)
          setModulosListos(true)
          setCargando(false)
          return
        }
      }
      const [{ data: ids }, { data: items }, { data: carpetas }, { data: actual }] = await Promise.all([
        supabase.rpc('mis_modulos_cursados'),
        supabase.from('content_items').select('module_id'),
        supabase.from('content_folders').select('module_id'),
        supabase.rpc('my_module_id'),
      ])
      const conMaterial = new Set([
        ...(items ?? []).map((i) => i.module_id),
        ...(carpetas ?? []).map((c) => c.module_id),
      ])
      const idsCursados = (ids ?? []) as unknown as string[]
      const { data: mods } = idsCursados.length
        ? await supabase.from('modules').select('id, name, order_index').in('id', idsCursados).order('order_index')
        : { data: [] }
      const lista = (mods ?? [])
        .map((m) => ({ id: m.id, nombre: m.name, orden: m.order_index, esActual: m.id === actual }))
        .filter((m) => conMaterial.has(m.id) || m.esActual)
      setModulos(lista)
      if (lista.length === 1) setModuloActual(lista[0])
      setModulosListos(true)
      if (lista.length !== 1) setCargando(false)
    }
    cargarModulos()
  }, [])

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      if (!modulosListos) return
      if (!moduloActual) {
        setSubcarpetas([])
        setMateriales([])
        setCargando(false)
        return
      }

      const consultaCarpetas = supabase.from('content_folders').select('id, name').eq('module_id', moduloActual.id)
      const consultaItems = supabase
        .from('content_items')
        .select('id, title, week_number, size_bytes, type, original_name')
        .eq('module_id', moduloActual.id)

      const [{ data: subs }, { data: items }] = await Promise.all([
        (carpetaActual
          ? consultaCarpetas.eq('parent_folder_id', carpetaActual)
          : consultaCarpetas.is('parent_folder_id', null)
        ).order('name'),
        (carpetaActual
          ? consultaItems.eq('folder_id', carpetaActual)
          : consultaItems.is('folder_id', null)
        ).order('week_number', { ascending: true, nullsFirst: false }),
      ])

      setSubcarpetas((subs ?? []).map((c) => ({ id: c.id, nombre: c.name })))
      setMateriales(
        (items ?? []).map((m) => ({
          id: m.id,
          titulo: m.title,
          semana: m.week_number,
          tamañoKB: m.size_bytes ? Math.round(m.size_bytes / 1024) : null,
          tipo: m.type,
          nombreOriginal: m.original_name,
        })),
      )
      setCargando(false)
    }

    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, carpetaActual, moduloActual, modulosListos])

  function abrirCarpeta(c: Carpeta) {
    setCargando(true)
    setPilaCarpetas((p) => [...p, c])
  }

  function irARaiz() {
    setCargando(true)
    setPilaCarpetas([])
    // Con varios módulos, la raíz es la lista de módulos.
    if (modulos.length > 1) setModuloActual(null)
  }

  function abrirModulo(m: ModuloVisible) {
    setCargando(true)
    setPilaCarpetas([])
    setModuloActual(m)
  }

  function irAModulo() {
    setCargando(true)
    setPilaCarpetas([])
  }

  function volverA(indice: number) {
    setCargando(true)
    setPilaCarpetas((p) => p.slice(0, indice + 1))
  }

  // Bug real de producción (sept. 2026): el truco de <a download> clickeado
  // por código no sirve dentro de una PWA instalada en iOS -- WebKit en modo
  // standalone ignora el atributo `download` con una URL de otro dominio (la
  // de Storage), así que "se descargaba" sin ningún indicio visible: no
  // abría nada, no mostraba progreso, no dejaba salir de la PWA. Mismo
  // arreglo que ya usa `abrir()` para presentaciones: pestaña en blanco
  // ANTES del await (para que el navegador siga contando el click como
  // gesto del usuario) y se le pone la URL real después. Al ser una
  // navegación real, el sistema operativo se encarga de mostrar el archivo o
  // el diálogo de "abrir con" -- ya no depende de que WebKit honre `download`.
  async function descargar(m: Material) {
    setError(null)
    setDescargando(m.id)

    const pestañaNueva = window.open('', '_blank')

    const supabase = createClient()
    const { data: item } = await supabase
      .from('content_items').select('storage_path').eq('id', m.id).single()

    if (!item?.storage_path) {
      pestañaNueva?.close()
      void registrarEvento({ contentId: m.id, event: 'descargar', outcome: 'error_url', viewer: 'descarga', fileType: m.tipo })
      setDescargando(null)
      setError('No se pudo descargar el archivo. Intenta de nuevo.')
      return
    }

    const { data: firmada } = await supabase.storage
      .from('contenido')
      .createSignedUrl(item.storage_path, 300, { download: nombreDescarga({ originalName: m.nombreOriginal, titulo: m.titulo, rutaStorage: item.storage_path }) })

    setDescargando(null)
    if (!firmada?.signedUrl) {
      pestañaNueva?.close()
      void registrarEvento({ contentId: m.id, event: 'descargar', outcome: 'error_url', viewer: 'descarga', fileType: m.tipo })
      setError('No se pudo descargar el archivo. Intenta de nuevo.')
      return
    }

    void registrarEvento({
      contentId: m.id, event: 'descargar', outcome: 'abierto', viewer: 'descarga',
      fileType: m.tipo, sizeBytes: m.tamañoKB ? m.tamañoKB * 1024 : null,
    })
    if (pestañaNueva) pestañaNueva.location.href = firmada.signedUrl
    else window.open(firmada.signedUrl, '_blank', 'noopener,noreferrer')
  }

  // "Ver" (pedido explícito del coordinador, sept. 2026): pestaña nueva de
  // verdad, no un iframe dentro de esta pantalla (eso fue lo que se rompió
  // en Android la primera vez). PDF y video los abre el navegador
  // directamente -- los sabe mostrar solo. Una presentación (.pptx) nadie
  // la puede renderizar en un navegador, así que la URL firmada se le pasa
  // al visor de Office de Microsoft, que la convierte él mismo del lado del
  // servidor -- el estudiante no necesita tener PowerPoint instalado.
  async function ver(m: Material) {
    setError(null)
    setSinAbrir(null)
    setAbriendo(m.id)

    const pestañaNueva = window.open('', '_blank')

    const supabase = createClient()
    const { data: item } = await supabase
      .from('content_items').select('storage_path').eq('id', m.id).single()

    if (!item?.storage_path) {
      pestañaNueva?.close()
      void registrarEvento({ contentId: m.id, event: 'ver', outcome: 'error_url', fileType: m.tipo })
      setAbriendo(null)
      setError('No se pudo abrir el archivo. Intenta de nuevo.')
      return
    }

    // Sin `download: true` -- así el navegador (o el visor de Office) la
    // puede mostrar directo en vez de forzar la descarga. Un PDF pesado se
    // va pidiendo por trozos mientras se lee, así que su URL dura 1 hora;
    // el resto, 5 minutos (el visor de Office la baja de una sola vez).
    const { data: firmada } = await supabase.storage
      .from('contenido')
            .createSignedUrl(item.storage_path, m.tipo === 'pdf' ? 3600 : 300)

    setAbriendo(null)
    const visor = visorDe(m.tipo, item.storage_path)
    if (!firmada?.signedUrl) {
      pestañaNueva?.close()
      void registrarEvento({ contentId: m.id, event: 'ver', outcome: 'error_url', viewer: visor, fileType: m.tipo })
      setError('No se pudo abrir el archivo. Intenta de nuevo.')
      return
    }

    // PDF: reportado por Dirección Académica (sept. 2026) -- en teléfonos
    // Android (ej. Tecno 30) el navegador no trae visor de PDF propio: lo
    // descarga, o lo muestra con un visor básico que deforma la proporción.
    // Se abre en el visor pdf.js de Mozilla, que corre dentro del propio
    // navegador del teléfono (el archivo NO pasa por servidores de
    // terceros), se adapta al ancho de pantalla y pide el archivo por
    // trozos -- importa con PDFs pesados como la presentación de 38 MB.
    // Storage ya permite CORS desde cualquier origen.
    const urlFinal = urlDelVisor(visor, firmada.signedUrl)
    void registrarEvento({
      contentId: m.id, event: 'ver', outcome: 'abierto', viewer: visor,
      fileType: m.tipo, sizeBytes: m.tamañoKB ? m.tamañoKB * 1024 : null,
    })
    if (visor !== 'nativo') setSinAbrir(m)

    if (pestañaNueva) pestañaNueva.location.href = urlFinal
    else window.open(urlFinal, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-9">
        <BotonVolver href="/" />

        <div id="tour-material">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
            Repositorio
          </p>
          <h1 className="zr-display mt-3 text-4xl text-zr-text">Material de estudio</h1>
        </div>

        {/* Ruta de carpetas — tipo explorador de archivos */}
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <button
            onClick={irARaiz}
            className={`font-semibold ${pilaCarpetas.length === 0 ? 'text-zr-text' : 'text-zr-blue-mid'}`}
          >
            Material
          </button>
          {moduloActual && modulos.length > 1 && (
            <span className="flex items-center gap-1.5">
              <span className="text-zr-text-muted">/</span>
              <button
                onClick={irAModulo}
                className={`font-semibold ${pilaCarpetas.length === 0 ? 'text-zr-text' : 'text-zr-blue-mid'}`}
              >
                Módulo {moduloActual.orden}
              </button>
            </span>
          )}
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

        <div className="h-px bg-zr-border" />

        {cargando ? (
          <p className="text-sm text-zr-text-muted">Cargando…</p>
        ) : bloqueado ? (
          <div className="zr-card p-8 text-center">
            <p className="text-base font-semibold text-zr-text">Material bloqueado</p>
            <p className="mt-2 text-sm text-zr-text-muted">
              Tienes un pago pendiente. Habla con administración para ponerte al día y recuperar el acceso.
            </p>
          </div>
        ) : !moduloActual && modulos.length > 1 ? (
          <div className="space-y-2">
            {modulos.map((m) => (
              <button
                key={m.id}
                onClick={() => abrirModulo(m)}
                className="zr-card zr-card-interactive flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="text-xl">📚</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zr-text">Módulo {m.orden} · {m.nombre}</span>
                  {m.esActual && <span className="text-xs text-zr-blue-mid">Módulo actual</span>}
                </span>
              </button>
            ))}
          </div>
        ) : subcarpetas.length === 0 && materiales.length === 0 ? (
          <div className="zr-card p-8 text-center">
            <p className="text-base font-semibold text-zr-text">
              {pilaCarpetas.length === 0 ? 'Todavía no hay material' : 'Esta carpeta está vacía'}
            </p>
            {pilaCarpetas.length === 0 && (
              <p className="mt-2 text-sm text-zr-text-muted">
                Tu profesor sube las guías aquí a medida que avanza el módulo.
              </p>
            )}
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
              <div key={m.id} className="zr-card p-4">
                <div className="flex items-start gap-3">
                  {m.tipo === 'video' || m.tipo === 'audio'
                    ? <IconoVideo size={22} className="mt-0.5 shrink-0 text-zr-blue" />
                    : <IconoDocumento size={22} className="mt-0.5 shrink-0 text-zr-error" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zr-text">{m.titulo}</p>
                    <p className="mt-1 text-xs text-zr-text-muted">
                      {m.semana ? `Semana ${m.semana}` : ''}
                      {m.tamañoKB ? `${m.semana ? ' · ' : ''}${(m.tamañoKB / 1024).toFixed(1)} MB` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold uppercase tracking-wide ${m.tipo === 'video' || m.tipo === 'audio' ? 'text-zr-blue/80' : 'text-zr-error/80'}`}>
                    {ETIQUETA_TIPO[m.tipo] ?? m.tipo.toUpperCase()}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => ver(m)}
                    disabled={abriendo === m.id}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-zr-blue text-sm font-bold text-white disabled:opacity-50"
                  >
                    {abriendo === m.id ? 'Abriendo…' : 'Ver'}
                  </button>
                  <button
                    onClick={() => descargar(m)}
                    disabled={descargando === m.id}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-zr-border text-sm font-bold text-zr-text disabled:opacity-50"
                  >
                    {descargando === m.id ? 'Descargando…' : 'Descargar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {sinAbrir && (
          <div className="space-y-3 rounded-lg border border-zr-blue/30 bg-zr-blue/10 p-4">
            <p className="text-sm text-zr-text">
              ¿&ldquo;{sinAbrir.titulo}&rdquo; no se abrió o se ve mal? Descárgalo y ábrelo desde tu teléfono.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const m = sinAbrir
                  setSinAbrir(null)
                  void registrarEvento({
                    contentId: m.id, event: 'ver', outcome: 'visor_fallo',
                    viewer: visorDe(m.tipo, m.nombreOriginal ?? ''), fileType: m.tipo,
                  })
                  void descargar(m)
                }}
                className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-zr-blue text-sm font-bold text-white"
              >
                Descargar
              </button>
              <button
                onClick={() => setSinAbrir(null)}
                className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-zr-border text-sm font-bold text-zr-text"
              >
                Se abrió bien
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
            {error}
          </p>
        )}

        <div className="space-y-2 rounded-lg border border-zr-blue/30 bg-zr-blue/10 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-zr-text">
            <IconoAviso size={18} className="text-zr-blue" />
            Consejo
          </p>
          <p className="text-sm text-zr-text-muted">
            Toca &ldquo;Ver&rdquo; para abrirlo en el navegador, sin necesitar PowerPoint ni
            ninguna otra app instalada. &ldquo;Descargar&rdquo; lo guarda en tu teléfono si
            prefieres eso.
          </p>
        </div>
      </div>
    </div>
  )
}
