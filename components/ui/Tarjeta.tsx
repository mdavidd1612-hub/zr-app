import type { ReactNode } from 'react'

type Tono = 'normal' | 'informativa' | 'oscura'

type Props = {
  children: ReactNode
  tono?: Tono
  className?: string
}

// La azul claro lleva texto navy, nunca blanco: sobre #98BAE3 el blanco da
// 1,9:1 y no cumple. Con navy da 7,1:1 (AAA). Ver spec/06 §3.
const TONOS: Record<Tono, string> = {
  normal:      'bg-white text-zr-text border border-zr-border',
  informativa: 'bg-zr-blue-light text-zr-navy',
  oscura:      'bg-zr-navy text-white',
}

export function Tarjeta({ children, tono = 'normal', className = '' }: Props) {
  return (
    <section className={['rounded-zr p-4', TONOS[tono], className].join(' ')}>
      {children}
    </section>
  )
}
