import type { ColorBanner } from '@/components/ui/BannerUnidad'

/**
 * Color de acento para botones y contornos dentro de una unidad (pedido
 * explícito del coordinador, 7-nov-2026): "si no le pone una imagen, que
 * cambien los botones y todo eso al color que le puso. Y si le pone una
 * imagen, que pueda seleccionar el color de los botones y los contornos"
 * -- un mismo selector (el de PALETA_BANNER), dos usos: fondo del banner
 * cuando no hay imagen, acento de la interfaz siempre.
 */
export const ACENTO_HEX: Record<ColorBanner, string> = {
  azul: '#2f6bff',
  verde: '#10b981',
  morado: '#a855f7',
  grafito: '#9ca3af',
  vino: '#f43f5e',
}

export function acentoDe(color: ColorBanner | null | undefined): string {
  return ACENTO_HEX[color ?? 'azul']
}

/** `#rrggbb` -> `rgba(r,g,b,alpha)`, para fondos translúcidos de acento. */
export function hexARgba(hex: string, alpha: number): string {
  const limpio = hex.replace('#', '')
  const r = parseInt(limpio.slice(0, 2), 16)
  const g = parseInt(limpio.slice(2, 4), 16)
  const b = parseInt(limpio.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
