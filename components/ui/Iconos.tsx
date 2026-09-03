/**
 * Iconos propios. Silueta, un solo trazo, sin color: heredan `currentColor`
 * del contenedor, así que el mismo icono sirve en azul cuando está activo y en
 * gris cuando no.
 *
 * Por qué no emojis: se dibujan distinto en cada teléfono (Android los pinta
 * con otro set), meten color donde el manual de identidad no lo permite, y a
 * 20 px un 📋 y un 📄 no se distinguen. Un trazo de 1.75 px sí.
 *
 * Regla: si una pantalla necesita un icono, se agrega aquí. No se pega un
 * emoji en el JSX.
 */

interface IconoProps {
  /** Tamaño en píxeles. 24 para navegación, 20 dentro de texto. */
  size?: number
  className?: string
}

function Base({ size = 24, className, children }: IconoProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/* --------------------------------------------------------------------------
   Navegación
   -------------------------------------------------------------------------- */

export function IconoInicio(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </Base>
  )
}

export function IconoExamen(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="m8.5 14 2 2 4-4" />
    </Base>
  )
}

/** Mapa de dominio: una lista donde lo primero ya está cumplido. */
export function IconoProgreso(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="m3 6.5 1.5 1.5L7.5 5" />
      <path d="M11 7h10" />
      <path d="M4 12.5h3M11 12.5h10" />
      <path d="M4 18h3M11 18h10" />
    </Base>
  )
}

/** Dudas: un globo de conversación. */
export function IconoDuda(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M4 5.5h16v11H9.5L5.5 20v-3.5H4v-11Z" />
      <path d="M8.5 10h7M8.5 13h4.5" />
    </Base>
  )
}

export function IconoPerfil(p: IconoProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </Base>
  )
}

/* --------------------------------------------------------------------------
   Panel del profesor y administración
   -------------------------------------------------------------------------- */

export function IconoCalendario(p: IconoProps) {
  return (
    <Base {...p}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4M16 3v4" />
    </Base>
  )
}

/** Escanear: las cuatro esquinas de un visor con la línea de lectura. */
export function IconoEscanear(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M4 8.5V6a2 2 0 0 1 2-2h2.5" />
      <path d="M15.5 4H18a2 2 0 0 1 2 2v2.5" />
      <path d="M20 15.5V18a2 2 0 0 1-2 2h-2.5" />
      <path d="M8.5 20H6a2 2 0 0 1-2-2v-2.5" />
      <path d="M4 12h16" />
    </Base>
  )
}

/** Calificar: un documento con un lápiz encima. */
export function IconoCalificar(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M18 12V6l-3-3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h5" />
      <path d="M15 3v3.5h3" />
      <path d="M20.5 15.5 15 21l-2.5.5.5-2.5 5.5-5.5a1.4 1.4 0 0 1 2 2Z" />
    </Base>
  )
}

export function IconoPanel(p: IconoProps) {
  return (
    <Base {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Base>
  )
}

export function IconoEstudiantes(p: IconoProps) {
  return (
    <Base {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 5.6" />
      <path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </Base>
  )
}

export function IconoPersonal(p: IconoProps) {
  return (
    <Base {...p}>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3 20a7 7 0 0 1 14 0" />
      <path d="M18 8v6" />
      <path d="M15 11h6" />
    </Base>
  )
}

/* --------------------------------------------------------------------------
   Contenido y estados
   -------------------------------------------------------------------------- */

export function IconoDocumento(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M8.5 13h7M8.5 17h4" />
    </Base>
  )
}

export function IconoVideo(p: IconoProps) {
  return (
    <Base {...p}>
      <rect x="3" y="5.5" width="13" height="13" rx="2" />
      <path d="m16 10.5 5-3v9l-5-3" />
    </Base>
  )
}

export function IconoCarnet(p: IconoProps) {
  return (
    <Base {...p}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <circle cx="8" cy="11" r="2" />
      <path d="M4.8 16a3.6 3.6 0 0 1 6.4 0" />
      <path d="M14.5 10h4M14.5 13.5h4" />
    </Base>
  )
}

export function IconoNotas(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M4 20V10M9.33 20V4M14.67 20v-7M20 20v-4" />
    </Base>
  )
}

export function IconoSalir(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M9.5 8 5.5 12l4 4" />
      <path d="M5.5 12H14" />
    </Base>
  )
}

export function IconoReloj(p: IconoProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.75" />
    </Base>
  )
}

export function IconoCheck(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Base>
  )
}

export function IconoCampana(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M6 10a6 6 0 0 1 12 0c0 3.2 1 4.6 1.8 5.4H4.2C5 14.6 6 13.2 6 10Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </Base>
  )
}

export function IconoAviso(p: IconoProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.3h.01" />
    </Base>
  )
}

export function IconoCandado(p: IconoProps) {
  return (
    <Base {...p}>
      <rect x="4.5" y="10" width="15" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Base>
  )
}

/** Tres rayas: el menú con todas las secciones, no solo las cuatro visibles. */
export function IconoMenu(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </Base>
  )
}

export function IconoFlechaAtras(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </Base>
  )
}

export function IconoCerrar(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  )
}

// Mostrar/ocultar contraseña. Dos iconos separados (no uno con `strike`
// dibujado en CSS) porque a 20px una diagonal superpuesta se ve como una
// mancha, no como un trazo — más fácil de leer como dos siluetas distintas.
export function IconoOjo(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Base>
  )
}

export function IconoOjoTachado(p: IconoProps) {
  return (
    <Base {...p}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.4 4.3M6.5 6.5C3.7 8.3 2 12 2 12s3.5 7 10 7c1.4 0 2.6-.3 3.7-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Base>
  )
}

/* --------------------------------------------------------------------------
   Marca
   -------------------------------------------------------------------------- */

/**
 * Marca ZR reducida a un trazo: una llave de tuercas. No es el logo oficial
 * —ese no se redibuja— sino la marca de agua que la app usa donde antes
 * había un emoji.
 */
export function MarcaZR({ size = 24, className }: IconoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15.8 4.4a4.8 4.8 0 0 0-6.2 6.1L4 16.1a2 2 0 0 0 0 2.8l1.1 1.1a2 2 0 0 0 2.8 0l5.6-5.6a4.8 4.8 0 0 0 6.1-6.2l-2.8 2.8-2.8-.7-.7-2.8Z" />
    </svg>
  )
}
