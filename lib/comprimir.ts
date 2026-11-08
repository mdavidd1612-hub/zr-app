import JSZip from 'jszip'

/**
 * Compresión automática de material pesado (pedido del coordinador, oct.
 * 2026): si un archivo pasa del límite configurado en system_config
 * (`content.aviso_pesado_mb`), se intenta bajarle el peso ANTES de subirlo,
 * en el navegador de quien lo monta -- nada se envía a terceros.
 *
 * Qué se comprime de verdad:
 *   - Imágenes (JPG/PNG/WebP): se reducen a un máximo de 2200 px de lado y se
 *     guardan como JPG.
 *   - PowerPoint, Word y Excel (.pptx/.docx/.xlsx): son un ZIP; se reducen las
 *     imágenes que llevan dentro (casi siempre es lo que más pesa) sin tocar
 *     el texto, los diseños ni las animaciones.
 *   - PDF (lib/comprimir-pdf.ts): primero se reducen las fotos internas (el
 *     texto sigue siendo texto); si no alcanza, cada página pasa a ser una
 *     imagen de buena resolución (pesa mucho menos, pero el texto ya no se
 *     puede seleccionar ni buscar -- se avisa).
 *   - Video y audio: no se pueden comprimir bien en el navegador sin dañarlos;
 *     se suben tal cual y se avisa para que se suban ya comprimidos.
 *
 * Solo se usa el archivo comprimido si de verdad pesa menos que el original.
 */

export interface ResultadoCompresion {
  archivo: File
  comprimido: boolean
  bytesAntes: number
  bytesDespues: number
  /** Mensaje listo para mostrar a quien sube el archivo. */
  mensaje: string | null
}

const MAX_LADO_IMAGEN = 2200
const MAX_LADO_EN_DOCUMENTO = 1600
const CALIDAD_JPG = 0.8

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`

function extension(nombre: string): string {
  const i = nombre.lastIndexOf('.')
  return i >= 0 ? nombre.slice(i + 1).toLowerCase() : ''
}

async function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad))
}

/**
 * Dibuja `fuente` (ya decodida) en un canvas de `w`x`h` y lo devuelve, o
 * `null` si el resultado salió sospechosamente negro (ver `reducirImagen`).
 */
function dibujarEnCanvas(
  fuente: CanvasImageSource,
  w: number,
  h: number,
  tipoSalida: 'image/jpeg' | 'image/png',
): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (tipoSalida === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(fuente, 0, 0, w, h)
  return esSospechosamenteNegro(ctx, w, h) ? null : ctx
}

/**
 * Quita el perfil ICC de color (segmento APP2 "ICC_PROFILE") de un JPEG, sin
 * tocar el resto del archivo -- confirmado con una foto real (8-nov-2026):
 * el perfil de la cámara es "Display P3 con transferencia sRGB" (lo que
 * graban por defecto los Android recientes), y es justo el tipo de perfil
 * de gama ancha que hace que algunos navegadores dibujen la imagen negra en
 * canvas sin avisar ningún error. Sin el perfil, el navegador interpreta
 * los valores de color directo como sRGB (la mayoría del tiempo es casi
 * igual de cerca, nunca rota) -- se prefiere eso a una foto negra.
 */
function quitarPerfilICC_JPEG(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return buffer // no es JPEG
  const segmentos: Uint8Array[] = [bytes.subarray(0, 2)]
  let i = 2
  let huboICC = false
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) { segmentos.push(bytes.subarray(i)); i = bytes.length; break }
    const marker = bytes[i + 1]
    if (marker === 0xd9) { segmentos.push(bytes.subarray(i, i + 2)); i += 2; continue } // EOI
    if (marker === 0xda) { segmentos.push(bytes.subarray(i)); i = bytes.length; break } // SOS: resto son datos de imagen
    if (marker >= 0xd0 && marker <= 0xd7) { segmentos.push(bytes.subarray(i, i + 2)); i += 2; continue } // RST, sin longitud
    if (i + 3 >= bytes.length) break
    const len = (bytes[i + 2] << 8) | bytes[i + 3]
    const fin = i + 2 + len
    const esICC = marker === 0xe2 && len > 14 &&
      bytes[i + 4] === 0x49 && bytes[i + 5] === 0x43 && bytes[i + 6] === 0x43 && bytes[i + 7] === 0x5f // "ICC_"
    if (esICC) huboICC = true
    else segmentos.push(bytes.subarray(i, fin))
    i = fin
  }
  if (!huboICC) return buffer
  const total = segmentos.reduce((s, a) => s + a.length, 0)
  const salida = new Uint8Array(total)
  let pos = 0
  for (const seg of segmentos) { salida.set(seg, pos); pos += seg.length }
  return salida.buffer
}

/**
 * Decodifica vía <img>, no createImageBitmap -- `<img>` es otra ruta de
 * código del navegador y en la práctica es más compatible con perfiles de
 * color poco comunes que `createImageBitmap`.
 */
function decodificarConImg(datos: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(datos)
    const img = new Image()
    img.onload = () => { resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

/** Reduce una imagen a `maxLado` y la devuelve como JPG o PNG según `tipoSalida`. */
async function reducirImagen(
  datos: Blob,
  maxLado: number,
  tipoSalida: 'image/jpeg' | 'image/png',
): Promise<Blob | null> {
  let ctx: CanvasRenderingContext2D | null = null

  // Si es un JPEG con perfil ICC de gama ancha (la causa confirmada con una
  // foto real, 8-nov-2026), se quita antes de intentar nada -- ataca la
  // causa en vez de solo probar rutas de decodificación distintas.
  let fuente = datos
  if (datos.type === 'image/jpeg' || datos.type === 'image/jpg') {
    const original = await datos.arrayBuffer()
    const limpio = quitarPerfilICC_JPEG(original)
    if (limpio !== original) fuente = new Blob([limpio], { type: 'image/jpeg' })
  }

  // Intento 1: <img> -- primero porque es el que de verdad arregló el caso
  // confirmado con una foto real (perfil de color "Display P3").
  const img = await decodificarConImg(fuente)
  if (img && img.naturalWidth > 0) {
    const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * escala))
    const h = Math.max(1, Math.round(img.naturalHeight * escala))
    ctx = dibujarEnCanvas(img, w, h, tipoSalida)
    URL.revokeObjectURL(img.src)
  }

  // Intento 2 y 3: createImageBitmap, con y sin colorSpaceConversion -- se
  // dejan como respaldo por si <img> fallara por algún otro motivo distinto
  // al de color (archivo roto, formato no soportado, etc.).
  if (!ctx) {
    for (const opciones of [undefined, { colorSpaceConversion: 'none' as const }]) {
      let bmp: ImageBitmap
      try {
        bmp = opciones ? await createImageBitmap(fuente, opciones) : await createImageBitmap(fuente)
      } catch {
        continue
      }
      const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height))
      const w = Math.max(1, Math.round(bmp.width * escala))
      const h = Math.max(1, Math.round(bmp.height * escala))
      ctx = dibujarEnCanvas(bmp, w, h, tipoSalida)
      bmp.close()
      if (ctx) break
    }
  }

  // Los tres intentos salieron negros (o no se pudo decodificar): se sube el
  // archivo original sin comprimir en vez de una imagen rota.
  if (!ctx) return null

  return aBlob(ctx.canvas, tipoSalida, tipoSalida === 'image/jpeg' ? CALIDAD_JPG : undefined)
}

function esSospechosamenteNegro(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  // Cuadrícula de puntos (no solo centro + esquinas, para no fallar al
  // detectar una franja negra que no toque esos 5 puntos) -- se compara el
  // brillo PROMEDIO contra un umbral bajo, no "cada punto es RGB 0,0,0"
  // literal: el bug reportado se veía negro a simple vista, no
  // necesariamente negro puro pixel por pixel.
  const pasos = 4
  let suma = 0
  let cuenta = 0
  try {
    for (let i = 1; i < pasos; i++) {
      for (let j = 1; j < pasos; j++) {
        const x = Math.min(w - 1, Math.floor((w * i) / pasos))
        const y = Math.min(h - 1, Math.floor((h * j) / pasos))
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
        suma += (r + g + b) / 3
        cuenta++
      }
    }
  } catch {
    // Canvas "contaminado" u otro fallo al leer -- no se puede verificar,
    // se asume que está bien para no bloquear la subida por esto.
    return false
  }
  return cuenta > 0 && suma / cuenta < 8
}

async function comprimirImagen(archivo: File): Promise<File | null> {
  const nuevo = await reducirImagen(archivo, MAX_LADO_IMAGEN, 'image/jpeg')
  if (!nuevo || nuevo.size >= archivo.size) return null
  const base = archivo.name.replace(/\.[^.]+$/, '')
  return new File([nuevo], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

async function comprimirOffice(archivo: File): Promise<File | null> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await archivo.arrayBuffer())
  } catch {
    return null
  }

  let cambios = 0
  const entradas = Object.values(zip.files).filter(
    (e) => !e.dir && /\/media\/[^/]+\.(png|jpe?g)$/i.test(e.name),
  )

  for (const e of entradas) {
    const ext = extension(e.name)
    const esPng = ext === 'png'
    const original = await e.async('blob')
    // Las imágenes ya chicas no valen la pena.
    if (original.size < 200 * 1024) continue
    // Se conserva el formato de cada imagen: así no hay que reescribir las
    // referencias internas del documento.
    const reducida = await reducirImagen(
      original.slice(0, original.size, esPng ? 'image/png' : 'image/jpeg'),
      MAX_LADO_EN_DOCUMENTO,
      esPng ? 'image/png' : 'image/jpeg',
    )
    if (reducida && reducida.size < original.size * 0.9) {
      zip.file(e.name, reducida)
      cambios++
    }
  }
  if (cambios === 0) return null

  const salida = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } })
  if (salida.size >= archivo.size * 0.95) return null
  return new File([salida], archivo.name, { type: archivo.type, lastModified: Date.now() })
}

export async function comprimirSiPesa(archivo: File, limiteBytes: number): Promise<ResultadoCompresion> {
  const intacto = (mensaje: string | null): ResultadoCompresion => ({
    archivo, comprimido: false, bytesAntes: archivo.size, bytesDespues: archivo.size, mensaje,
  })

  if (!limiteBytes || archivo.size <= limiteBytes) return intacto(null)

  const ext = extension(archivo.name)
  let nuevo: File | null = null
  let metodoPdf: 'imagenes' | 'paginas' | null = null

  try {
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) nuevo = await comprimirImagen(archivo)
    else if (['pptx', 'docx', 'xlsx'].includes(ext)) nuevo = await comprimirOffice(archivo)
    else if (ext === 'pdf') {
      const { comprimirPdf } = await import('./comprimir-pdf')
      const r = await comprimirPdf(archivo, limiteBytes)
      if (r) {
        nuevo = new File([r.bytes as BlobPart], archivo.name, { type: 'application/pdf', lastModified: Date.now() })
        metodoPdf = r.metodo
      }
    }
  } catch {
    nuevo = null
  }

  if (nuevo) {
    return {
      archivo: nuevo,
      comprimido: true,
      bytesAntes: archivo.size,
      bytesDespues: nuevo.size,
      mensaje:
        `Se comprimió automáticamente de ${mb(archivo.size)} a ${mb(nuevo.size)}.` +
        (metodoPdf === 'paginas'
          ? ' Para lograrlo, las páginas del PDF se convirtieron en imágenes: se ven igual, pero el texto ya no se puede seleccionar ni buscar.'
          : ''),
    }
  }

  const sePuede = ['jpg', 'jpeg', 'png', 'webp', 'pptx', 'docx', 'xlsx', 'pdf'].includes(ext)
  return intacto(
    sePuede
      ? `El archivo pesa ${mb(archivo.size)} y no se pudo reducir más automáticamente.`
      : `El archivo pesa ${mb(archivo.size)}. ${ext.toUpperCase() || 'Este formato'} no se puede comprimir automáticamente: conviene subirlo ya comprimido para que abra rápido en teléfonos de gama baja.`,
  )
}
