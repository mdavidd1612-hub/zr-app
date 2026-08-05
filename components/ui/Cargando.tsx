'use client'

interface CargandoProps {
  texto?: string
}

export function Cargando({ texto = 'Cargando...' }: CargandoProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-zr-background">
      <div className="glass rounded-3xl p-12 text-center space-y-6 backdrop-blur-lg border border-white/20 max-w-sm">
        <div className="flex justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-zr-blue" />
        </div>
        <p className="text-sm text-zr-text-muted font-medium">{texto}</p>
      </div>
    </div>
  )
}
