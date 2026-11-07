'use client'

import { IconoCheck } from './Iconos'

/**
 * Confirmación al crear/guardar un examen o tarea dentro de una unidad:
 * avisa que ya quedó registrado como evaluación en Notas, sin que el
 * profesor tenga que ir a "Registrar evaluación" aparte (H.33, núcleo
 * cerrado -- pedido explícito del coordinador, 7-nov-2026).
 */
export function ModalEvaluacionAgregada({
  peso, onCerrar, modo = 'creada',
}: { peso: number; onCerrar: () => void; modo?: 'creada' | 'actualizada' }) {
  const titulo = modo === 'creada' ? 'Se añadió como evaluación' : 'Sigue siendo una evaluación en Notas'
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-zr-surface p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zr-success/15 text-zr-success">
          <IconoCheck size={28} />
        </div>
        <p className="mb-1 text-lg font-bold text-zr-text">{titulo}</p>
        <p className="mb-5 text-sm text-zr-text-muted">
          {peso > 0 ? `Vale ${peso}% de la nota de este módulo` : 'Por ahora vale 0% de la nota de este módulo'}.
          Las notas de los estudiantes se cargan solas cuando se califiquen.
        </p>
        <button
          onClick={onCerrar}
          className="min-h-12 w-full rounded-lg bg-zr-blue text-sm font-bold text-white"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
