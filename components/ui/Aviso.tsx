import type { ReactNode } from 'react'

type Tipo = 'exito' | 'advertencia' | 'error'

type Props = {
  tipo: Tipo
  titulo?: string
  children: ReactNode
}

// El color NUNCA es el único indicador: cada tipo lleva su símbolo y su palabra.
// A la luz del sol de un taller el color se lava, y hay gente que no distingue
// rojo de verde. Requisito de WCAG 1.4.1.
const TIPOS: Record<Tipo, { clases: string; simbolo: string; etiqueta: string; rol: 'status' | 'alert' }> = {
  exito: {
    clases: 'glass border-zr-success text-zr-text',
    simbolo: '✓',
    etiqueta: 'Listo',
    rol: 'status',
  },
  advertencia: {
    clases: 'glass border-zr-warning text-zr-text',
    simbolo: '!',
    etiqueta: 'Atención',
    rol: 'status',
  },
  error: {
    clases: 'glass border-zr-error text-zr-text',
    simbolo: '✕',
    etiqueta: 'Error',
    rol: 'alert',
  },
}

export function Aviso({ tipo, titulo, children }: Props) {
  const t = TIPOS[tipo]

  return (
    <div
      // 'alert' interrumpe al lector de pantalla; 'status' espera su turno.
      // Un error de asistencia sí debe interrumpir.
      role={t.rol}
      className={['flex gap-3 rounded-zr border-l-4 p-4', t.clases].join(' ')}
    >
      <span aria-hidden="true" className="text-xl font-bold leading-none">{t.simbolo}</span>
      <div className="flex-1">
        <p className="font-medium">{titulo ?? t.etiqueta}</p>
        <div className="text-base text-zr-text-muted">{children}</div>
      </div>
    </div>
  )
}
