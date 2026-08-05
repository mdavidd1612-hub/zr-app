import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variante = 'principal' | 'secundario' | 'peligro' | 'texto'
type Tamano = 'normal' | 'grande'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  tamano?: Tamano
  cargando?: boolean
  anchoCompleto?: boolean
  children: ReactNode
}

// Altura mínima 56 px y texto de 16 px, de spec/04 §0. No se bajan: la app se
// usa de pie, en un taller, con las manos sucias o con guantes.
const VARIANTES: Record<Variante, string> = {
  principal:  'bg-zr-blue text-white hover:bg-zr-blue-deep active:bg-zr-blue-deep',
  secundario: 'bg-white text-zr-navy border-2 border-zr-border hover:border-zr-blue',
  peligro:    'bg-zr-error text-white hover:brightness-90',
  texto:      'bg-transparent text-zr-blue-deep underline underline-offset-4',
}

const TAMANOS: Record<Tamano, string> = {
  normal: 'min-h-[56px] px-5 text-base',
  grande: 'min-h-[64px] px-6 text-lg',
}

export function Boton({
  variante = 'principal',
  tamano = 'normal',
  cargando = false,
  anchoCompleto = false,
  disabled,
  children,
  className = '',
  ...resto
}: Props) {
  return (
    <button
      {...resto}
      disabled={disabled || cargando}
      // Un lector de pantalla debe saber que está ocupado, no solo verlo girar.
      aria-busy={cargando || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-zr font-medium',
        'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTES[variante],
        TAMANOS[tamano],
        anchoCompleto ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {cargando && (
        <span
          aria-hidden="true"
          className="size-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {cargando ? 'Un momento…' : children}
    </button>
  )
}
