'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconoDocumento, IconoVideo, IconoAviso, IconoCerrar } from '@/components/ui/Iconos'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * T-402 · Repositorio de contenido del estudiante.
 *
 * RLS ya filtra: solo material publicado, con visible_from vencido y del
 * módulo del estudiante (migración 012). Aquí no se repite ese filtro, solo
 * se pide la data.
 *
 * B-4 (docs/18_BRECHAS_SPEC_FUNCIONAL_ZRM.md, spec §6): el visor queda
 * embebido en la misma pantalla (iframe para PDF, <video> para video) en vez
 * de abrir una pestaña nueva — la spec pide explícitamente "minimizar
 * fricción, que no tenga que descargar cada archivo".
 */

interface Material {
  id: string
  titulo: string
  semana: number | null
  tamañoKB: number | null
  tipo: 'pdf' | 'video' | 'presentacion' | string
}

interface Abierto {
  id: string
  titulo: string
  tipo: 'pdf' | 'video' | 'presentacion' | string
  url: string
}

export default function Contenido() {
  const router = useRouter()
  const [materiales, setMateriales] = useState<Material[]>([])
  const [cargando, setCargando] = useState(true)
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<Abierto | null>(null)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('content_items')
        .select('id, title, week_number, size_bytes, type')
        .in('type', ['pdf', 'video', 'presentacion'])
        .order('week_number', { ascending: true, nullsFirst: false })

      setMateriales(
        (data ?? []).map((m) => ({
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
  }, [router])

  async function abrir(m: Material) {
    setAbriendo(m.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: item } = await supabase
      .from('content_items')
      .select('storage_path')
      .eq('id', m.id)
      .single()

    if (!item?.storage_path) {
      setAbriendo(null)
      return
    }

    const { data: firmada } = await supabase.storage
      .from('contenido')
      .createSignedUrl(item.storage_path, 300)

    // Se registra la vista sin bloquear la apertura: si falla, el estudiante
    // igual debe poder ver el archivo.
    if (user) {
      void supabase.from('content_views').insert({ content_item_id: m.id, student_id: user.id })
    }

    setAbriendo(null)
    if (!firmada?.signedUrl) return

    // El PowerPoint no se puede incrustar en un iframe (el navegador no lo
    // sabe renderizar) — se abre directo, como cualquier descarga, en vez de
    // forzar el visor de pantalla completa que sí sirve para PDF y video.
    if (m.tipo === 'presentacion') {
      window.open(firmada.signedUrl, '_blank', 'noopener,noreferrer')
      return
    }

    setAbierto({ id: m.id, titulo: m.titulo, tipo: m.tipo, url: firmada.signedUrl })
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando material…</p>
      </div>
    )
  }

  const grouped = materiales.reduce((acc, m) => {
    const clave = m.semana ?? 0
    if (!acc[clave]) acc[clave] = []
    acc[clave].push(m)
    return acc
  }, {} as Record<number, Material[]>)

  const semanas = Object.keys(grouped).map(Number).sort((a, b) => a - b)

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      {abierto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between gap-3 bg-zr-surface px-5 py-4">
            <p className="min-w-0 truncate text-sm font-semibold text-zr-text">{abierto.titulo}</p>
            <button
              onClick={() => setAbierto(null)}
              aria-label="Cerrar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zr-text-muted active:bg-zr-border/50"
            >
              <IconoCerrar size={18} />
            </button>
          </div>
          <div className="flex-1">
            {abierto.tipo === 'video' ? (
              <video src={abierto.url} controls autoPlay className="h-full w-full bg-black" />
            ) : (
              <iframe src={abierto.url} title={abierto.titulo} className="h-full w-full border-0 bg-white" />
            )}
          </div>
        </div>
      )}

      <div className="space-y-9">
        <BotonVolver href="/" />

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
            Repositorio
          </p>
          <h1 className="zr-display mt-3 text-4xl text-zr-text">Material de estudio</h1>
          <p className="mt-3 text-base text-zr-text-muted">
            {materiales.length === 0
              ? 'Todavía no hay material disponible'
              : `${materiales.length} archivo${materiales.length === 1 ? '' : 's'} disponible${materiales.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <div className="h-px bg-zr-border" />

        {materiales.length === 0 && (
          <div className="zr-card p-8 text-center">
            <p className="text-base font-semibold text-zr-text">Todavía no hay material</p>
            <p className="mt-2 text-sm text-zr-text-muted">
              Tu profesor sube las guías aquí a medida que avanza el módulo.
            </p>
          </div>
        )}

        {semanas.map((semana, i) => (
          <section key={semana} className="animate-rise space-y-4" style={{ animationDelay: `${i * 80}ms` }}>
            <p className="zr-eyebrow">
              {String(i + 1).padStart(2, '0')} — {semana === 0 ? 'Sin semana asignada' : `Semana ${semana}`}
            </p>
            <div className="space-y-2">
              {grouped[semana].map((m) => (
                <button
                  key={m.id}
                  onClick={() => abrir(m)}
                  disabled={abriendo === m.id}
                  className="zr-card zr-card-interactive flex w-full items-start gap-3 p-4 text-left disabled:opacity-60"
                >
                  {m.tipo === 'video'
                    ? <IconoVideo size={22} className="mt-0.5 shrink-0 text-zr-blue" />
                    : <IconoDocumento size={22} className="mt-0.5 shrink-0 text-zr-error" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zr-text">{m.titulo}</p>
                    {m.tamañoKB && (
                      <p className="mt-1 text-xs text-zr-text-muted">
                        {(m.tamañoKB / 1024).toFixed(1)} MB
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs font-bold uppercase tracking-wide ${m.tipo === 'video' ? 'text-zr-blue/80' : 'text-zr-error/80'}`}>
                    {abriendo === m.id ? '...' : m.tipo === 'video' ? 'VIDEO' : m.tipo === 'presentacion' ? 'PPT' : 'PDF'}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}

        <div className="space-y-2 rounded-lg border border-zr-blue/30 bg-zr-blue/10 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-zr-text">
            <IconoAviso size={18} className="text-zr-blue" />
            Consejo
          </p>
          <p className="text-sm text-zr-text-muted">
            Puedes verlos directo aquí, sin descargar — tócalos para abrirlos.
          </p>
        </div>
      </div>
    </div>
  )
}
