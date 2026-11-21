'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { CalendarioModulos } from '@/components/CalendarioModulos'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

/**
 * Panel de configuración. Solo super_admin — la RLS de la migración 012
 * ("super: escribir config") es la garantía real; esto solo evita que alguien
 * más vea un formulario que no puede usar.
 *
 * Toda la aplicación lee de aquí: cambiar un valor es editar una fila, no
 * desplegar código. Por eso NUNCA se hardcodean estos números en el código.
 *
 * Rediseño (nov 2026, pedido del coordinador): la pantalla mostraba cada fila
 * "como código" -- el nombre técnico, un cuadro de texto sin unidad y el valor
 * crudo (hasta JSON). Ahora cada ajuste tiene un nombre claro, una explicación
 * corta, un control del tipo correcto (hora, número con unidad, texto) y
 * vive dentro de un grupo con sentido. El nombre técnico queda en "detalles".
 */

type Tipo = 'numero' | 'porcentaje' | 'fraccion' | 'hora' | 'texto' | 'textoLargo' | 'preguntas' | 'version'

interface Campo {
  grupo: string
  titulo: string
  ayuda: string
  tipo: Tipo
  unidad?: string
  min?: number
  max?: number
  /** Valor sin confirmar por la academia: se avisa para que no se tome como definitivo. */
  provisional?: boolean
}

const GRUPOS: { id: string; titulo: string; intro: string }[] = [
  { id: 'asistencia', titulo: 'Asistencia y horarios', intro: 'A qué hora empieza la clase, cuándo se considera tarde y cuándo se entrega el refrigerio.' },
  { id: 'notas', titulo: 'Notas y aprobación', intro: 'Con cuánto se aprueba, cuánto vale la participación y cómo penalizan los reintentos.' },
  { id: 'aula', titulo: 'Aula Virtual y material', intro: 'Tamaños permitidos y cuándo un material cuenta como visto.' },
  { id: 'feedback', titulo: 'Feedback y calificación', intro: 'Preguntas que ven los estudiantes y plazos para calificar.' },
  { id: 'contacto', titulo: 'Contacto y avisos', intro: 'Mensajes y números que ven los estudiantes cuando algo falla o están bloqueados.' },
  { id: 'evento', titulo: 'Evento público', intro: 'Datos de la página pública /evento.' },
  { id: 'coffee', titulo: 'ZR Coffee', intro: 'Cómo se calcula el precio de venta de la cantina.' },
  { id: 'terminos', titulo: 'Términos y condiciones', intro: 'El texto que cada usuario acepta al entrar por primera vez.' },
  { id: 'otros', titulo: 'Otros ajustes', intro: 'Ajustes que todavía no tienen una explicación propia.' },
]

const CAMPOS: Record<string, Campo> = {
  'attendance.hora_inicio': { grupo: 'asistencia', titulo: 'Hora de inicio de la clase (mañana)', ayuda: 'Pasada la tolerancia de abajo, quien llega cuenta como tarde. También se usa para los turnos que no tengan hora propia.', tipo: 'hora' },
  'attendance.hora_inicio.tarde': { grupo: 'asistencia', titulo: 'Hora de inicio de la clase (tarde)', ayuda: 'Para los grupos del turno de la tarde.', tipo: 'hora' },
  'attendance.tarde_umbral_minutos': { grupo: 'asistencia', titulo: 'Tolerancia para llegar tarde (mañana)', ayuda: 'Minutos después de abrirse la sesión en que todavía cuenta como "presente". Pasado ese tiempo, cuenta como "tarde".', tipo: 'numero', unidad: 'minutos', min: 0, max: 180 },
  'attendance.tarde_umbral_minutos.tarde': { grupo: 'asistencia', titulo: 'Tolerancia para llegar tarde (tarde)', ayuda: 'Lo mismo, para el turno de la tarde.', tipo: 'numero', unidad: 'minutos', min: 0, max: 180, provisional: true },
  'attendance.refrigerio_hora_inicio': { grupo: 'asistencia', titulo: 'Refrigerio: desde qué hora (mañana)', ayuda: 'Desde esta hora la cantina puede escanear el QR de refrigerio.', tipo: 'hora' },
  'attendance.refrigerio_hora_fin': { grupo: 'asistencia', titulo: 'Refrigerio: hasta qué hora (mañana)', ayuda: 'Después de esta hora ya no se puede escanear el refrigerio.', tipo: 'hora' },
  'attendance.refrigerio_hora_inicio.tarde': { grupo: 'asistencia', titulo: 'Refrigerio: desde qué hora (tarde)', ayuda: 'Igual que el de la mañana, para el turno de la tarde.', tipo: 'hora', provisional: true },
  'attendance.refrigerio_hora_fin.tarde': { grupo: 'asistencia', titulo: 'Refrigerio: hasta qué hora (tarde)', ayuda: 'Igual que el de la mañana, para el turno de la tarde.', tipo: 'hora', provisional: true },
  'attendance.qr_window_seconds': { grupo: 'asistencia', titulo: 'Cuánto dura cada código QR', ayuda: 'El QR de asistencia cambia solo cada tanto para que no se pueda compartir una foto. Más corto es más seguro.', tipo: 'numero', unidad: 'segundos', min: 10, max: 300 },
  'attendance.qr_drift_tolerance': { grupo: 'asistencia', titulo: 'Tolerancia por reloj desfasado', ayuda: 'Cuántos códigos hacia atrás y adelante se aceptan, por si el reloj de un teléfono anda un poco desajustado. Lo normal es 1.', tipo: 'numero', min: 0, max: 5 },
  'academia.horas_por_sabado': { grupo: 'asistencia', titulo: 'Horas académicas por sábado', ayuda: 'Cuántas horas vale una sesión de sábado. Con esto se calculan las horas totales de cada módulo.', tipo: 'numero', unidad: 'horas', min: 1, max: 12 },

  'module.passing_threshold_first': { grupo: 'notas', titulo: 'Nota mínima para aprobar el primer módulo', ayuda: 'Regla especial de arranque del programa. Solo afecta a quienes se matriculen desde ahora.', tipo: 'numero', unidad: 'puntos', min: 0, max: 20 },
  'module.passing_threshold_default': { grupo: 'notas', titulo: 'Nota mínima para aprobar los demás módulos', ayuda: 'Del segundo módulo en adelante. Solo afecta a matrículas nuevas: quien ya está cursando conserva su nota mínima.', tipo: 'numero', unidad: 'puntos', min: 0, max: 20 },
  'exam.individual_passing_score': { grupo: 'notas', titulo: 'Nota mínima para aprobar un examen suelto', ayuda: 'Para una evaluación individual que no es de módulo.', tipo: 'numero', unidad: 'puntos', min: 0, max: 20 },
  'exam.max_score': { grupo: 'notas', titulo: 'Escala de las notas', ayuda: 'La nota máxima de todas las evaluaciones internas. Cambiarla afecta cómo se calculan todas las notas, hazlo solo si de verdad cambia la escala.', tipo: 'numero', unidad: 'puntos', min: 1, max: 100 },
  'module.participation_weight_min': { grupo: 'notas', titulo: 'Participación: peso mínimo en la nota', ayuda: 'Cada profesor fija el peso de la participación, nunca por debajo de este mínimo.', tipo: 'fraccion', unidad: '%', min: 0, max: 100 },
  'module.participation_weight_max': { grupo: 'notas', titulo: 'Participación: peso máximo en la nota', ayuda: 'Ningún profesor puede darle a la participación más que esto.', tipo: 'fraccion', unidad: '%', min: 0, max: 100 },
  'aula.intento_cap_1': { grupo: 'notas', titulo: 'Primer intento de un examen: nota máxima', ayuda: 'Porcentaje de la nota que puede sacar quien presenta el examen por primera vez. Normalmente 100.', tipo: 'porcentaje', unidad: '%', min: 1, max: 100 },
  'aula.intento_cap_2': { grupo: 'notas', titulo: 'Reintentos: nota máxima', ayuda: 'Porcentaje de la nota que puede sacar quien repite el examen (segundo intento en adelante).', tipo: 'porcentaje', unidad: '%', min: 1, max: 100 },

  'aula.material_progress_completado_pct': { grupo: 'aula', titulo: 'Cuánto hay que ver para marcar un material como visto', ayuda: 'Porcentaje del video, audio o documento que el estudiante tiene que recorrer para que cuente como completado.', tipo: 'porcentaje', unidad: '%', min: 10, max: 100 },
  'aula.material_progress_guardar_cada_seg': { grupo: 'aula', titulo: 'Cada cuánto se guarda el avance', ayuda: 'Cada cuántos segundos la app guarda por dónde va el estudiante. Es solo una guía para el teléfono.', tipo: 'numero', unidad: 'segundos', min: 5, max: 120 },
  'aula.tarea_max_mb': { grupo: 'aula', titulo: 'Tamaño máximo de una entrega de tarea', ayuda: 'Peso máximo del PDF que sube el estudiante.', tipo: 'numero', unidad: 'MB', min: 1, max: 100 },
  'content.max_size_mb': { grupo: 'aula', titulo: 'Tamaño máximo de un material', ayuda: 'Peso máximo de un archivo que sube el profesor (PDF, video, etc.).', tipo: 'numero', unidad: 'MB', min: 1, max: 500 },
  'content.aviso_pesado_mb': { grupo: 'aula', titulo: 'Avisar cuando un material pesa mucho', ayuda: 'Desde este peso se le avisa al profesor que puede verse lento en teléfonos sencillos. Solo avisa, no bloquea.', tipo: 'numero', unidad: 'MB', min: 1, max: 200 },

  'feedback.micro_max_questions': { grupo: 'feedback', titulo: 'Preguntas del feedback de cada clase', ayuda: 'Máximo de preguntas. Tiene que poder responderse en menos de 20 segundos.', tipo: 'numero', min: 1, max: 10 },
  'feedback.min_responses_to_show': { grupo: 'feedback', titulo: 'Respuestas mínimas antes de mostrarle el resultado al profesor', ayuda: 'Con pocas respuestas se adivinaría quién opinó qué. Hasta llegar a este número, el profesor no ve nada.', tipo: 'numero', unidad: 'respuestas', min: 1, max: 30 },
  'feedback.macro_questions': { grupo: 'feedback', titulo: 'Preguntas del feedback de cada módulo', ayuda: 'Lo que responde el estudiante al terminar un módulo. Puedes cambiar el texto, agregar o quitar preguntas.', tipo: 'preguntas' },
  'grading.sla_hours': { grupo: 'feedback', titulo: 'Tiempo objetivo para calificar una redacción', ayuda: 'Se usa para los reportes. No bloquea nada si se pasa.', tipo: 'numero', unidad: 'horas', min: 1, max: 720 },

  'app.support_channel': { grupo: 'contacto', titulo: 'Mensaje cuando algo falla', ayuda: 'Texto que ve el estudiante si algo no funciona. Dile a quién acudir.', tipo: 'texto' },
  'finanzas.whatsapp_administracion': { grupo: 'contacto', titulo: 'WhatsApp de administración', ayuda: 'Número con código de país y sin signos ni espacios, por ejemplo 58412XXXXXXX. Lo ve el estudiante bloqueado por solvencia.', tipo: 'texto' },

  'evento.nombre': { grupo: 'evento', titulo: 'Nombre del evento', ayuda: 'Título que aparece en la página pública.', tipo: 'texto' },
  'evento.fecha': { grupo: 'evento', titulo: 'Fecha del evento', ayuda: 'Se muestra tal cual la escribas, por ejemplo "Domingo 4 de octubre". Vacío = no se muestra.', tipo: 'texto' },
  'evento.hora': { grupo: 'evento', titulo: 'Hora del evento', ayuda: 'Por ejemplo "9:00 a.m.". Vacío = no se muestra.', tipo: 'texto' },
  'evento.lugar': { grupo: 'evento', titulo: 'Lugar del evento', ayuda: 'Dirección o sede. Vacío = no se muestra.', tipo: 'texto' },

  'zr_coffee.margen_ganancia_pct': { grupo: 'coffee', titulo: 'Margen de ganancia', ayuda: 'Porcentaje que se suma al costo para fijar el precio de venta.', tipo: 'porcentaje', unidad: '%', min: 0, max: 300 },

  'terms.version': { grupo: 'terminos', titulo: 'Versión de los términos', ayuda: 'Súbela (de 1 a 2) SOLO cuando cambies el texto y quieras que TODOS los usuarios lo vuelvan a aceptar la próxima vez que entren.', tipo: 'version', min: 1, max: 999 },
  'terms.text': { grupo: 'terminos', titulo: 'Texto de los términos y condiciones', ayuda: 'Lo que leen antes de aceptar. Si lo cambias de fondo, sube también la versión.', tipo: 'textoLargo' },
}

interface Config {
  key: string
  value: unknown
  description: string
  isPublic: boolean
  updatedAt: string
  actualizadoPor: string | null
}

interface Cambio {
  id: number
  key: string
  oldValue: unknown
  newValue: unknown
  changedAt: string
  cambiadoPor: string | null
}

interface Pregunta { id: string; tipo: string; texto: string }

function campoDe(c: Config): Campo {
  return CAMPOS[c.key] ?? { grupo: 'otros', titulo: c.description || c.key, ayuda: '', tipo: typeof c.value === 'number' ? 'numero' : 'texto' }
}

// Cómo se muestra el valor guardado en el control (las fracciones se ven en %).
function textoMostrado(c: Config): string {
  const campo = campoDe(c)
  const v = c.value
  if (campo.tipo === 'fraccion' && typeof v === 'number') return String(Math.round(v * 10000) / 100)
  if (campo.tipo === 'preguntas') return JSON.stringify(v ?? [])
  if (typeof v === 'string') return v
  if (v === null || v === undefined) return ''
  return typeof v === 'number' ? String(v) : JSON.stringify(v)
}

// Lo que se guarda a partir de lo que el usuario escribió. Devuelve un error
// legible si el valor no sirve.
function aValorGuardado(campo: Campo, texto: string): { ok: true; valor: unknown } | { ok: false; error: string } {
  if (campo.tipo === 'numero' || campo.tipo === 'porcentaje' || campo.tipo === 'fraccion' || campo.tipo === 'version') {
    const n = Number(texto.replace(',', '.'))
    if (texto.trim() === '' || !Number.isFinite(n)) return { ok: false, error: 'Escribe un número.' }
    if (campo.min !== undefined && n < campo.min) return { ok: false, error: `Tiene que ser ${campo.min} o más.` }
    if (campo.max !== undefined && n > campo.max) return { ok: false, error: `Tiene que ser ${campo.max} o menos.` }
    return { ok: true, valor: campo.tipo === 'fraccion' ? Math.round(n * 100) / 10000 : n }
  }
  if (campo.tipo === 'hora') {
    if (!/^\d{2}:\d{2}$/.test(texto)) return { ok: false, error: 'Elige una hora válida.' }
    return { ok: true, valor: texto }
  }
  if (campo.tipo === 'preguntas') {
    try {
      const arr = JSON.parse(texto) as Pregunta[]
      if (!Array.isArray(arr) || arr.length === 0) return { ok: false, error: 'Tiene que haber al menos una pregunta.' }
      if (arr.some((p) => !p.texto.trim())) return { ok: false, error: 'Hay una pregunta sin texto.' }
      return { ok: true, valor: arr }
    } catch {
      return { ok: false, error: 'Las preguntas no son válidas.' }
    }
  }
  return { ok: true, valor: texto }
}

function resumenValor(campo: Campo | undefined, v: unknown): string {
  if (v === null || v === undefined || v === '') return '(vacío)'
  if (campo?.tipo === 'fraccion' && typeof v === 'number') return `${Math.round(v * 10000) / 100} %`
  if (campo?.tipo === 'preguntas' && Array.isArray(v)) return `${v.length} preguntas`
  if (campo?.tipo === 'textoLargo' && typeof v === 'string') return v.length > 60 ? `${v.slice(0, 60)}…` : v
  const base = typeof v === 'string' ? v : JSON.stringify(v)
  return campo?.unidad ? `${base} ${campo.unidad}` : base
}

const CONTROL = 'min-h-12 w-full rounded-lg border border-zr-border bg-zr-bg px-4 text-sm text-zr-text outline-none focus:border-zr-blue'

export default function Configuracion() {
  const router = useRouter()
  const [esSuperAdmin, setEsSuperAdmin] = useState<boolean | null>(null)
  const [config, setConfig] = useState<Config[]>([])
  const [historial, setHistorial] = useState<Cambio[]>([])
  const [borradores, setBorradores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
  const [guardado, setGuardado] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)
  const [abierto, setAbierto] = useState<string>('asistencia')

  useEffect(() => {
    let vigente = true

    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!vigente) return

      const esSuper = perfil?.role === 'super_admin'
      setEsSuperAdmin(esSuper)
      if (!esSuper) {
        setCargando(false)
        return
      }

      const [{ data: cfg }, { data: hist }] = await Promise.all([
        supabase.from('system_config').select('key, value, description, is_public, updated_at, profiles(full_name)').order('key'),
        supabase.from('system_config_history').select('id, key, old_value, new_value, changed_at, profiles(full_name)').order('changed_at', { ascending: false }).limit(30),
      ])

      if (!vigente) return

      const filasCfg = cfg as unknown as {
        key: string; value: unknown; description: string; is_public: boolean
        updated_at: string; profiles: { full_name: string } | null
      }[] | null

      setConfig(
        (filasCfg ?? []).map((c) => ({
          key: c.key,
          value: c.value,
          description: c.description,
          isPublic: c.is_public,
          updatedAt: c.updated_at,
          actualizadoPor: c.profiles?.full_name ?? null,
        })),
      )

      const filasHist = hist as unknown as {
        id: number; key: string; old_value: unknown; new_value: unknown
        changed_at: string; profiles: { full_name: string } | null
      }[] | null

      setHistorial(
        (filasHist ?? []).map((h) => ({
          id: h.id,
          key: h.key,
          oldValue: h.old_value,
          newValue: h.new_value,
          changedAt: h.changed_at,
          cambiadoPor: h.profiles?.full_name ?? null,
        })),
      )

      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  async function guardar(c: Config) {
    const texto = borradores[c.key]
    if (texto === undefined) return
    const campo = campoDe(c)

    const r = aValorGuardado(campo, texto)
    if (!r.ok) {
      setErrores((e) => ({ ...e, [c.key]: r.error }))
      return
    }

    setGuardando(c.key)
    setErrores((e) => { const { [c.key]: _x, ...resto } = e; return resto })

    const { error: fallo } = await createClient()
      .from('system_config')
      .update({ value: r.valor as never })
      .eq('key', c.key)

    if (fallo) {
      setErrores((e) => ({ ...e, [c.key]: 'No se pudo guardar. Revisa tu conexión e inténtalo otra vez.' }))
      setGuardando(null)
      return
    }

    setBorradores((b) => { const { [c.key]: _omitido, ...resto } = b; return resto })
    setGuardando(null)
    setGuardado(c.key)
    setTimeout(() => setGuardado((g) => (g === c.key ? null : g)), 2500)
    setVersion((v) => v + 1)
  }

  if (cargando) {
    return (
      <PantallaEsqueleto />
    )
  }

  if (esSuperAdmin === false) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zr-bg px-5">
        <div className="zr-card max-w-sm p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Solo super_admin</p>
          <p className="mt-2 text-sm text-zr-text-muted">
            Esta pantalla cambia reglas de negocio de toda la academia. Solo super_admin
            puede entrar.
          </p>
        </div>
        <BotonVolver href="/panel" />
      </div>
    )
  }

  const porGrupo = GRUPOS.map((g) => ({
    ...g,
    campos: config.filter((c) => campoDe(c).grupo === g.id),
  })).filter((g) => g.campos.length > 0)

  function tarjeta(c: Config) {
    const campo = campoDe(c)
    const enEdicion = borradores[c.key] !== undefined
    const base = textoMostrado(c)
    const valor = enEdicion ? borradores[c.key] : base
    const cambio = enEdicion && borradores[c.key] !== base
    const poner = (v: string) => setBorradores((b) => ({ ...b, [c.key]: v }))
    const error = errores[c.key]

    let control: React.ReactNode
    if (campo.tipo === 'preguntas') {
      let lista: Pregunta[] = []
      try { lista = JSON.parse(valor) as Pregunta[] } catch { lista = [] }
      const poner2 = (l: Pregunta[]) => poner(JSON.stringify(l))
      control = (
        <div className="space-y-3">
          {lista.map((p, i) => (
            <div key={p.id} className="space-y-2 rounded-lg border border-zr-border bg-zr-bg p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-zr-text-muted">Pregunta {i + 1}</span>
                <button
                  type="button"
                  onClick={() => poner2(lista.filter((_, j) => j !== i))}
                  className="text-xs font-bold text-zr-error"
                >
                  Quitar
                </button>
              </div>
              <textarea
                value={p.texto}
                rows={2}
                onChange={(e) => poner2(lista.map((q, j) => (j === i ? { ...q, texto: e.target.value } : q)))}
                className="w-full rounded-lg border border-zr-border bg-zr-surface px-3 py-2.5 text-sm text-zr-text outline-none focus:border-zr-blue"
              />
              <select
                value={p.tipo}
                onChange={(e) => poner2(lista.map((q, j) => (j === i ? { ...q, tipo: e.target.value } : q)))}
                className="min-h-11 w-full rounded-lg border border-zr-border bg-zr-surface px-3 text-sm text-zr-text"
              >
                <option value="escala_1_5">Se responde con una nota del 1 al 5</option>
                <option value="redaccion">Se responde escribiendo</option>
              </select>
            </div>
          ))}
          <button
            type="button"
            onClick={() => poner2([...lista, { id: `p_${Date.now()}`, tipo: 'escala_1_5', texto: '' }])}
            className="min-h-12 w-full rounded-lg border border-dashed border-zr-blue text-sm font-bold text-zr-blue"
          >
            + Agregar una pregunta
          </button>
        </div>
      )
    } else if (campo.tipo === 'textoLargo') {
      control = (
        <textarea
          value={valor}
          onChange={(e) => poner(e.target.value)}
          rows={12}
          className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-sm leading-relaxed text-zr-text outline-none focus:border-zr-blue"
        />
      )
    } else if (campo.tipo === 'hora') {
      control = <input type="time" value={valor} onChange={(e) => poner(e.target.value)} className={CONTROL} />
    } else if (campo.tipo === 'texto') {
      control = <input value={valor} onChange={(e) => poner(e.target.value)} className={CONTROL} />
    } else {
      control = (
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={valor}
            min={campo.min}
            max={campo.max}
            onChange={(e) => poner(e.target.value)}
            className={`${CONTROL} max-w-[10rem] tabular-nums`}
          />
          {campo.unidad && <span className="text-sm font-semibold text-zr-text-muted">{campo.unidad}</span>}
        </div>
      )
    }

    return (
      <div key={c.key} className="zr-card space-y-3 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-zr-text">{campo.titulo}</p>
            {campo.provisional && (
              <span className="rounded-full border border-zr-warning/40 bg-zr-warning/15 px-2 py-0.5 text-[10px] font-bold text-zr-warning">
                Por confirmar
              </span>
            )}
          </div>
          {campo.ayuda && <p className="mt-1 text-sm text-zr-text-muted">{campo.ayuda}</p>}
        </div>

        {control}

        {campo.tipo === 'version' && cambio && (
          <p className="rounded-lg border border-zr-warning/40 bg-zr-warning/10 p-3 text-xs text-zr-text">
            Al guardar, todos los usuarios tendrán que volver a aceptar los términos.
          </p>
        )}
        {error && <p className="text-sm font-medium text-zr-error">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => guardar(c)}
            disabled={!cambio || guardando === c.key}
            className="min-h-11 rounded-lg bg-zr-blue px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            {guardando === c.key ? 'Guardando…' : 'Guardar'}
          </button>
          {cambio && (
            <button
              onClick={() => setBorradores((b) => { const { [c.key]: _o, ...resto } = b; return resto })}
              className="text-sm font-semibold text-zr-text-muted"
            >
              Descartar
            </button>
          )}
          {guardado === c.key && <span className="text-sm font-bold text-zr-success">Guardado ✓</span>}
        </div>

        <details className="text-xs text-zr-text-muted">
          <summary className="cursor-pointer select-none">Detalles</summary>
          <p className="mt-1.5">
            {c.actualizadoPor ? `Último cambio: ${c.actualizadoPor}, ` : 'Último cambio: '}
            {new Date(c.updatedAt).toLocaleString('es-VE')}
          </p>
          <p className="mt-0.5">Nombre interno: <span className="font-mono">{c.key}</span> · {c.isPublic ? 'lo puede leer cualquier usuario' : 'solo lo lee el personal'}</p>
        </details>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-11 px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <BotonVolver href="/panel" />

      <Encabezado
        sobretitulo="Solo super admin"
        titulo="Configuración"
        descripcion="Las reglas de la academia: horarios, notas mínimas, tamaños y textos. Los cambios se aplican enseguida a toda la app."
      />

      <Regla delay={60} />

      <Seccion numero={1} titulo="Calendario de módulos" delay={100}>
        <CalendarioModulos />
      </Seccion>

      <Seccion numero={2} titulo="Reglas y textos" delay={120}>
        <div className="space-y-3">
          {porGrupo.map((g) => {
            const on = abierto === g.id
            return (
              <div key={g.id} className="overflow-hidden rounded-2xl border border-zr-border bg-zr-surface/40">
                <button
                  type="button"
                  onClick={() => setAbierto(on ? '' : g.id)}
                  aria-expanded={on}
                  className="flex min-h-16 w-full items-center justify-between gap-3 px-5 py-3 text-left"
                >
                  <span>
                    <span className="block text-base font-bold text-zr-text">{g.titulo}</span>
                    <span className="block text-xs text-zr-text-muted">{g.intro}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-zr-text-muted">
                    {g.campos.length}
                    <span className={`inline-block transition-transform ${on ? 'rotate-90' : ''}`}>›</span>
                  </span>
                </button>
                {on && <div className="grid gap-3 border-t border-zr-border p-4 lg:grid-cols-2">{g.campos.map(tarjeta)}</div>}
              </div>
            )
          })}
        </div>
      </Seccion>

      {historial.length > 0 && (
        <Seccion numero={3} titulo="Últimos cambios" delay={200}>
          <div className="zr-card divide-y divide-zr-border">
            {historial.map((h) => {
              const campo = CAMPOS[h.key]
              return (
                <div key={h.id} className="p-4">
                  <p className="text-sm font-semibold text-zr-text">
                    {campo?.titulo ?? config.find((c) => c.key === h.key)?.description ?? h.key}
                  </p>
                  <p className="mt-1 text-sm text-zr-text">
                    {resumenValor(campo, h.oldValue)} → {resumenValor(campo, h.newValue)}
                  </p>
                  <p className="mt-1 text-xs text-zr-text-muted">
                    {h.cambiadoPor ?? 'Sistema'} · {new Date(h.changedAt).toLocaleString('es-VE')}
                  </p>
                </div>
              )
            })}
          </div>
        </Seccion>
      )}
    </div>
  )
}
