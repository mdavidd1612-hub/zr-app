import { createClient } from '@/lib/supabase/client'

/**
 * Reglas compartidas del material de estudio (admin, profesor, estudiante).
 *
 * Formatos pedidos por Dirección Académica (oct. 2026): PDF, PPTX, documentos,
 * videos, imágenes y audios. El tipo se deduce primero del MIME que reporta el
 * navegador y, si viene vacío (Android suele dejarlo vacío con .docx/.m4a), de
 * la extensión.
 */

export type TipoMaterial = 'pdf' | 'presentacion' | 'documento' | 'imagen' | 'video' | 'audio'

const POR_EXTENSION: Record<string, TipoMaterial> = {
  pdf: 'pdf',
  ppt: 'presentacion', pptx: 'presentacion',
  doc: 'documento', docx: 'documento', xls: 'documento', xlsx: 'documento', txt: 'documento',
  jpg: 'imagen', jpeg: 'imagen', png: 'imagen', webp: 'imagen', gif: 'imagen',
  mp4: 'video', webm: 'video', mov: 'video',
  mp3: 'audio', m4a: 'audio', wav: 'audio', ogg: 'audio', aac: 'audio',
}

const POR_MIME_EXACTO: Record<string, TipoMaterial> = {
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'presentacion',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentacion',
  'application/msword': 'documento',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documento',
  'application/vnd.ms-excel': 'documento',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'documento',
  'text/plain': 'documento',
}

export const ACCEPT_MATERIAL =
  '.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.mp3,.m4a,.wav,.ogg,.aac'

export const MENSAJE_FORMATOS =
  'Formatos aceptados: PDF, PowerPoint, Word, Excel, imágenes, videos (MP4/WebM) y audios (MP3/M4A/WAV).'

export function extensionDe(nombre: string): string {
  const i = nombre.lastIndexOf('.')
  return i >= 0 ? nombre.slice(i + 1).toLowerCase() : ''
}

export function tipoDeArchivo(archivo: File): TipoMaterial | null {
  if (POR_MIME_EXACTO[archivo.type]) return POR_MIME_EXACTO[archivo.type]
  if (archivo.type.startsWith('image/')) return POR_EXTENSION[extensionDe(archivo.name)] === 'imagen' ? 'imagen' : null
  if (archivo.type.startsWith('video/')) return POR_EXTENSION[extensionDe(archivo.name)] === 'video' ? 'video' : null
  if (archivo.type.startsWith('audio/')) return POR_EXTENSION[extensionDe(archivo.name)] === 'audio' ? 'audio' : null
  return POR_EXTENSION[extensionDe(archivo.name)] ?? null
}

export const ETIQUETA_TIPO: Record<string, string> = {
  pdf: 'PDF', presentacion: 'PPT', documento: 'DOC', imagen: 'IMG', video: 'VIDEO', audio: 'AUDIO',
}

/** Ruta en Storage: el nombre se limpia SOLO para la ruta; el original va en la fila. */
export function rutaDeStorage(moduloId: string, nombreOriginal: string): string {
  const limpio = nombreOriginal.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  return `${moduloId}/${crypto.randomUUID()}-${limpio}`
}

/**
 * Nombre con el que se guarda el archivo al descargar: el TÍTULO que le puso
 * quien lo montó, más la extensión real (pedido del coordinador, oct. 2026,
 * que reemplaza al de "conservar el nombre original del archivo"). Solo se
 * quitan los caracteres que ningún sistema de archivos admite; tildes,
 * espacios y eñes se conservan. `originalName` se sigue guardando en la base
 * pero ya no decide el nombre de descarga.
 */
export function nombreDescarga(m: { originalName?: string | null; titulo: string; rutaStorage: string }): string {
  const ext = extensionDe(m.rutaStorage)
  const titulo = m.titulo.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim() || 'archivo'
  const yaTieneExt = ext && titulo.toLowerCase().endsWith('.' + ext)
  return ext && !yaTieneExt ? `${titulo}.${ext}` : titulo
}

/** Etiqueta visible del tipo de documento: la extensión real (PDF, PPTX, DOCX, MP4…). */
export function etiquetaDeArchivo(tipo: string, nombreORuta: string | null | undefined): string {
  const ext = nombreORuta ? extensionDe(nombreORuta) : ''
  if (ext && ext.length <= 5) return ext.toUpperCase()
  return ETIQUETA_TIPO[tipo] ?? tipo.toUpperCase()
}

export type Visor = 'pdfjs' | 'office' | 'nativo'

export function visorDe(tipo: string, rutaStorage: string): Visor {
  if (tipo === 'pdf') return 'pdfjs'
  if (tipo === 'presentacion') return 'office'
  if (tipo === 'documento' && ['doc', 'docx', 'xls', 'xlsx'].includes(extensionDe(rutaStorage))) return 'office'
  return 'nativo'
}

export function urlDelVisor(visor: Visor, urlFirmada: string): string {
  if (visor === 'office') return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(urlFirmada)}`
  if (visor === 'pdfjs') return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(urlFirmada)}`
  return urlFirmada
}

/** Bitácora de uso para las métricas. Nunca debe romper la pantalla. */
export async function registrarEvento(e: {
  contentId: string
  event: 'ver' | 'descargar'
  outcome: 'abierto' | 'error_url' | 'visor_fallo'
  viewer?: Visor | 'descarga'
  fileType?: string
  sizeBytes?: number | null
}): Promise<void> {
  try {
    await createClient().from('content_access_events').insert({
      content_id: e.contentId,
      event: e.event,
      outcome: e.outcome,
      viewer: e.viewer ?? null,
      file_type: e.fileType ?? null,
      size_bytes: e.sizeBytes ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
    })
  } catch {
    // las métricas jamás bloquean al estudiante
  }
}
