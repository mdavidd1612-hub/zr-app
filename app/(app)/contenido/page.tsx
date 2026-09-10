'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconoDocumento, IconoVideo, IconoAviso } from '@/components/ui/Iconos'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * T-402 · Repositorio de contenido del estudiante.
 *
 * Organizado en carpetas, como Classroom — a pedido explícito del
 * coordinador. RLS ya filtra: solo material publicado, con visible_from
 * vencido y del módulo del estudiante (migración 012); las carpetas también
 * se filtran solas por su propio módulo (migración 081). Aquí no se repite
 * ese filtro, solo se navega y se pide la data.
 *
 * Bug real de producción (sept. 2026): el visor embebido (iframe para PDF)
 * se quedaba en blanco cargando para siempre en Android -- probado y
 * confirmado por el coordinador en un teléfono real. "Descargar" sí
 * funciona bien en iOS y Android por igual, así que a pedido explícito se
 * quita el botón "Ver" hasta que ese visor se pueda arreglar de verdad; por
 * ahora solo se descarga.
 */

interface Carpeta {
  id: string
  nombre: string
}

interface Material {
  id: string
  titulo: string
  semana: number | null
  tamañoKB: number | null
  tipo: 'pdf' | 'video' | 'presentacion' | string
}

export default function Contenido() {
  const router = useRouter()
  const [pilaCarpetas, setPilaCarpetas] = useState<Carpeta[]>([])
  const [subcarpetas, setSubcarpetas] = useState<Carpeta[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])
  const [cargando, setCargando] = useState(true)
  const [descargando, setDescargando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const carpetaActual = pilaCarpetas[pilaCarpetas.length - 1]?.id ?? null

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const consultaCarpetas = supabase.from('content_folders').select('id, name')
      const consultaItems = supabase
        .from('content_items')
        .select('id, title, week_number, size_bytes, type')
        .in('type', ['pdf', 'video', 'presentacion'])

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
        })),
      )
      setCargando(false)
    }

    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, carpetaActual])

  function abrirCarpeta(c: Carpeta) {
    setCargando(true)
    setPilaCarpetas((p) => [...p, c])
  }

  function irARaiz() {
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
      setDescargando(null)
      setError('No se pudo descargar el archivo. Intenta de nuevo.')
      return
    }

    const { data: firmada } = await supabase.storage
      .from('contenido')
      .createSignedUrl(item.storage_path, 300, { download: true })

    setDescargando(null)
    if (!firmada?.signedUrl) {
      pestañaNueva?.close()
      setError('No se pudo descargar el archivo. Intenta de nuevo.')
      return
    }

    if (pestañaNueva) pestañaNueva.location.href = firmada.signedUrl
    else window.open(firmada.signedUrl, '_blank', 'noopener,noreferrer')
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
                  {m.tipo === 'video'
                    ? <IconoVideo size={22} className="mt-0.5 shrink-0 text-zr-blue" />
                    : <IconoDocumento size={22} className="mt-0.5 shrink-0 text-zr-error" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zr-text">{m.titulo}</p>
                    <p className="mt-1 text-xs text-zr-text-muted">
                      {m.semana ? `Semana ${m.semana}` : ''}
                      {m.tamañoKB ? `${m.semana ? ' · ' : ''}${(m.tamañoKB / 1024).toFixed(1)} MB` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold uppercase tracking-wide ${m.tipo === 'video' ? 'text-zr-blue/80' : 'text-zr-error/80'}`}>
                    {m.tipo === 'video' ? 'VIDEO' : m.tipo === 'presentacion' ? 'PPT' : 'PDF'}
                  </span>
                </div>
                {/* Solo "Descargar" por ahora (pedido explícito, sept.
                    2026): el visor embebido se quedaba en blanco cargando
                    para siempre en Android. Ver la nota del componente. */}
                <div className="mt-3">
                  <button
                    onClick={() => descargar(m)}
                    disabled={descargando === m.id}
                    className="flex min-h-11 w-full items-center justify-center rounded-lg bg-zr-blue text-sm font-bold text-white disabled:opacity-50"
                  >
                    {descargando === m.id ? 'Descargando…' : 'Descargar'}
                  </button>
                </div>
              </div>
            ))}
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
            Toca "Descargar" y luego ábrelo desde tus descargas o notificaciones.
          </p>
        </div>
      </div>
    </div>
  )
}
