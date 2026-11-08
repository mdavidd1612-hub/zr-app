'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TipoMaterial } from '@/lib/material'
import { urlDelVisor, visorDe, idDeYoutube, urlEmbedYoutube } from '@/lib/material'
import { IconoDocumento } from '@/components/ui/Iconos'

/**
 * Botones flotantes de acercar/alejar -- en imagen, PDF y Word.
 *
 * Bug real reportado en vivo (8-nov-2026): con `position: absolute` dentro
 * del contenedor con scroll, el botón quedaba al final de TODO el contenido
 * (la última página de un PDF largo), no a la vista. `fixed` lo clava en un
 * lugar fijo de la PANTALLA, sin importar cuánto se haya desplazado el
 * documento -- "un botón flotante que esté siempre fijo", como se pidió.
 */
function ControlZoom({ zoom, onAcercar, onAlejar }: { zoom: number; onAcercar: () => void; onAlejar: () => void }) {
  return (
    <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-5 z-[65] flex items-center gap-1 rounded-full bg-black/70 p-1 text-white shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={onAlejar}
        disabled={zoom <= 1}
        aria-label="Alejar"
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-10 text-center text-xs font-bold tabular-nums">{Math.round(zoom * 100)}%</span>
      <button
        type="button"
        onClick={onAcercar}
        disabled={zoom >= 3}
        aria-label="Acercar"
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}

/**
 * Pellizcar con dos dedos para acercar/alejar -- pedido explícito (8-nov-2026,
 * "o si no, en poder agrandar la pantalla con los dos dedos pellizcando").
 * El navegador tiene el pellizco nativo desactivado a propósito en TODA la
 * app (`app/layout.tsx`, `viewport.userScalable: false`), así que este gesto
 * se arma a mano, solo en el visor. `touchmove` tiene que registrarse manual
 * con `{ passive: false }` -- React lo adjunta pasivo por defecto, y ahí
 * `preventDefault()` no sirve de nada (el navegador seguiría haciendo scroll
 * con los dos dedos a la vez que se pellizca).
 */
function usePinchZoom(min: number, max: number, zoom: number, setZoom: (z: number) => void) {
  const ref = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoom)
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  const distInicioRef = useRef<number | null>(null)
  const zoomInicioRef = useRef(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const distancia = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

    function onStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        distInicioRef.current = distancia(e.touches)
        zoomInicioRef.current = zoomRef.current
      }
    }
    function onMove(e: TouchEvent) {
      if (e.touches.length === 2 && distInicioRef.current) {
        e.preventDefault()
        const factor = distancia(e.touches) / distInicioRef.current
        setZoom(Math.min(max, Math.max(min, zoomInicioRef.current * factor)))
      }
    }
    function onEnd(e: TouchEvent) {
      if (e.touches.length < 2) distInicioRef.current = null
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [min, max, setZoom])

  return ref
}

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
  /** Vacío para tipo='enlace' (video de YouTube) -- no hay archivo que firmar. */
  storagePath: string
  /** Solo para tipo='enlace': el link que pegó el profesor. */
  externalUrl?: string | null
  bucket?: string
  /**
   * false para visores que no son "material del estudiante" -- p. ej. el
   * profesor viendo la entrega de una tarea (components/ui/VisorEntrega.tsx):
   * ahí no hay content_item_id real que medir, y nunca debe escribirse en
   * material_progress. Default true (comportamiento de siempre).
   */
  registrarProgreso?: boolean
}

/** Solo .docx (Open XML) -- mammoth no sabe leer el .doc binario viejo. */
function esDocx(storagePath: string): boolean {
  return storagePath.toLowerCase().endsWith('.docx')
}

export function VisorMaterial({ contentItemId, tipo, storagePath, externalUrl, bucket = 'contenido', registrarProgreso = true }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [numPaginas, setNumPaginas] = useState(0)
  const [paginaMaxVista, setPaginaMaxVista] = useState(0)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const percentRef = useRef(0)
  const ultimaPercentGuardada = useRef(-1)
  const videoRef = useRef<HTMLVideoElement>(null)
  // Word (.docx) -- pedido explícito del coordinador (8-nov-2026): "todos los
  // archivos se tienen que abrir directo en la aplicación". PDF/video/audio/
  // imagen ya lo hacían; PowerPoint se queda en pestaña aparte (sin forma
  // confiable de incrustarse gratis), pero Word sí -- se convierte a HTML en
  // el navegador (mammoth) y se limpia con DOMPurify antes de mostrarlo.
  const [htmlWord, setHtmlWord] = useState<string | null>(null)
  // Acercar/alejar imagen y PDF (pedido real, 8-nov-2026): la app desactiva
  // el pellizco nativo del navegador a propósito en toda la app
  // (app/layout.tsx, viewport.userScalable=false, "para que se sienta como
  // app") -- así que aquí, solo en el visor, se arma un acercamiento propio
  // con botones. Cambiar el ANCHO (no un transform) para que el contenedor
  // con overflow-auto genere scroll de verdad.
  const [zoom, setZoom] = useState(1)
  const ZOOM_MIN = 1
  const ZOOM_MAX = 3
  const refPellizco = usePinchZoom(ZOOM_MIN, ZOOM_MAX, zoom, setZoom)
  const maxFraccionWord = useRef(0)

  async function guardarProgreso(percent: number) {
    if (!registrarProgreso) return
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
    if (tipo === 'enlace') return
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

  // ---- Word (.docx): mammoth -> HTML, limpiado con DOMPurify -------------
  useEffect(() => {
    if (tipo !== 'documento' || !esDocx(storagePath) || !url) return
    let cancelado = false

    async function render() {
      const [{ default: mammoth }, { default: DOMPurify }] = await Promise.all([
        import('mammoth'),
        import('dompurify'),
      ])
      const datos = await fetch(url as string).then((r) => r.arrayBuffer())
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer: datos })
      if (cancelado) return
      setHtmlWord(DOMPurify.sanitize(html))
    }

    render().catch(() => { if (!cancelado) setError('No se pudo mostrar el documento. Intenta de nuevo.') })
    return () => { cancelado = true }
  }, [tipo, storagePath, url])

  function alDesplazarWord(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const fraccion = el.scrollHeight <= el.clientHeight ? 1 : (el.scrollTop + el.clientHeight) / el.scrollHeight
    if (fraccion > maxFraccionWord.current) {
      maxFraccionWord.current = fraccion
      void guardarProgreso(Math.round(fraccion * 100))
    }
  }

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

  // Video de YouTube (pedido explícito del coordinador, 8-nov-2026): no hay
  // archivo que firmar -- el embed va directo con el id extraído del link
  // que pegó el profesor, en youtube-nocookie.com (sin cookies de rastreo).
  // Único caso legítimo de iframe aquí: a diferencia del visor de Office que
  // sí dio problemas en Android, el embed de YouTube está hecho para esto.
  if (tipo === 'enlace') {
    const videoId = externalUrl ? idDeYoutube(externalUrl) : null
    if (!videoId) {
      return (
        <div className="zr-card flex flex-col items-center gap-3 p-8 text-center">
          <IconoDocumento size={28} className="text-zr-text-muted" />
          <p className="text-sm text-zr-text-muted">El link de YouTube no es válido.</p>
        </div>
      )
    }
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={urlEmbedYoutube(videoId)}
          title="Video de YouTube"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
          onLoad={() => void guardarProgreso(100)}
        />
      </div>
    )
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

  // Pedido explícito (8-nov-2026): el acercar/alejar tiene que valer para
  // TODOS los documentos que se ven dentro de la app, no solo imagen/PDF --
  // se agregó también a Word. PowerPoint se queda sin zoom: se abre en una
  // pestaña del navegador, fuera de nuestro control.
  const controlZoomComun = (
    <ControlZoom
      zoom={zoom}
      onAcercar={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.5))}
      onAlejar={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.5))}
    />
  )

  if (tipo === 'imagen') {
    return (
      <div ref={refPellizco} className="relative max-h-[75vh] overflow-auto rounded-xl bg-zr-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
          className="rounded-xl"
          onLoad={() => void guardarProgreso(100)}
        />
        {controlZoomComun}
      </div>
    )
  }

  if (tipo === 'pdf') {
    return (
      <div ref={refPellizco} onScroll={alDesplazar} className="max-h-[75vh] overflow-auto rounded-xl bg-zr-surface p-2">
        {numPaginas === 0 && <div className="zr-skel h-64 w-full rounded-xl" />}
        <div style={{ width: `${zoom * 100}%` }} className="space-y-3">
          {Array.from({ length: numPaginas }, (_, i) => i + 1).map((n) => (
            <canvas
              key={n}
              ref={(el) => { if (el) canvasRefs.current.set(n, el); else canvasRefs.current.delete(n) }}
              className="mx-auto block w-full rounded-lg shadow"
            />
          ))}
        </div>
        {controlZoomComun}
      </div>
    )
  }

  if (tipo === 'documento' && esDocx(storagePath)) {
    if (!htmlWord) return <div className="zr-skel h-64 w-full rounded-xl" />
    return (
      <div
        ref={refPellizco}
        onScroll={alDesplazarWord}
        className="zr-card max-h-[75vh] overflow-auto p-6"
      >
        <div
          style={{ width: `${zoom * 100}%` }}
          className="text-sm leading-relaxed text-zr-text [&_h1]:zr-display [&_h1]:text-xl [&_h2]:text-lg [&_h2]:font-bold [&_p]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-zr-border [&_td]:p-2 [&_img]:max-w-full"
          dangerouslySetInnerHTML={{ __html: htmlWord }}
        />
        {controlZoomComun}
      </div>
    )
  }

  // Presentación (.pptx): sin forma segura de incrustarse gratis -- mismo
  // patrón ya probado en contenido/page.tsx, pestaña nueva al visor de
  // Office. El progreso aquí es "lo abrió", no granular.
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
