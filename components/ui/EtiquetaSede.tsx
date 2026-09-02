// Etiqueta de sede y turno.
//
// Nace de un problema real: llegaron a existir dos cohortes llamadas igual
// ("PTMA-2026-II"), una en San Antonio de Los Altos y otra en UCV, y al
// inscribir el vendedor veía dos opciones idénticas en el desplegable sin
// forma de distinguirlas.
//
// El nombre de la cohorte ya no se escribe a mano (migración 060), así que dos
// cortes del mismo programa nunca vuelven a llamarse igual — pero la sede sigue
// siendo el dato que de verdad necesita ver quien inscribe, y no cabe en el
// nombre. Va como etiqueta al lado, no dentro del texto.

const CLASE_BASE =
  'inline-flex shrink-0 items-center gap-1 rounded-full border border-zr-blue-mid/40 ' +
  'bg-zr-blue/20 px-2.5 py-1 text-[11px] font-bold leading-none text-zr-blue-light ' +
  'backdrop-blur-md'

export function EtiquetaSede({ sede, turno }: { sede?: string | null; turno?: string | null }) {
  if (!sede && !turno) return null

  return (
    <span className={CLASE_BASE}>
      {sede ?? 'Sin sede'}
      {turno && (
        <>
          <span aria-hidden className="opacity-40">·</span>
          <span className="font-semibold opacity-90">{turno}</span>
        </>
      )}
    </span>
  )
}
