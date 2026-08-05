'use client'

interface EstadoVacioProps {
  titulo: string
  explicacion: string
  icono?: string
}

export function EstadoVacio({ titulo, explicacion, icono = '📭' }: EstadoVacioProps) {
  return (
    <div className="glass rounded-3xl p-8 text-center space-y-4 backdrop-blur-lg border border-white/20">
      <div className="text-6xl mb-4">{icono}</div>
      <h2 className="text-lg font-bold text-zr-navy">{titulo}</h2>
      <p className="text-sm text-zr-text-muted leading-relaxed max-w-sm mx-auto">{explicacion}</p>
    </div>
  )
}
