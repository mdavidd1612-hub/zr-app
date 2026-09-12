'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Dato, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { ordenarCohortesPorPrioridad } from '@/lib/cohortes'

/**
 * Estadísticas de estudiantes — pedido explícito del coordinador (sept.
 * 2026), exclusivo de super_admin. Después de los bugs de onboarding
 * atascado en algunos Android (scroll que no bajaba), hacía falta una forma
 * de ver, estudiante por estudiante, quién de verdad pudo entrar y llenar
 * su formulario y quién se quedó a medias — sin tener que revisar cuenta
 * por cuenta.
 *
 * No hay una sola columna "fase" en la base: se arma cruzando tres señales
 * (docs de la migración correspondiente a cada una):
 * - `terms_acceptances` contra `system_config.terms.version` — ¿aceptó los
 *   términos vigentes?
 * - `students.onboarding_status` (vía `v_students`, migración 047) —
 *   'completo' solo cuando ya existe su fila en `student_profile_details`
 *   (el formulario de /completar-perfil).
 * - `profiles.status` (vía `v_students.status`) — activo o suspendido.
 *
 * Con eso se arma una fase por estudiante: sin aceptar términos, en el
 * formulario, o completo. "Validado" (planilla firmada en persona) es un
 * concepto aparte y no se mezcla aquí — esta pantalla es sobre el flujo
 * digital, que es lo que se rompió con el bug de Android.
 */

type Fase = 'sin_terminos' | 'formulario_pendiente' | 'completo'

interface EstudianteFase {
  id: string
  nombre: string
  cedula: string
  cohorte: string | null
  cohorteId: string | null
  suspendido: boolean
  fase: Fase
}

interface GrupoCohorte {
  cohorteId: string | null
  cohorte: string | null
  estudiantes: EstudianteFase[]
}

function agruparPorCohorte(estudiantes: EstudianteFase[]): GrupoCohorte[] {
  const mapa = new Map<string, GrupoCohorte>()
  for (const e of estudiantes) {
    const clave = e.cohorteId ?? 'sin-programa'
    const grupo = mapa.get(clave)
    if (grupo) grupo.estudiantes.push(e)
    else mapa.set(clave, { cohorteId: e.cohorteId, cohorte: e.cohorte, estudiantes: [e] })
  }
  const grupos = [...mapa.values()]
  const conCohorte = ordenarCohortesPorPrioridad(
    grupos
      .filter((g): g is GrupoCohorte & { cohorte: string } => g.cohorte !== null)
      .map((g) => ({ ...g, name: g.cohorte })),
  )
  const sinCohorte = grupos.filter((g) => g.cohorte === null)
  return [...conCohorte, ...sinCohorte]
}

const ETIQUETA_FASE: Record<Fase, { texto: string; tono: 'exito' | 'aviso' | 'error' }> = {
  sin_terminos: { texto: 'No ha aceptado los términos', tono: 'error' },
  formulario_pendiente: { texto: 'Sigue en el formulario', tono: 'aviso' },
  completo: { texto: 'Ya completó el formulario', tono: 'exito' },
}

const FILTROS: { valor: Fase | 'todos'; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'sin_terminos', texto: 'Sin aceptar términos' },
  { valor: 'formulario_pendiente', texto: 'En el formulario' },
  { valor: 'completo', texto: 'Completos' },
]

export default function EstadisticasEstudiantes() {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [estudiantes, setEstudiantes] = useState<EstudianteFase[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Fase | 'todos'>('todos')

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
      if (perfil?.role !== 'super_admin') {
        router.replace('/panel')
        return
      }
      setVerificando(false)

      const [{ data: alumnos }, { data: versionCfg }] = await Promise.all([
        supabase
          .from('v_students')
          .select('id, full_name, cedula, cohort_id, status, onboarding_status, cohorts(name)')
          .order('cohort_id', { nullsFirst: false })
          .order('full_name'),
        supabase.from('system_config').select('value').eq('key', 'terms.version').maybeSingle(),
      ])

      if (!vigente) return

      const versionVigente = Number(versionCfg?.value ?? 1)

      const filas = (alumnos ?? []) as unknown as {
        id: string; full_name: string; cedula: string; cohort_id: string | null
        status: string; onboarding_status: string; cohorts: { name: string } | null
      }[]

      const { data: aceptaciones } = await supabase
        .from('terms_acceptances')
        .select('user_id')
        .eq('terms_version', versionVigente)
        .in('user_id', filas.map((f) => f.id))

      if (!vigente) return

      const aceptaron = new Set((aceptaciones ?? []).map((a) => a.user_id))

      setEstudiantes(
        filas.map((f) => {
          const fase: Fase = !aceptaron.has(f.id)
            ? 'sin_terminos'
            : f.onboarding_status !== 'completo'
              ? 'formulario_pendiente'
              : 'completo'
          return {
            id: f.id,
            nombre: f.full_name,
            cedula: f.cedula,
            cohorte: f.cohorts?.name ?? null,
            cohorteId: f.cohort_id,
            suspendido: f.status === 'suspendido',
            fase,
          }
        }),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  if (verificando || cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando estadísticas…</p>
      </div>
    )
  }

  const total = estudiantes.length
  const completos = estudiantes.filter((e) => e.fase === 'completo').length
  const enFormulario = estudiantes.filter((e) => e.fase === 'formulario_pendiente').length
  const sinTerminos = estudiantes.filter((e) => e.fase === 'sin_terminos').length
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  const texto = busqueda.trim().toLowerCase()
  const filtrados = estudiantes.filter((e) => {
    if (texto && !e.nombre.toLowerCase().includes(texto) && !e.cedula.toLowerCase().includes(texto)) {
      return false
    }
    if (filtro !== 'todos') return e.fase === filtro
    return true
  })

  return (
    <div className="space-y-11 px-5 pt-14 pb-16">
      <BotonVolver href="/estudiantes" />

      <Encabezado
        sobretitulo="Super admin"
        titulo="Estadísticas de estudiantes"
        descripcion="Quién ya aceptó los términos y completó su formulario, y quién sigue a medias."
      />

      <Regla delay={60} />

      <Seccion numero={1} titulo="Resumen" delay={100}>
        <div className="grid grid-cols-2 gap-3">
          <Dato valor={total} etiqueta="Estudiantes" tono="neutro" />
          <Dato valor={`${pct(completos)}%`} etiqueta={`Completaron (${completos})`} tono="exito" />
          <Dato valor={enFormulario} etiqueta="Siguen en el formulario" tono="medio" />
          <Dato valor={sinTerminos} etiqueta="Sin aceptar términos" tono="error" />
        </div>
      </Seccion>

      <Seccion numero={2} titulo="Estudiante por estudiante" delay={160}>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o cédula…"
          className="w-full rounded-lg border border-zr-border bg-zr-surface px-5 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
        />

        <div className="flex gap-2 overflow-x-auto pb-1 zr-scroll-x">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                filtro === f.valor
                  ? 'border-zr-blue bg-zr-blue/15 text-zr-blue'
                  : 'border-zr-border text-zr-text-muted'
              }`}
            >
              {f.texto}
            </button>
          ))}
        </div>

        {filtrados.length === 0 ? (
          <EstadoVacio
            titulo="Sin resultados"
            explicacion="Ningún estudiante coincide con la búsqueda o el filtro."
          />
        ) : (
          <div className="space-y-8">
            {agruparPorCohorte(filtrados).map((grupo) => (
              <div key={grupo.cohorteId ?? 'sin-programa'}>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-zr-blue-mid">
                  {grupo.cohorte ?? 'Sin programa'}
                </p>
                <div className="space-y-3">
                  {grupo.estudiantes.map((e) => (
                    <div key={e.id} className="zr-card flex items-center justify-between gap-3 p-5">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-zr-text">{e.nombre}</p>
                        <p className="mt-1 text-sm tabular-nums text-zr-text-muted">{e.cedula}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <Etiqueta tono={ETIQUETA_FASE[e.fase].tono}>{ETIQUETA_FASE[e.fase].texto}</Etiqueta>
                        {e.suspendido && <Etiqueta tono="error">Suspendido</Etiqueta>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Seccion>
    </div>
  )
}
