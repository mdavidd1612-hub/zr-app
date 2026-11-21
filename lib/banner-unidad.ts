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
  azul_claro: '#5b8aff',
  azul: '#2f6bff',
  azul_oscuro: '#1a3f8f',
  verde_claro: '#34d399',
  verde: '#10b981',
  verde_oscuro: '#047857',
  morado_claro: '#c084fc',
  morado: '#a855f7',
  morado_oscuro: '#7e22ce',
  grafito_claro: '#d1d5db',
  grafito: '#9ca3af',
  grafito_oscuro: '#4b5563',
  vino_claro: '#fb7185',
  vino: '#f43f5e',
  vino_oscuro: '#be123c',
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
