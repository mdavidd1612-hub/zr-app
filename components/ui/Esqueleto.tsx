'use client'

/**
 * Esqueleto de carga (pedido de Dirección Académica, oct. 2026): en vez de un
 * "Cargando…" suelto, se ve la forma de la pantalla -- título y tarjetas
 * grises que laten -- y el contenido real aparece en su lugar.
 */

export function Bloque({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-zr-surface ${className}`} />
}

export function PantallaEsqueleto({ tarjetas = 3 }: { tarjetas?: number }) {
  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14" role="status" aria-label="Cargando">
      <div className="space-y-8">
        <Bloque className="h-9 w-24" />
        <div className="space-y-3">
          <Bloque className="h-3 w-24" />
          <Bloque className="h-9 w-3/4" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: tarjetas }).map((_, i) => (
            <div key={i} className="zr-card space-y-3 p-5">
              <Bloque className="h-4 w-1/2" />
              <Bloque className="h-3 w-full" />
              <Bloque className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  )
}
