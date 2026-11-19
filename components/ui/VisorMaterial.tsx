'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { TipoMaterial } from '@/lib/material'
import { urlDelVisor, visorDe, embedDeEnlace, enlaceWebValido, esImagenDirecta, esGoogleFotos } from '@/lib/material'
import { IconoDocumento, IconoCheck } from '@/components/ui/Iconos'

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
 * El pellizco con dos dedos hecho a mano (addEventListener de touch, con
 * `touch-action` ajustado) se probó dos rondas (8-nov-2026) y nunca terminó
 * de sentirse bien en el teléfono real. En vez de seguir afinando un gesto
 * reinventado, se optó por reactivar el zoom NATIVO del navegador -- el
 * mismo que `app/layout.tsx` apaga en TODA la app a propósito
 * (`userScalable: false`) -- pero solo en las pantallas que usan este
 * visor: cada una tiene su propio `layout.tsx` con un `viewport` que
 * reemplaza al de la raíz para esa rama (`app/(app)/unidades/[unitId]/
 * material/[itemId]/layout.tsx` y los dos equivalentes del profesor). El
 * pellizco de dos dedos ahora es el del propio navegador -- confiable,
 * sin código propio que mantener -- y los botones +/- se quedan igual,
 * como alternativa sin gestos (mouse, accesibilidad).
 */

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
  /** Archivo ya descargado en el teléfono (lib/offline-unidades.ts): se usa en vez de pedirlo a Storage. */
  archivoLocal?: Blob
}

interface PropsBase extends Props {
  /** Avance real (0-100) y si ya cumplió lo que se le exige a ese tipo de material. */
  onMedido?: (real: number, cumplido: boolean) => void
  /** Ya lo había completado antes: no hace falta volver a medir. */
  yaCompleto?: boolean
  /** PDF ya firmado (presentación convertida): se usa en vez de pedir la ruta a Storage. */
  urlFirmada?: string
}

const SEGUNDOS_IMAGEN = 30
const SEGUNDOS_CONFIRMAR = 30

/**
 * Para lo que no se puede medir desde la app (video de Google Drive, un enlace
 * a una página, una presentación que se abre en otra pestaña): se exige
 * quedarse al menos 30 s con la pantalla visible y confirmar a mano.
 */
function ConfirmacionManual({ onTick, onConfirmar }: { onTick: (seg: number) => void; onConfirmar: () => void }) {
  const [seg, setSeg] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return
      setSeg((v) => {
        const n = Math.min(SEGUNDOS_CONFIRMAR, v + 1)
        return n
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => { onTick(seg) }, [seg, onTick])
  const listo = seg >= SEGUNDOS_CONFIRMAR
  return (
    <div className="space-y-2 rounded-xl border border-zr-border bg-zr-surface/60 p-4 text-center">
      <p className="text-sm text-zr-text-muted">
        Esto no se puede medir solo. Cuando termines de verlo completo, confírmalo aquí.
      </p>
      <button
        type="button"
        disabled={!listo}
        onClick={onConfirmar}
        className="min-h-12 w-full rounded-lg bg-zr-blue px-6 text-sm font-bold text-white disabled:opacity-40"
      >
        {listo ? 'Ya lo vi completo' : `Disponible en ${SEGUNDOS_CONFIRMAR - seg} s`}
      </button>
    </div>
  )
}

/** Solo .docx (Open XML) -- mammoth no sabe leer el .doc binario viejo. */
function esDocx(storagePath: string): boolean {
  return storagePath.toLowerCase().endsWith('.docx')
}

/** Imagen que viene de un link (foto directa o Google Fotos), mostrada dentro de la app. */
function ImagenDeEnlace({ url, alCargar }: { url: string; alCargar: () => void }) {
  const [src, setSrc] = useState<string | null>(esImagenDirecta(url) ? url : null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (esImagenDirecta(url)) return
    let vigente = true
    fetch(`/api/enlace-imagen?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { src?: string }) => { if (vigente) { if (d.src) setSrc(d.src); else setFallo(true) } })
      .catch(() => { if (vigente) setFallo(true) })
    return () => { vigente = false }
  }, [url])

  if (fallo) {
    return (
      <div className="zr-card flex flex-col items-center gap-3 p-8 text-center">
        <IconoDocumento size={28} className="text-zr-text-muted" />
        <p className="text-sm text-zr-text-muted">No se pudo mostrar la foto dentro de la app (revisa que el álbum o la foto esté compartida con enlace).</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-zr-blue px-5 py-3 text-sm font-bold text-white">
          Abrir enlace
        </a>
      </div>
    )
  }
  if (!src) return <div className="zr-skel h-64 w-full rounded-xl" />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Imagen del material"
      referrerPolicy="no-referrer"
      onLoad={alCargar}
      onError={() => setFallo(true)}
      className="mx-auto max-h-[85dvh] w-full rounded-xl bg-zr-surface object-contain"
    />
  )
}

function VisorBase({ contentItemId, tipo, storagePath, externalUrl, bucket = 'contenido', registrarProgreso = true, onMedido, yaCompleto = false, urlFirmada, archivoLocal }: PropsBase) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [numPaginas, setNumPaginas] = useState(0)
  const [paginaMaxVista, setPaginaMaxVista] = useState(0)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const percentRef = useRef(0)
  const marcoEnlaceRef = useRef<HTMLDivElement>(null)
  // Videos por enlace: por defecto el marco ocupa casi toda la pantalla (un video
  // vertical del celular se extiende; uno horizontal queda centrado). Se puede
  // pasar a marco horizontal 16:9.
  const [marcoVertical, setMarcoVertical] = useState(true)
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
  const maxFraccionWord = useRef(0)
  const maxFraccionPdf = useRef(0)
  const wordRef = useRef<HTMLDivElement>(null)
  const pdfRef = useRef<HTMLDivElement>(null)
  const [imagenLista, setImagenLista] = useState(false)
  const [enlaceAbierto, setEnlaceAbierto] = useState(false)
  const iframeYtRef = useRef<HTMLIFrameElement>(null)
  const segundosYt = useRef<Set<number>>(new Set())
  const duracionYt = useRef(0)

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

  // Avance real + si ya cumplió. Hasta cumplir, lo que se guarda en la base
  // nunca llega al umbral de "completado" (90 %): entrar y salir no cambia nada.
  function medir(real: number, cumplido: boolean) {
    if (!registrarProgreso || yaCompleto) return
    const r = Math.max(0, Math.min(100, Math.round(real)))
    onMedido?.(cumplido ? 100 : r, cumplido)
    void guardarProgreso(cumplido ? 100 : Math.min(r, 89))
  }
  const medirRef = useRef(medir)
  medirRef.current = medir
  const medirEstable = useCallback((real: number, cumplido: boolean) => medirRef.current(real, cumplido), [])

  // Imagen: tiene que estar a la vista 30 segundos (solo cuenta con la
  // pantalla visible).
  useEffect(() => {
    if (!imagenLista || yaCompleto || !registrarProgreso) return
    let seg = 0
    const id = setInterval(() => {
      if (document.hidden) return
      seg += 1
      medirEstable((seg / SEGUNDOS_IMAGEN) * 100, seg >= SEGUNDOS_IMAGEN)
      if (seg >= SEGUNDOS_IMAGEN) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [imagenLista, yaCompleto, registrarProgreso, medirEstable])

  // YouTube: el reproductor avisa por postMessage dónde va; se cuentan los
  // segundos realmente reproducidos (adelantar no suma).
  useEffect(() => {
    if (tipo !== 'enlace' || !externalUrl || yaCompleto || !registrarProgreso) return
    const emb = embedDeEnlace(externalUrl)
    if (!emb || emb.proveedor !== 'youtube') return
    function alMensaje(ev: MessageEvent) {
      if (ev.source !== iframeYtRef.current?.contentWindow) return
      let d: unknown = ev.data
      if (typeof d === 'string') { try { d = JSON.parse(d) } catch { return } }
      const info = (d as { info?: { currentTime?: number; duration?: number; playerState?: number } })?.info
      if (!info) return
      if (info.duration && info.duration > 0) duracionYt.current = info.duration
      if (info.playerState === 1 && typeof info.currentTime === 'number') segundosYt.current.add(Math.floor(info.currentTime))
      if (info.playerState === 0 && duracionYt.current) segundosYt.current.add(Math.floor(duracionYt.current) - 1)
      if (duracionYt.current > 0) {
        const pct = (segundosYt.current.size / Math.ceil(duracionYt.current)) * 100
        medirEstable(pct, pct >= 95)
      }
    }
    window.addEventListener('message', alMensaje)
    return () => window.removeEventListener('message', alMensaje)
  }, [tipo, externalUrl, yaCompleto, registrarProgreso, medirEstable])

  // URL firmada: 1h para PDF (se pide por trozos mientras se lee, igual que
  // contenido/page.tsx), 10 min para lo demás.
  useEffect(() => {
    if (tipo === 'enlace') return
    if (urlFirmada) { setUrl(urlFirmada); return }
    if (archivoLocal) {
      const local = URL.createObjectURL(archivoLocal)
      setUrl(local)
      return () => URL.revokeObjectURL(local)
    }
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
  }, [storagePath, bucket, tipo, urlFirmada, archivoLocal])

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
        // Nitidez: se dibuja con el doble de la resolucion de la pantalla
        // (antes escala fija 1.3: borroso, sobre todo en tareas escaneadas o
        // a mano). El canvas se muestra al ancho de la columna (w-full).
        const base = pagina.getViewport({ scale: 1 })
        const anchoPantalla = Math.min(pdfRef.current?.clientWidth || window.innerWidth, 1200)
        const dpr = Math.min(window.devicePixelRatio || 1, 3)
        const escala = Math.min(4, Math.max(1.5, (anchoPantalla * dpr * 1.5) / base.width))
        const viewport = pagina.getViewport({ scale: escala })
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

  // Documento: solo cuenta como visto al llegar al FINAL (97 %).
  function medirDesplazamiento(el: HTMLDivElement, maxRef: { current: number }) {
    const fraccion = el.scrollHeight <= el.clientHeight + 4 ? 1 : (el.scrollTop + el.clientHeight) / el.scrollHeight
    if (fraccion > maxRef.current) maxRef.current = fraccion
    medir(maxRef.current * 100, maxRef.current >= 0.97)
  }

  function alDesplazarWord(e: React.UIEvent<HTMLDivElement>) {
    medirDesplazamiento(e.currentTarget, maxFraccionWord)
  }

  // Un documento corto que cabe entero en la pantalla ya se vio completo.
  useEffect(() => {
    if (!htmlWord) return
    const t = setTimeout(() => { if (wordRef.current) medirDesplazamiento(wordRef.current, maxFraccionWord) }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlWord])

  useEffect(() => {
    if (tipo !== 'pdf' || numPaginas === 0) return
    const t = setTimeout(() => { if (pdfRef.current) medirDesplazamiento(pdfRef.current, maxFraccionPdf) }, 2500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, numPaginas])

  // Qué tan abajo se ha desplazado el estudiante decide qué página
  // "alcanzó" -- el % de avance es paginaMaxVista / numPaginas.
  function alDesplazar(e: React.UIEvent<HTMLDivElement>) {
    if (tipo !== 'pdf' || numPaginas === 0) return
    const el = e.currentTarget
    const fraccion = (el.scrollTop + el.clientHeight) / el.scrollHeight
    const pagina = Math.min(numPaginas, Math.max(1, Math.ceil(fraccion * numPaginas)))
    if (pagina > paginaMaxVista) setPaginaMaxVista(pagina)
    medirDesplazamiento(el, maxFraccionPdf)
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
    const pct = Math.min(100, (totalVisto / duracion) * 100)
    medir(pct, pct >= 97)
  }

  // Video de YouTube (pedido explícito del coordinador, 8-nov-2026): no hay
  // archivo que firmar -- el embed va directo con el id extraído del link
  // que pegó el profesor, en youtube-nocookie.com (sin cookies de rastreo).
  // Único caso legítimo de iframe aquí: a diferencia del visor de Office que
  // sí dio problemas en Android, el embed de YouTube está hecho para esto.
  if (tipo === 'enlace') {
    const embed = externalUrl ? embedDeEnlace(externalUrl) : null
    if (!embed && externalUrl && (esImagenDirecta(externalUrl) || esGoogleFotos(externalUrl))) {
      return <ImagenDeEnlace url={externalUrl} alCargar={() => setImagenLista(true)} />
    }
    if (!embed) {
      // Reunión 14-nov-2026: cualquier otro link (Google Fotos, una página...)
      // se abre en su propia pestaña en vez de dar "no válido".
      const web = externalUrl ? enlaceWebValido(externalUrl) : null
      if (web) {
        return (
          <div className="space-y-3">
            <div className="zr-card flex flex-col items-center gap-3 p-8 text-center">
              <IconoDocumento size={28} className="text-zr-text-muted" />
              <p className="text-sm text-zr-text-muted">Este material es un enlace externo.</p>
              <a
                href={web}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setEnlaceAbierto(true)}
                className="rounded-full bg-zr-blue px-5 py-3 text-sm font-bold text-white"
              >
                Abrir enlace
              </a>
            </div>
            {enlaceAbierto && registrarProgreso && !yaCompleto && (
              <ConfirmacionManual
                onTick={(seg) => medirEstable((seg / SEGUNDOS_CONFIRMAR) * 90, false)}
                onConfirmar={() => medirEstable(100, true)}
              />
            )}
          </div>
        )
      }
      return (
        <div className="zr-card flex flex-col items-center gap-3 p-8 text-center">
          <IconoDocumento size={28} className="text-zr-text-muted" />
          <p className="text-sm text-zr-text-muted">El enlace no es válido.</p>
        </div>
      )
    }
    return (
      <div className="space-y-2">
      <div
        ref={marcoEnlaceRef}
        className={`w-full overflow-hidden rounded-xl bg-black ${marcoVertical ? 'h-[68dvh]' : 'aspect-video max-h-[80dvh]'}`}
      >
        <iframe
          ref={iframeYtRef}
          src={embed.proveedor === 'youtube' ? `${embed.src}${embed.src.includes('?') ? '&' : '?'}enablejsapi=1` : embed.src}
          title={embed.proveedor === 'drive' ? 'Video de Google Drive' : 'Video de YouTube'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
          onLoad={() => {
            if (embed.proveedor === 'youtube') {
              // Pide al reproductor que avise dónde va (currentTime, estado).
              iframeYtRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*')
            }
          }}
        />
      </div>
      {embed.proveedor === 'drive' && registrarProgreso && !yaCompleto && (
        <ConfirmacionManual
          onTick={(seg) => medirEstable((seg / SEGUNDOS_CONFIRMAR) * 90, false)}
          onConfirmar={() => medirEstable(100, true)}
        />
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          onClick={() => void marcoEnlaceRef.current?.requestFullscreen?.()}
          className="rounded-full border border-zr-border px-4 py-2 font-semibold text-zr-text"
        >
          Pantalla completa
        </button>
        <button
          onClick={() => setMarcoVertical((v) => !v)}
          className="rounded-full border border-zr-border px-4 py-2 font-semibold text-zr-text"
        >
          {marcoVertical ? 'Marco horizontal' : 'Marco vertical'}
        </button>
        {externalUrl && (
          <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-zr-blue">
            ¿No se ve? Abrir en otra pestaña
          </a>
        )}
      </div>
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
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        playsInline
        className="mx-auto max-h-[85dvh] w-full rounded-xl bg-black object-contain"
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
        controlsList="nodownload"
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
  // 17-nov-2026: sin zoom en toda la app (pedido del coordinador, que se
  // sienta como app). Los PDF se dibujan en alta resolucion para leerse bien.
  void ControlZoom
  void setZoom
  const controlZoomComun = null

  if (tipo === 'imagen') {
    return (
      <div className="relative max-h-[75vh] overflow-auto rounded-xl bg-zr-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
          className="rounded-xl"
          onLoad={() => setImagenLista(true)}
        />
        {controlZoomComun}
      </div>
    )
  }

  if (tipo === 'pdf') {
    return (
      <div ref={pdfRef} onScroll={alDesplazar} className="max-h-[75vh] overflow-auto rounded-xl bg-zr-surface p-2">
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
      <div ref={wordRef} onScroll={alDesplazarWord} className="zr-card max-h-[75vh] overflow-auto p-6">
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
    <div className="space-y-3">
      <div className="zr-card flex flex-col items-center gap-4 p-8 text-center">
        <IconoDocumento size={28} className="text-zr-text-muted" />
        <p className="text-sm text-zr-text-muted">
          Este tipo de archivo se abre en una pestaña aparte.
        </p>
        <button
          onClick={() => {
            window.open(urlDelVisor(visor, url), '_blank', 'noopener,noreferrer')
            setEnlaceAbierto(true)
          }}
          className="min-h-12 rounded-lg bg-zr-blue px-6 text-sm font-bold text-white"
        >
          Abrir material
        </button>
      </div>
      {enlaceAbierto && registrarProgreso && !yaCompleto && (
        <ConfirmacionManual
          onTick={(seg) => medirEstable((seg / SEGUNDOS_CONFIRMAR) * 90, false)}
          onConfirmar={() => medirEstable(100, true)}
        />
      )}
    </div>
  )
}

function textoDeExigencia(tipo: TipoMaterial, externalUrl?: string | null): string {
  if (tipo === 'video' || tipo === 'audio') return tipo === 'audio' ? 'Escúchalo completo, hasta el final.' : 'Míralo completo, hasta el final.'
  if (tipo === 'imagen') return `Quédate mirándola ${SEGUNDOS_IMAGEN} segundos.`
  if (tipo === 'pdf' || tipo === 'documento') return 'Llega hasta el final del documento.'
  if (tipo === 'enlace' && externalUrl && embedDeEnlace(externalUrl)) return 'Míralo completo, hasta el final.'
  return `Revísalo y confírmalo después de ${SEGUNDOS_CONFIRMAR} segundos.`
}

/**
 * Marca de agua (18-nov-2026): el logo de la academia, fijo sobre todo lo que se
 * ve dentro de la app (video, PDF, imagen, Word). No se puede quitar tocándola
 * (pointer-events-none), el menú de "guardar como" está apagado y el video no
 * ofrece descarga. No impide grabar la pantalla, pero deja la marca en la copia.
 */
function VisorMarcado(props: PropsBase) {
  // PowerPoint (18-nov-2026): se intenta convertir a PDF en el servidor para verlo
  // dentro de la app. Si no se puede (sin conversor o se acabó el cupo), se
  // muestra como siempre: botón para abrirlo en una pestaña aparte.
  const { contentItemId, tipo } = props
  const esPpt = tipo === 'presentacion' && !!contentItemId && !props.archivoLocal
  const [conv, setConv] = useState<{ url: string } | 'fallo' | null>(null)

  useEffect(() => {
    if (!esPpt) return
    let vigente = true
    fetch('/api/convertir-pptx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentItemId }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { url?: string }) => { if (vigente) setConv(d.url ? { url: d.url } : 'fallo') })
      .catch(() => { if (vigente) setConv('fallo') })
    return () => { vigente = false }
  }, [esPpt, contentItemId])

  const convertida = esPpt && conv && conv !== 'fallo'
  return (
    <div className="relative select-none" onContextMenu={(e) => e.preventDefault()}>
      {esPpt && conv === null ? (
        <div className="zr-card space-y-2 p-8 text-center">
          <div className="zr-skel mx-auto h-40 w-full rounded-xl" />
          <p className="text-sm text-zr-text-muted">Preparando la presentación…</p>
        </div>
      ) : convertida ? (
        <VisorBase {...props} tipo="pdf" urlFirmada={conv.url} />
      ) : (
        <VisorBase {...props} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-zr-mecademy.png"
        alt=""
        draggable={false}
        className="pointer-events-none absolute right-3 top-3 z-20 w-16 opacity-40 sm:w-24"
      />
    </div>
  )
}

/**
 * Envoltura con la barra de avance y el aviso de "material visto".
 * Pedido del coordinador (16-nov-2026): un material no se marca como visto
 * hasta que de verdad se vea completo -- documento hasta el final, video y
 * audio completos, imagen 30 s -- sea precargado o por enlace. Entrar y salir
 * no cambia nada. Al cumplirlo sale un aviso y la barra llega al 100 %.
 */
export function VisorMaterial(props: Props) {
  const router = useRouter()
  const { contentItemId, tipo, externalUrl, registrarProgreso = true } = props
  const [listo, setListo] = useState(!registrarProgreso)
  const [completo, setCompleto] = useState(false)
  const [pct, setPct] = useState(0)
  const [aviso, setAviso] = useState(false)
  const [previo, setPrevio] = useState(false)
  const completoRef = useRef(false)

  useEffect(() => {
    if (!registrarProgreso) return
    let vigente = true
    async function leer() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (vigente) setListo(true); return }
      const { data } = await supabase
        .from('material_progress')
        .select('percent, completed_at')
        .eq('student_id', user.id)
        .eq('content_item_id', contentItemId)
        .maybeSingle()
      if (!vigente) return
      if (data?.completed_at) { completoRef.current = true; setCompleto(true); setPrevio(true); setPct(100) }
      else setPct(Math.min(89, Number(data?.percent ?? 0)))
      setListo(true)
    }
    void leer()
    return () => { vigente = false }
  }, [contentItemId, registrarProgreso])

  const alMedir = useCallback((real: number, cumplido: boolean) => {
    setPct((p) => Math.max(p, real))
    if (cumplido && !completoRef.current) {
      completoRef.current = true
      setCompleto(true)
      setAviso(true)
    }
  }, [])

  if (!registrarProgreso) return <VisorMarcado {...props} />
  if (!listo) return <div className="zr-skel h-64 w-full rounded-xl" />

  return (
    <div className="space-y-3">
      <div className="sticky top-2 z-30 rounded-xl border border-zr-border bg-zr-surface/95 p-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-xs font-semibold text-zr-text">
            {completo ? 'Material visto ✓' : textoDeExigencia(tipo, externalUrl)}
          </p>
          <span className={`shrink-0 text-sm font-bold tabular-nums ${completo ? 'text-zr-success' : 'text-zr-blue'}`}>{Math.round(completo ? 100 : pct)}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zr-border/60">
          <div
            className={`h-full rounded-full transition-all duration-500 ${completo ? 'bg-zr-success' : 'bg-zr-blue'}`}
            style={{ width: `${completo ? 100 : pct}%` }}
          />
        </div>
        {!completo && (
          <p className="mt-1.5 text-[11px] text-zr-text-muted">Si sales antes de terminar, no cuenta como visto.</p>
        )}
      </div>

      <VisorMarcado {...props} onMedido={alMedir} yaCompleto={previo} />

      {aviso && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-5" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-zr-border bg-zr-surface p-6 text-center shadow-2xl">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zr-success/15 text-zr-success">
              <IconoCheck size={28} />
            </span>
            <div>
              <p className="text-lg font-bold text-zr-text">¡Material visto!</p>
              <p className="mt-1.5 text-sm text-zr-text-muted">
                Completaste este material. Tu avance en la unidad ya se actualizó.
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="min-h-12 w-full rounded-lg bg-zr-blue text-sm font-bold text-white"
              >
                Volver a la unidad
              </button>
              <button
                type="button"
                onClick={() => setAviso(false)}
                className="min-h-11 w-full rounded-lg text-sm font-semibold text-zr-text-muted"
              >
                Seguir viéndolo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
