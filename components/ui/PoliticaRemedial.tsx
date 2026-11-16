'use client'

import { InputNota } from '@/components/ui/InputNota'

export type PoliticaRemedial = 'mejor' | 'ultimo' | 'promedio'

const OPCIONES: { id: PoliticaRemedial; titulo: string; texto: string; recomendada?: boolean }[] = [
  { id: 'mejor', titulo: 'Se queda la nota más alta', texto: 'Si repite y le va peor, no pierde lo que ya tenía.', recomendada: true },
  { id: 'ultimo', titulo: 'Cuenta la nota del último intento', texto: 'La nota nueva reemplaza a la anterior, sea mayor o menor.' },
  { id: 'promedio', titulo: 'Se promedian los intentos', texto: 'La nota final es el promedio de todos los intentos.' },
]

/**
 * Cómo se calcula la nota cuando hay remedial (segundo intento en adelante).
 * Pedido del coordinador (16-nov-2026): la lógica tiene que estar a la vista en
 * el creador del examen, y el porcentaje del remedial se puede cambiar.
 */
export function PoliticaRemedialCampos({
  politica, onPolitica, tope, onTope, acento,
}: {
  politica: PoliticaRemedial
  onPolitica: (p: PoliticaRemedial) => void
  tope: number | ''
  onTope: (n: number | '') => void
  acento?: string
}) {
  return (
    <div className="space-y-4 rounded-xl border border-zr-border bg-zr-surface/40 p-4">
      <div>
        <p className="text-sm font-bold text-zr-text">Si el estudiante repite el examen (remedial)</p>
        <p className="mt-0.5 text-xs text-zr-text-muted">Elige cómo se calcula su nota final.</p>
      </div>

      <div className="space-y-2">
        {OPCIONES.map((o) => {
          const on = politica === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onPolitica(o.id)}
              style={on && acento ? { borderColor: acento } : undefined}
              className={`w-full rounded-lg border p-3 text-left ${on ? 'border-zr-blue bg-zr-blue/10' : 'border-zr-border bg-zr-bg'}`}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-zr-text">
                {o.titulo}
                {o.recomendada && <span className="rounded-full bg-zr-success/15 px-2 py-0.5 text-[10px] font-bold text-zr-success">Recomendado</span>}
              </span>
              <span className="mt-0.5 block text-xs text-zr-text-muted">{o.texto}</span>
            </button>
          )
        })}
      </div>

      <div>
        <label htmlFor="tope-remedial" className="mb-1.5 block text-sm font-semibold text-zr-text">
          Lo máximo que puede sacar en el remedial
        </label>
        <div className="flex items-center gap-2">
          <InputNota id="tope-remedial" value={tope} onChange={onTope} min={1} max={100} className="min-h-12 w-28 rounded-lg border border-zr-border bg-zr-bg px-4 text-base tabular-nums text-zr-text outline-none focus:border-zr-blue" />
          <span className="text-sm font-semibold text-zr-text-muted">% de la nota</span>
        </div>
        <p className="mt-1.5 text-xs text-zr-text-muted">
          Como el remedial suele ser otro examen, normalmente vale menos: con 80 %, el primer intento puede llegar al 100 % y el remedial hasta el 80 %. Déjalo en 100 si no quieres penalizarlo.
        </p>
      </div>
    </div>
  )
}
