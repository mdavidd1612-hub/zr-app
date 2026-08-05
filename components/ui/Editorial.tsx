/**
 * Piezas del sistema editorial.
 *
 * Vienen de zrmecademy.com/zr-mecademy-nosotros: ahí cada bloque se anuncia con
 * un número («01 — FILOSOFÍA»), una regla horizontal y mucho aire alrededor.
 * Copiar ese ritmo aquí es lo que hace que la app y la web se sientan la misma
 * marca, y no un panel genérico con los colores puestos encima.
 *
 * Regla: si una pantalla necesita un encabezado, lo pide aquí. No se escriben
 * `text-xs tracking-widest` sueltos en las páginas.
 */

interface SeccionProps {
  /** Número de orden dentro de la pantalla. Se rellena a dos dígitos. */
  numero: number
  /** Se muestra en mayúsculas. Escríbelo normal. */
  titulo: string
  children?: React.ReactNode
  /** Retraso de entrada, en milisegundos. */
  delay?: number
  className?: string
}

/** Bloque de contenido con su rótulo numerado. */
export function Seccion({ numero, titulo, children, delay = 0, className = '' }: SeccionProps) {
  return (
    <section
      className={`animate-rise space-y-5 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="zr-eyebrow">
        {String(numero).padStart(2, '0')} — {titulo}
      </p>
      {children}
    </section>
  )
}

interface EncabezadoProps {
  /** Línea pequeña sobre el titular. Ej: «Estudiante», «Panel del profesor». */
  sobretitulo?: string
  titulo: string
  /** Una línea. Si necesitas dos, el titular está mal escrito. */
  descripcion?: string
  /** Acción principal de la pantalla, a la derecha en escritorio. */
  accion?: React.ReactNode
  delay?: number
}

/** Cabecera de pantalla. Siempre la primera cosa que se anima. */
export function Encabezado({ sobretitulo, titulo, descripcion, accion, delay = 0 }: EncabezadoProps) {
  return (
    <header className="animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0 flex-1">
          {sobretitulo && (
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
              {sobretitulo}
            </p>
          )}
          <h1 className="zr-display text-4xl text-zr-text sm:text-5xl">{titulo}</h1>
          {descripcion && (
            <p className="mt-3 text-base text-zr-text-muted">{descripcion}</p>
          )}
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>
    </header>
  )
}

/** Regla horizontal entre bloques. */
export function Regla({ delay = 0 }: { delay?: number }) {
  return (
    <hr
      className="zr-rule animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    />
  )
}

interface DatoProps {
  valor: string | number
  etiqueta: string
  /** Color del número. Por defecto el azul de marca. */
  tono?: 'azul' | 'medio' | 'exito' | 'error' | 'neutro'
}

const TONO_DATO: Record<NonNullable<DatoProps['tono']>, string> = {
  azul:   'text-zr-blue',
  medio:  'text-zr-blue-mid',
  exito:  'text-zr-success',
  error:  'text-zr-error',
  neutro: 'text-zr-text',
}

/** Cifra grande con su etiqueta. Para «3 dominadas», «13/20 puntos». */
export function Dato({ valor, etiqueta, tono = 'azul' }: DatoProps) {
  return (
    <div className="zr-card zr-card-interactive p-5">
      <p className={`zr-metric text-4xl ${TONO_DATO[tono]}`}>{valor}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-zr-text-muted">
        {etiqueta}
      </p>
    </div>
  )
}

type TonoEtiqueta = 'exito' | 'aviso' | 'error' | 'info' | 'neutro'

const TONO_ETIQUETA: Record<TonoEtiqueta, string> = {
  exito:  'bg-zr-success/12 border-zr-success/30 text-zr-success',
  aviso:  'bg-zr-warning/12 border-zr-warning/30 text-zr-warning',
  error:  'bg-zr-error/12 border-zr-error/30 text-zr-error',
  info:   'bg-zr-blue/12 border-zr-blue/30 text-zr-blue',
  neutro: 'bg-zr-text-muted/10 border-zr-text-muted/25 text-zr-text-muted',
}

/** Píldora de estado. Un solo lugar decide cómo se ve «Publicado» o «Pendiente». */
export function Etiqueta({ tono = 'neutro', children }: { tono?: TonoEtiqueta; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold ${TONO_ETIQUETA[tono]}`}
    >
      {children}
    </span>
  )
}
