import { PDFDocument, PDFName, PDFRawStream, PDFArray, PDFBool } from 'pdf-lib'

/**
 * Compresión de PDF en el navegador (pedido del coordinador, oct. 2026: el
 * PDF es de lo que más se sube y casi siempre pesa por las imágenes).
 *
 * Dos pasos, del menos al más agresivo -- se queda con el primero que baje el
 * archivo por debajo del límite:
 *
 *   1. "imágenes": se reducen las fotos JPEG que lleva dentro el PDF (máx.
 *      1600 px de lado, calidad 70 %). El texto sigue siendo texto: se puede
 *      seleccionar y buscar, y las páginas se ven igual.
 *   2. "páginas": si con eso no alcanza (p. ej. un PDF exportado de
 *      PowerPoint con gráficos en formatos que no se pueden tocar uno a uno),
 *      cada página se convierte en una imagen de buena resolución. Pesa mucho
 *      menos y se ve igual en el teléfono, pero el texto deja de poder
 *      seleccionarse y buscarse. Se avisa a quien sube el archivo.
 *
 * Todo ocurre en el navegador de quien sube: el archivo no pasa por terceros.
 */

export type MetodoPdf = 'imagenes' | 'paginas'

export interface ResultadoPdf {
  bytes: Uint8Array
  metodo: MetodoPdf
}

const MAX_LADO_IMAGEN = 1600
const CALIDAD_IMAGEN = 0.7
const MIN_BYTES_IMAGEN = 150 * 1024
const ANCHO_PAGINA_PX = 1400
const CALIDAD_PAGINA = 0.72

async function canvasABytes(canvas: HTMLCanvasElement, calidad: number): Promise<Uint8Array | null> {
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', calidad))
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}

function nombreFiltro(dict: { get: (n: PDFName) => unknown }): string | null {
  const f = dict.get(PDFName.of('Filter'))
  if (!f) return null
  if (f instanceof PDFArray) {
    return f.size() === 1 ? String(f.get(0)) : null
  }
  return String(f)
}

/** Paso 1: recomprime las imágenes JPEG internas. */
async function reducirImagenesInternas(datos: ArrayBuffer): Promise<Uint8Array | null> {
  const pdf = await PDFDocument.load(datos, { updateMetadata: false, throwOnInvalidObject: false })
  let cambios = 0

  for (const [ref, obj] of pdf.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue
    const dict = obj.dict
    if (String(dict.get(PDFName.of('Subtype'))) !== '/Image') continue
    if (nombreFiltro(dict) !== '/DCTDecode') continue
    if (dict.get(PDFName.of('Mask')) || dict.get(PDFName.of('ImageMask')) instanceof PDFBool) continue
    const original = obj.contents
    if (original.length < MIN_BYTES_IMAGEN) continue

    let bmp: ImageBitmap
    try {
      bmp = await createImageBitmap(new Blob([original as BlobPart], { type: 'image/jpeg' }))
    } catch {
      continue
    }
    const escala = Math.min(1, MAX_LADO_IMAGEN / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * escala))
    const h = Math.max(1, Math.round(bmp.height * escala))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bmp.close(); continue }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    const nuevos = await canvasABytes(canvas, CALIDAD_IMAGEN)
    canvas.width = 0
    if (!nuevos || nuevos.length >= original.length * 0.85) continue

    const nuevoDict = pdf.context.obj({
      Type: 'XObject',
      Subtype: 'Image',
      Width: w,
      Height: h,
      ColorSpace: 'DeviceRGB',
      BitsPerComponent: 8,
      Filter: 'DCTDecode',
    })
    const mascara = dict.get(PDFName.of('SMask'))
    if (mascara) nuevoDict.set(PDFName.of('SMask'), mascara)
    pdf.context.assign(ref, PDFRawStream.of(nuevoDict, nuevos))
    cambios++
  }

  if (cambios === 0) return null
  return pdf.save({ useObjectStreams: true })
}

/**
 * Paso 2: cada página pasa a ser una imagen.
 *
 * pdf.js dibuja con requestAnimationFrame, que el navegador PAUSA si la
 * pestaña queda en segundo plano (alguien cambia de app mientras sube un
 * archivo): la compresión se quedaría colgada. Mientras dura, se reemplaza por
 * un temporizador que sigue corriendo y luego se restaura.
 */
async function paginasComoImagenes(datos: ArrayBuffer): Promise<Uint8Array | null> {
  const rafOriginal = window.requestAnimationFrame
  const cafOriginal = window.cancelAnimationFrame
  window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 0)
  window.cancelAnimationFrame = (id: number) => window.clearTimeout(id)
  try {
    return await paginasComoImagenesInterno(datos)
  } finally {
    window.requestAnimationFrame = rafOriginal
    window.cancelAnimationFrame = cafOriginal
  }
}

async function paginasComoImagenesInterno(datos: ArrayBuffer): Promise<Uint8Array | null> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const tarea = pdfjs.getDocument({ data: new Uint8Array(datos.slice(0)) })
  const doc = await tarea.promise
  const salida = await PDFDocument.create()

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const pagina = await doc.getPage(i)
      const base = pagina.getViewport({ scale: 1 })
      const escala = Math.min(2.5, ANCHO_PAGINA_PX / base.width)
      const vista = pagina.getViewport({ scale: escala })

      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(vista.width)
      canvas.height = Math.ceil(vista.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await pagina.render({ canvasContext: ctx, viewport: vista, canvas }).promise

      const jpg = await canvasABytes(canvas, CALIDAD_PAGINA)
      canvas.width = 0
      pagina.cleanup()
      if (!jpg) return null

      const imagen = await salida.embedJpg(jpg)
      const nueva = salida.addPage([base.width, base.height])
      nueva.drawImage(imagen, { x: 0, y: 0, width: base.width, height: base.height })
    }
  } finally {
    await tarea.destroy()
  }
  return salida.save({ useObjectStreams: true })
}

/**
 * Intenta bajar el peso de un PDF por debajo de `limiteBytes`. Devuelve null
 * si ningún paso lo mejora de verdad (el archivo se sube tal cual).
 */
export async function comprimirPdf(archivo: File, limiteBytes: number): Promise<ResultadoPdf | null> {
  const datos = await archivo.arrayBuffer()
  let mejor: ResultadoPdf | null = null

  try {
    const paso1 = await reducirImagenesInternas(datos)
    if (paso1 && paso1.length < archivo.size * 0.9) {
      mejor = { bytes: paso1, metodo: 'imagenes' }
      if (paso1.length <= limiteBytes) return mejor
    }
  } catch {
    // PDF raro o protegido: se pasa al siguiente paso.
  }

  try {
    const paso2 = await paginasComoImagenes(datos)
    const referencia = mejor ? mejor.bytes.length : archivo.size
    if (paso2 && paso2.length < referencia * 0.85) {
      mejor = { bytes: paso2, metodo: 'paginas' }
    }
  } catch {
    // Sin worker / PDF dañado: se queda con lo que haya.
  }

  return mejor
}
