import type { ReactNode } from 'react'

type Props = {
  titulo: string
  /** Por qué está vacío. Nunca dejes al usuario adivinando. */
  explicacion: string
  /** Qué puede hacer al respecto, si puede hacer algo. */
  accion?: ReactNode
}

// Regla de spec/04 §0: un estado vacío siempre explica POR QUÉ está vacío y QUÉ
// hacer. "No hay datos" no es un estado vacío, es una respuesta incompleta.
export function EstadoVacio({ titulo, explicacion, accion }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <h2 className="text-xl">{titulo}</h2>
      <p className="max-w-prose text-base text-zr-text-muted">{explicacion}</p>
      {accion}
    </div>
  )
}
