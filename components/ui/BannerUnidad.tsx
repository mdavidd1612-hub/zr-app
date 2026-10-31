/**
 * Aula Virtual — banner de unidad. Mismo lugar que ocupaba el banner con
 * foto de archivo del aula virtual de referencia (reunión 31-oct-2026),
 * pero con la identidad de ZR App: degradado azul de marca (el mismo que
 * ya usa `temario-docente`) en vez de una imagen de banco, el logo de la
 * app como marca de agua y la tipografía editorial de siempre
 * (`zr-display`). Nada de fotos externas que haya que mantener.
 */
export function BannerUnidad({
  sobretitulo,
  titulo,
  accion,
}: {
  sobretitulo: string
  titulo: string
  accion?: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zr-blue-deep to-zr-blue p-6 text-white">
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 text-white/10"
        fill="currentColor"
      >
        <circle cx="100" cy="100" r="100" />
      </svg>
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
