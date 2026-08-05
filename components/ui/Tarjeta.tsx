import type { ReactNode } from 'react'

type Tono = 'normal' | 'informativa' | 'oscura'

type Props = {
  children: ReactNode
  tono?: Tono
  className?: string
}

const TONOS: Record<Tono, string> = {
  normal:      'glass text-zr-text',
  informativa: 'glass bg-zr-blue-light bg-opacity-30 text-zr-navy',
  oscura:      'glass-dark text-white',
}

export function Tarjeta({ children, tono = 'normal', className = '' }: Props) {
  return (
    <section className={['rounded-xl p-4 border border-white/10', TONOS[tono], className].join(' ')}>
      {children}
    </section>
  )
}
