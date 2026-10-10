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
 *   - PDF, video y audio: no se pueden comprimir bien en el navegador sin
 *     dañarlos; se suben tal cual y se avisa para que se suban ya comprimidos.
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

/** Reduce una imagen a `maxLado` y la devuelve como JPG o PNG según `tipoSalida`. */
async function reducirImagen(
  datos: Blob,
  maxLado: number,
  tipoSalida: 'image/jpeg' | 'image/png',
): Promise<Blob | null> {
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(datos)
  } catch {
    return null
  }
  const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * escala))
  const h = Math.max(1, Math.round(bmp.height * escala))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (tipoSalida === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return aBlob(canvas, tipoSalida, tipoSalida === 'image/jpeg' ? CALIDAD_JPG : undefined)
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

  try {
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) nuevo = await comprimirImagen(archivo)
    else if (['pptx', 'docx', 'xlsx'].includes(ext)) nuevo = await comprimirOffice(archivo)
  } catch {
    nuevo = null
  }

  if (nuevo) {
    return {
      archivo: nuevo,
      comprimido: true,
      bytesAntes: archivo.size,
      bytesDespues: nuevo.size,
      mensaje: `Se comprimió automáticamente de ${mb(archivo.size)} a ${mb(nuevo.size)}.`,
    }
  }

  const sePuede = ['jpg', 'jpeg', 'png', 'webp', 'pptx', 'docx', 'xlsx'].includes(ext)
  return intacto(
    sePuede
      ? `El archivo pesa ${mb(archivo.size)} y no se pudo reducir más automáticamente.`
      : `El archivo pesa ${mb(archivo.size)}. ${ext.toUpperCase() || 'Este formato'} no se puede comprimir automáticamente: conviene subirlo ya comprimido para que abra rápido en teléfonos de gama baja.`,
  )
}
