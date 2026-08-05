type Props = {
  texto?: string
}

// Toda acción con red muestra un indicador. Nunca una pantalla congelada:
// en el taller la señal es mala y sin esto el profesor vuelve a tocar el botón.
export function Cargando({ texto = 'Cargando…' }: Props) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 p-8">
      <span
        aria-hidden="true"
        className="size-10 animate-spin rounded-full border-4 border-zr-border border-t-zr-blue"
      />
      <p className="text-base text-zr-text-muted">{texto}</p>
    </div>
  )
}
