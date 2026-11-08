/**
 * Aula Virtual — banner de unidad. Mismo lugar que ocupaba el banner con
 * foto de archivo del aula virtual de referencia (reunión 31-oct-2026),
 * pero con la identidad de ZR App: degradado azul de marca (el mismo que
 * ya usa `temario-docente`) en vez de una imagen de banco, el logo de la
 * app como marca de agua y la tipografía editorial de siempre
 * (`zr-display`). Nada de fotos externas que haya que mantener.
 *
 * Personalizable (migración 194/195, pedido #4 del coordinador, 7-nov-2026):
 * el profesor puede poner una imagen propia (con control de posición
 * vertical, porque una imagen cuadrada no entra entera en el rectángulo) o
 * elegir uno de 5 colores oscuros, desde "Editar unidad" -- lo ve igual
 * cualquier perfil que entre a la unidad. El mismo color, cuando hay
 * imagen, se usa como acento de botones y contornos en vez de fondo (ver
 * `colorAcento` en lib/banner-unidad.ts). Sin ninguno de los dos, se ve
 * exactamente como antes.
 */

// 5 tonos base x 3 tonalidades cada uno (claro/medio/oscuro) -- pedido
// explícito del coordinador (reunión 7-nov-2026): "que le pique en oro azul
// y cambie la tonalidad azul, un poquito más claro, un poquito más oscuro".
// 'azul'/'verde'/'morado'/'grafito'/'vino' (sin sufijo) son los 5 de siempre
// -- se mantienen como la tonalidad "medio" para no romper unidades ya
// guardadas con esos valores (migración 194/199).
export type ColorBanner =
  | 'azul_claro' | 'azul' | 'azul_oscuro'
  | 'verde_claro' | 'verde' | 'verde_oscuro'
  | 'morado_claro' | 'morado' | 'morado_oscuro'
  | 'grafito_claro' | 'grafito' | 'grafito_oscuro'
  | 'vino_claro' | 'vino' | 'vino_oscuro'

export const HUES_BANNER = ['azul', 'verde', 'morado', 'grafito', 'vino'] as const
export type HueBanner = typeof HUES_BANNER[number]

export const PALETA_BANNER: Record<ColorBanner, { etiqueta: string; clase: string; muestra: string }> = {
  azul_claro:    { etiqueta: 'Azul claro',    clase: 'from-sky-700 to-sky-500',          muestra: '#4d7fe0' },
  azul:          { etiqueta: 'Azul',          clase: 'from-zr-blue-deep to-zr-blue',     muestra: '#1d3f8f' },
  azul_oscuro:   { etiqueta: 'Azul oscuro',   clase: 'from-blue-950 to-blue-900',        muestra: '#0e2258' },
  verde_claro:   { etiqueta: 'Verde claro',   clase: 'from-emerald-700 to-emerald-500',  muestra: '#1f9d6f' },
  verde:         { etiqueta: 'Verde',         clase: 'from-emerald-950 to-emerald-800',  muestra: '#064e3b' },
  verde_oscuro:  { etiqueta: 'Verde oscuro',  clase: 'from-emerald-950 to-green-950',    muestra: '#022c1a' },
  morado_claro:  { etiqueta: 'Morado claro',  clase: 'from-violet-700 to-violet-500',    muestra: '#8752e0' },
  morado:        { etiqueta: 'Morado',        clase: 'from-violet-950 to-violet-800',    muestra: '#4c1d95' },
  morado_oscuro: { etiqueta: 'Morado oscuro', clase: 'from-violet-950 to-purple-950',     muestra: '#2c0f57' },
  grafito_claro: { etiqueta: 'Grafito claro', clase: 'from-neutral-700 to-neutral-500',  muestra: '#636363' },
  grafito:       { etiqueta: 'Grafito',       clase: 'from-neutral-900 to-neutral-700',  muestra: '#262626' },
  grafito_oscuro:{ etiqueta: 'Grafito oscuro',clase: 'from-neutral-950 to-black',        muestra: '#0a0a0a' },
  vino_claro:    { etiqueta: 'Vino claro',    clase: 'from-rose-700 to-rose-500',        muestra: '#c23b56' },
  vino:          { etiqueta: 'Vino tinto',    clase: 'from-rose-950 to-rose-800',        muestra: '#5b1024' },
  vino_oscuro:   { etiqueta: 'Vino oscuro',   clase: 'from-rose-950 to-red-950',         muestra: '#390712' },
}

export function BannerUnidad({
  sobretitulo,
  titulo,
  accion,
  imagenUrl,
  posicionImagen,
  color,
}: {
  sobretitulo: string
  titulo: string
  accion?: React.ReactNode
  /** URL pública de la imagen de banco (bucket banners-unidad). */
  imagenUrl?: string | null
  /** Foco vertical del recorte, 0 (arriba) a 100 (abajo). Default 50 (centro). */
  posicionImagen?: number | null
  /** Uno de los 5 tonos oscuros de PALETA_BANNER. Fondo sin imagen; acento de botones con imagen. */
  color?: ColorBanner | null
}) {
  const degradado = PALETA_BANNER[color ?? 'azul']?.clase ?? PALETA_BANNER.azul.clase

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 text-white ${
        imagenUrl ? '' : `bg-gradient-to-br ${degradado}`
      }`}
      style={
        imagenUrl
          ? {
              backgroundImage: `url(${imagenUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: `center ${posicionImagen ?? 50}%`,
            }
          : undefined
      }
    >
      {/* Con imagen propia, un velo oscuro para que el texto siga legible
          encima de cualquier foto. */}
      {imagenUrl && <div aria-hidden className="absolute inset-0 bg-black/55" />}

      {!imagenUrl && (
        <svg
          aria-hidden
          viewBox="0 0 200 200"
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 text-white/10"
          fill="currentColor"
        >
          <circle cx="100" cy="100" r="100" />
        </svg>
      )}
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">{sobretitulo}</p>
          <h1 className="zr-display mt-2 break-words text-2xl sm:text-3xl">{titulo}</h1>
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>
    </div>
  )
}
