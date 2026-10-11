'use client'

/**
 * Esqueleto de carga (pedido de Dirección Académica, oct. 2026). En vez de un
 * "Cargando…" suelto, se ve la forma de la pantalla con un brillo que recorre
 * (shimmer, clase .zr-skel), y el contenido real aparece en su lugar.
 *
 * Cada pantalla puede pedir la `variante` que más se parece a lo que va a
 * mostrar, así la transición es casi imperceptible:
 *   - 'panel'  (por defecto): un tablero — tarjeta grande, fichas y renglones.
 *   - 'lista'  : una lista de tarjetas (notas, material, cohortes…).
 *   - 'carnet' : el carnet con el recuadro del QR.
 *   - 'tabla'  : una tabla (asistencia, notas por cohorte…).
 */

type Variante = 'panel' | 'lista' | 'carnet' | 'tabla'

export function Bloque({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`zr-skel ${className}`} />
}

function PanelSkel() {
  return (
    <>
      <Bloque className="h-40 w-full" />
      <div className="grid grid-cols-3 gap-3">
        <Bloque className="h-20" />
        <Bloque className="h-20" />
        <Bloque className="h-20" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Bloque className="h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Bloque className="h-3.5 w-1/2" />
              <Bloque className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function ListaSkel() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="zr-card flex items-center gap-3 p-4">
          <Bloque className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Bloque className="h-4 w-2/3" />
            <Bloque className="h-3 w-2/5" />
          </div>
          <Bloque className="h-6 w-6 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function CarnetSkel() {
  return (
    <div className="zr-card space-y-5 p-6">
      <div className="flex items-center gap-4">
        <Bloque className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Bloque className="h-4 w-3/5" />
          <Bloque className="h-3 w-2/5" />
        </div>
      </div>
      {/* Recuadro del QR */}
      <Bloque className="mx-auto aspect-square w-52 rounded-2xl" />
      <Bloque className="mx-auto h-3 w-40" />
    </div>
  )
}

function TablaSkel() {
  return (
    <div className="overflow-hidden rounded-lg border border-zr-border">
      <div className="flex gap-3 border-b border-zr-border bg-zr-surface p-3">
        <Bloque className="h-4 w-40" />
        <Bloque className="h-4 flex-1" />
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b border-zr-border p-3 last:border-b-0">
          <Bloque className="h-4 w-40" />
          <div className="flex flex-1 gap-2">
            {[0, 1, 2, 3].map((j) => (
              <Bloque key={j} className="h-6 flex-1" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PantallaEsqueleto({ variante = 'panel' }: { variante?: Variante }) {
  return (
    <div className="zr-skel-in min-h-dvh bg-zr-bg px-5 pb-28 pt-14" role="status" aria-label="Cargando">
      <div className="space-y-8">
        {/* Encabezado: etiqueta pequeña + título grande (igual en toda la app) */}
        <div className="space-y-3">
          <Bloque className="h-3 w-28" />
          <Bloque className="h-9 w-3/5" />
        </div>
        {variante === 'lista' && <ListaSkel />}
        {variante === 'carnet' && <CarnetSkel />}
        {variante === 'tabla' && <TablaSkel />}
        {variante === 'panel' && <PanelSkel />}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  )
}
