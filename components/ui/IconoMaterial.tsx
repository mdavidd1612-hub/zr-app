import { IconoDocumento, IconoImagen, IconoVideo, IconoAudio } from '@/components/ui/Iconos'

/**
 * Icono del material según su tipo real (pedido explícito del coordinador,
 * reunión 7-nov-2026: "si es una imagen se ponga icono de imagen, si es un
 * vídeo un icono de vídeo"). Antes el recorrido usaba IconoDocumento para
 * TODO ítem de tipo "material", sin importar si era PDF, imagen, video o
 * audio.
 */
export function iconoDeMaterial(tipo: string | null | undefined) {
  if (tipo === 'imagen') return IconoImagen
  if (tipo === 'video') return IconoVideo
  if (tipo === 'audio') return IconoAudio
  return IconoDocumento
}
