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

export type ColorBanner = 'azul' | 'verde' | 'morado' | 'grafito' | 'vino'

export const PALETA_BANNER: Record<ColorBanner, { etiqueta: string; clase: string; muestra: string }> = {
  azul:    { etiqueta: 'Azul (por defecto)', clase: 'from-zr-blue-deep to-zr-blue',               muestra: '#1d3f8f' },
  verde:   { etiqueta: 'Verde oscuro',       clase: 'from-emerald-950 to-emerald-800',             muestra: '#064e3b' },
  morado:  { etiqueta: 'Morado oscuro',      clase: 'from-violet-950 to-violet-800',                muestra: '#4c1d95' },
  grafito: { etiqueta: 'Grafito',            clase: 'from-neutral-900 to-neutral-700',              muestra: '#262626' },
  vino:    { etiqueta: 'Vino tinto',         clase: 'from-rose-950 to-rose-800',                    muestra: '#5b1024' },
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
