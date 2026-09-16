'use client'

import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Tarjetas de resultado del feedback de módulo (número + barra), compartidas
 * entre Dirección Académica (/feedback-modulos) y el profesor
 * (/feedback-modulo-docente) — mismo dato (`v_feedback_macro_summary`),
 * mismo diseño. Pedido explícito del coordinador (sept. 2026): además del
 * número, que se vea en gráfico.
 */

export interface FilaResumenFeedback {
  pregunta: string
  promedio: number
  respuestas: number
}

interface Props {
  filas: FilaResumenFeedback[]
}

export function ResultadosFeedback({ filas }: Props) {
  if (filas.length === 0) {
    return (
      <EstadoVacio
        titulo="Todavía no hay suficientes respuestas"
        explicacion="El promedio solo se muestra a partir de 3 respuestas — así nadie puede adivinar quién dijo qué."
      />
    )
  }

  return (
    <div className="space-y-3">
      {filas.map((f) => (
        <div key={f.pregunta} className="zr-card p-6">
          <p className="text-sm font-semibold text-zr-text">{f.pregunta}</p>
          <div className="mt-4 flex items-end gap-2">
            <span className="zr-metric text-3xl text-zr-blue">{f.promedio.toFixed(1)}</span>
            <span className="pb-1 text-sm text-zr-text-muted">/ 5</span>
            <span className="ml-auto pb-1 text-xs text-zr-text-muted">
              {f.respuestas} respuesta{f.respuestas === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zr-border/60">
            <div
              className="h-full rounded-full bg-zr-blue"
              style={{ width: `${Math.min(100, (f.promedio / 5) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
