'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TipoMaterial } from '@/lib/material'
import { urlDelVisor, visorDe } from '@/lib/material'
import { IconoDocumento } from '@/components/ui/Iconos'

/**
 * Visor incrustado DENTRO de la pantalla, sin iframe a un sitio externo.
 *
 * Bug real de producción (sept. 2026, app/(app)/contenido/page.tsx): un
 * <iframe> con la página del visor se quedaba en blanco para siempre en
 * Android, y se cambió por "abrir en pestaña nueva". Este componente no
 * repite ese error porque no es un iframe a otra página: el PDF se
 * descarga y se dibuja en un <canvas> con pdfjs-dist (la MISMA librería
 * que ya está instalada), el video es un <video> nativo y la imagen un
 * <img> normal -- nada de eso navega a un dominio ajeno. Solo la
 * presentación (.pptx) sigue sin forma segura de incrustarse (ningún
 * navegador la renderiza solo) y usa el mismo patrón ya probado de
 * contenido/page.tsx: pestaña nueva al visor de Office de Microsoft.
 *
 * Mide el progreso real para Aula Virtual (spec/07_AULA_VIRTUAL.md §6.1):
 * video/audio por segmentos vistos (timeupdate), PDF por página alcanzada.
 * Se guarda en material_progress cada ~15s (system_config
 * aula.material_progress_guardar_cada_seg) y al desmontar la pantalla.
 */

interface Props {
  contentItemId: string
  tipo: TipoMaterial
  storagePath: string
  bucket?: string
}

export function VisorMaterial({ contentItemId, tipo, storagePath, bucket = 'contenido' }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [numPaginas, setNumPaginas] = useState(0)
  const [paginaMaxVista, setPaginaMaxVista] = useState(0)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const percentRef = useRef(0)
  const ultimaPercentGuardada = useRef(-1)
  const videoRef = useRef<HTMLVideoElement>(null)

  async function guardarProgreso(percent: number) {
    percentRef.current = percent
    if (Math.abs(percent - ultimaPercentGuardada.current) < 2) return
    ultimaPercentGuardada.current = percent
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('material_progress').upsert(
      { student_id: user.id, content_item_id: contentItemId, percent },
      { onConflict: 'student_id,content_item_id' },
    )
  }

  // URL firmada: 1h para PDF (se pide por trozos mientras se lee, igual que
  // contenido/page.tsx), 10 min para lo demás.
  useEffect(() => {
    let cancelado = false
    async function cargar() {
      const supabase = createClient()
      const { data, error: err } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, tipo === 'pdf' ? 3600 : 600)
      if (cancelado) return
      if (err || !data?.signedUrl) {
        setError('No se pudo cargar el material. Intenta de nuevo.')
        return
      }
      setUrl(data.signedUrl)
    }
    cargar()
    return () => { cancelado = true }
  }, [storagePath, bucket, tipo])

  // Guardado periódico, cada ~15s mientras la pantalla está abierta.
  useEffect(() => {
    const id = setInterval(() => { void guardarProgreso(percentRef.current) }, 15_000)
    return () => {
      clearInterval(id)
      void guardarProgreso(percentRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- PDF: pdfjs-dist, páginas en canvas, sin ningún iframe -----------
  useEffect(() => {
    if (tipo !== 'pdf' || !url) return
    let cancelado = false

    async function render() {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

      const doc = await pdfjsLib.getDocument({ url: url as string }).promise
      if (cancelado) return
      setNumPaginas(doc.numPages)

      for (let n = 1; n <= doc.numPages; n++) {
        if (cancelado) return
        const pagina = await doc.getPage(n)
        const canvas = canvasRefs.current.get(n)
        if (!canvas) continue
        const viewport = pagina.getViewport({ scale: 1.3 })
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        await pagina.render({ canvasContext: ctx, viewport, canvas }).promise
      }
    }

    render().catch(() => { if (!cancelado) setError('No se pudo mostrar el PDF. Intenta de nuevo.') })
    return () => { cancelado = true }
  }, [tipo, url])

  // Qué tan abajo se ha desplazado el estudiante decide qué página
  // "alcanzó" -- el % de avance es paginaMaxVista / numPaginas.
  function alDesplazar(e: React.UIEvent<HTMLDivElement>) {
    if (tipo !== 'pdf' || numPaginas === 0) return
    const el = e.currentTarget
    const fraccion = (el.scrollTop + el.clientHeight) / el.scrollHeight
    const pagina = Math.min(numPaginas, Math.max(1, Math.ceil(fraccion * numPaginas)))
    if (pagina > paginaMaxVista) {
      setPaginaMaxVista(pagina)
      void guardarProgreso(Math.round((pagina / numPaginas) * 100))
    }
  }

  // ---- Video/audio: elemento nativo, segmentos realmente vistos --------
  // No basta con la posición final (spec §6.1: adelantar con la barra no
  // debe contar como visto) -- se suman los tramos reproducidos de verdad.
  const segmentos = useRef<Array<[number, number]>>([])
  const inicioSegmento = useRef<number | null>(null)

  function alReproducir() { inicioSegmento.current = videoRef.current?.currentTime ?? 0 }
  function alPausarOFin() {
    const el = videoRef.current
    if (!el || inicioSegmento.current === null) return
    segmentos.current.push([inicioSegmento.current, el.currentTime])
    inicioSegmento.current = null
    medirSegmentos(el.duration)
  }
  function alAvanzarTiempo() {
    const el = videoRef.current
    if (!el || !el.duration) return
    medirSegmentos(el.duration)
  }
  function medirSegmentos(duracion: number) {
    if (!duracion || !isFinite(duracion)) return
    // Fusiona tramos solapados para no contar dos veces el mismo segundo.
    const ordenados = [...segmentos.current].sort((a, b) => a[0] - b[0])
    const fusionados: Array<[number, number]> = []
    for (const [ini, fin] of ordenados) {
      const ultimo = fusionados[fusionados.length - 1]
      if (ultimo && ini <= ultimo[1] + 1) ultimo[1] = Math.max(ultimo[1], fin)
      else fusionados.push([ini, fin])
    }
    const totalVisto = fusionados.reduce((s, [i, f]) => s + (f - i), 0)
    void guardarProgreso(Math.min(100, Math.round((totalVisto / duracion) * 100)))
  }

  if (error) {
    return (
      <div className="zr-card flex flex-col items-center gap-3 p-8 text-center">
        <IconoDocumento size={28} className="text-zr-text-muted" />
        <p className="text-sm text-zr-text-muted">{error}</p>
      </div>
    )
  }

  if (!url) {
    return <div className="zr-skel h-64 w-full rounded-xl" />
  }

  if (tipo === 'video') {
    return (
      <video
        ref={videoRef}
        src={url}
        controls
        playsInline
        className="w-full rounded-xl bg-black"
        onPlay={alReproducir}
        onPause={alPausarOFin}
        onEnded={alPausarOFin}
        onTimeUpdate={alAvanzarTiempo}
      />
    )
  }

  if (tipo === 'audio') {
    return (
      <audio
        ref={videoRef as unknown as React.RefObject<HTMLAudioElement>}
        src={url}
        controls
        className="w-full"
        onPlay={alReproducir}
        onPause={alPausarOFin}
        onEnded={alPausarOFin}
        onTimeUpdate={alAvanzarTiempo}
      />
    )
  }

  if (tipo === 'imagen') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="w-full rounded-xl" onLoad={() => void guardarProgreso(100)} />
  }

  if (tipo === 'pdf') {
    return (
      <div onScroll={alDesplazar} className="max-h-[75vh] space-y-3 overflow-y-auto rounded-xl bg-zr-surface p-2">
        {numPaginas === 0 && <div className="zr-skel h-64 w-full rounded-xl" />}
        {Array.from({ length: numPaginas }, (_, i) => i + 1).map((n) => (
          <canvas
            key={n}
            ref={(el) => { if (el) canvasRefs.current.set(n, el); else canvasRefs.current.delete(n) }}
            className="mx-auto block w-full rounded-lg shadow"
          />
        ))}
      </div>
    )
  }

  // Presentación (.pptx) y documentos de Office: sin forma segura de
  // incrustarse -- mismo patrón ya probado en contenido/page.tsx, pestaña
  // nueva al visor de Office. El progreso aquí es "lo abrió", no granular.
  const visor = visorDe(tipo, storagePath)
  return (
    <div className="zr-card flex flex-col items-center gap-4 p-8 text-center">
      <IconoDocumento size={28} className="text-zr-text-muted" />
      <p className="text-sm text-zr-text-muted">
        Este tipo de archivo se abre en una pestaña aparte.
      </p>
      <button
        onClick={() => {
          window.open(urlDelVisor(visor, url), '_blank', 'noopener,noreferrer')
          void guardarProgreso(100)
        }}
        className="min-h-12 rounded-lg bg-zr-blue px-6 text-sm font-bold text-white"
      >
        Abrir material
      </button>
    </div>
  )
}
