'use client'

import type { OpcionCertificacion } from '@/lib/bloqueo-unidad'

/**
 * "¿Esta unidad se bloquea hasta aprobar una certificación?" -- pedido del
 * coordinador (16-nov-2026). Las certificaciones valen nota y, si el estudiante
 * no llega al mínimo, la unidad que depende de ella no se abre. Se puede elegir
 * de cuál depende, o que no dependa de ninguna (p. ej. cuando la unidad
 * anterior era una intermedia). El bloqueo por fecha de apertura va aparte y
 * se cumple siempre.
 */
export function SelectorBloqueo({
  opciones, valor, onChange, mostrarAuto = false, disabled,
}: {
  opciones: OpcionCertificacion[]
  valor: string
  onChange: (v: string) => void
  /** Solo para unidades que ya existían: "como estaba" (por orden). */
  mostrarAuto?: boolean
  disabled?: boolean
}) {
  if (opciones.length === 0) {
    return (
      <p className="text-xs text-zr-text-muted">
        Todavía no hay certificaciones en las unidades anteriores, así que esta unidad no depende de ninguna.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-zr-text">¿Se bloquea hasta aprobar una certificación?</label>
      <select
        value={valor}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 w-full min-w-0 rounded-lg border border-zr-border bg-zr-bg px-3 text-sm text-zr-text disabled:opacity-50"
      >
        {mostrarAuto && <option value="auto">Automático: la certificación de la unidad anterior, si tiene</option>}
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>Sí, hasta aprobar: {o.label}</option>
        ))}
        <option value="none">No, se abre libre</option>
      </select>
      <p className="text-xs text-zr-text-muted">
        Si el estudiante no llega a la nota mínima de esa certificación, esta unidad sigue cerrada hasta que la apruebe
        (puede repetirla en el remedial). Además, la fecha de apertura se respeta siempre.
      </p>
    </div>
  )
}
