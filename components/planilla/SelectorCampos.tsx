'use client'

import { GRUPOS_CAMPOS, type CamposPlanilla } from '@/lib/planilla-campos'
import { IconoCheck } from '@/components/ui/Iconos'

/**
 * Checklist para elegir qué campos salen en la planilla al descargarla
 * (pedido de Dirección Académica, nov. 2026). Por defecto todos marcados;
 * se puede quitar los que no se quieran imprimir. Se usa tanto en la vista
 * individual (estudiantes/[id]/planilla) como en el modal de descarga masiva
 * (estudiantes), por eso es un componente aparte y no vive en una pantalla.
 *
 * Es controlado: el estado (`campos`) vive en la pantalla que lo usa, aquí
 * solo se dibuja y se avisa el cambio por `onCambiar`.
 */
export function SelectorCampos({
  campos,
  onCambiar,
}: {
  campos: CamposPlanilla
  onCambiar: (campos: CamposPlanilla) => void
}) {
  const todas = GRUPOS_CAMPOS.flatMap((g) => g.campos.map((c) => c.clave))
  const marcados = todas.filter((c) => campos[c]).length
  const todosMarcados = marcados === todas.length

  function alternar(clave: keyof CamposPlanilla) {
    onCambiar({ ...campos, [clave]: !campos[clave] })
  }

  function marcarTodos(valor: boolean) {
    onCambiar(Object.fromEntries(todas.map((c) => [c, valor])) as CamposPlanilla)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zr-text-muted">
          {marcados} de {todas.length} campos
        </p>
        <button
          type="button"
          onClick={() => marcarTodos(!todosMarcados)}
          className="rounded-lg border border-zr-border px-3 py-1.5 text-xs font-bold text-zr-text-muted transition-colors hover:text-zr-text"
        >
          {todosMarcados ? 'Quitar todos' : 'Marcar todos'}
        </button>
      </div>

      {GRUPOS_CAMPOS.map((g) => (
        <div key={g.grupo} className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-zr-blue-mid">{g.grupo}</p>
          <div className="space-y-1.5">
            {g.campos.map((c) => {
              const on = campos[c.clave]
              return (
                <button
                  key={c.clave}
                  type="button"
                  onClick={() => alternar(c.clave)}
                  aria-pressed={on}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
                      on ? 'border-zr-blue bg-zr-blue text-white' : 'border-zr-border'
                    }`}
                  >
                    {on && <IconoCheck size={14} />}
                  </span>
                  <span className={`text-sm ${on ? 'text-zr-text' : 'text-zr-text-muted line-through'}`}>
                    {c.etiqueta}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
