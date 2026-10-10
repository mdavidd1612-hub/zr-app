'use client'

import { Select } from '@/components/ui/Select'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Finanzas -- excepción explícita de Fase 1, aprobada directamente por el
 * coordinador (sept. 2026), mismo mecanismo que ZR Coffee (migración 090).
 * Rehecho (corrección del coordinador sobre la primera versión): un único
 * estado de solvencia por estudiante, tres valores -- solvente,
 * solvente_pendiente, no_solvente (migración 115). Tabla compacta tipo
 * Excel, mismo patrón que /asistencias.
 *
 * 'no_solvente' bloquea el botón de tomar asistencia del estudiante -- el
 * bloqueo real vive en el servidor (checkin-session/validate-scan), esta
 * pantalla solo cambia el estado.
 *
 * Solo admin y super_admin -- Dirección Académica no entra aquí. La
 * restricción real vive en un trigger (migración 115), no solo aquí.
 */

type Estado = 'solvente' | 'solvente_pendiente' | 'no_solvente'

interface FilaEstudiante {
  studentId: string
  nombre: string
  cedula: string
  cohorteNombre: string | null
  programa: string | null
  modulo: string | null
  estado: Estado
  /** Último día del plazo (solo en 'solvente_pendiente'). */
  hasta: string | null
}

const ETIQUETA: Record<Estado, string> = {
  solvente: 'Solvente',
  solvente_pendiente: 'Solvente (PENDIENTE)',
  no_solvente: 'No Solvente',
}

const ESTILO: Record<Estado, string> = {
  solvente: 'bg-zr-success/12 text-zr-success',
  solvente_pendiente: 'bg-zr-warning/12 text-zr-warning',
  no_solvente: 'bg-zr-error/12 text-zr-error',
}

export default function Finanzas() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [filas, setFilas] = useState<FilaEstudiante[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Buscador y filtros: nombre/cédula, programa y estado. Sin módulo: todos
  // los estudiantes cursan el mismo programa y no aporta nada (pedido del
  // coordinador, oct. 2026).
  const [busqueda, setBusqueda] = useState('')
  const [filtroPrograma, setFiltroPrograma] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'' | Estado>('')

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!vigente) return

      if (perfil?.role !== 'admin' && perfil?.role !== 'super_admin') {
        setAutorizado(false)
        return
      }
      setAutorizado(true)

      const { data } = await supabase
        .from('v_students')
        .select('id, full_name, cedula, payment_status, payment_pending_until, cohorts(name, modules(name, programs(name)))')
        .order('full_name')

      if (!vigente) return

      type Cruda = { id: string; full_name: string; cedula: string; payment_status: Estado; payment_pending_until: string | null; cohorts: { name: string; modules: { name: string; programs: { name: string } | null } | null } | null }
      setFilas(
        ((data ?? []) as unknown as Cruda[]).map((e) => ({
          studentId: e.id,
          nombre: e.full_name,
          cedula: e.cedula,
          cohorteNombre: e.cohorts?.name ?? null,
          programa: e.cohorts?.modules?.programs?.name ?? e.cohorts?.name ?? null,
          modulo: e.cohorts?.modules?.name ?? null,
          estado: e.payment_status,
          hasta: e.payment_pending_until,
        })),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  // "Solvente (PENDIENTE)" pide hasta cuándo (por defecto el próximo sábado).
  // Pasada esa fecha sin confirmar, la base lo pasa sola a "No solvente"
  // (migración 142).
  const [plazo, setPlazo] = useState<{ studentId: string; nombre: string; fecha: string } | null>(null)

  function proximoSabadoISO(): string {
    const d = new Date()
    const dias = d.getDay() === 6 ? 7 : 6 - d.getDay()
    d.setDate(d.getDate() + dias)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function elegirEstado(f: FilaEstudiante, estado: Estado) {
    if (estado === 'solvente_pendiente') {
      setPlazo({ studentId: f.studentId, nombre: f.nombre, fecha: f.hasta ?? proximoSabadoISO() })
    } else {
      void cambiarEstado(f.studentId, estado)
    }
  }

  function textoFecha(iso: string): string {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  async function cambiarEstado(studentId: string, estado: Estado, hasta?: string) {
    setGuardandoId(studentId)
    setError(null)
    const supabase = createClient()
    const { error: fallo } = await supabase
      .from('students')
      .update(estado === 'solvente_pendiente' ? { payment_status: estado, payment_pending_until: hasta ?? null } : { payment_status: estado })
      .eq('id', studentId)

    if (fallo) {
      setError(fallo.message)
      setGuardandoId(null)
      return
    }
    setFilas((fs) => fs.map((f) => f.studentId === studentId ? { ...f, estado, hasta: estado === 'solvente_pendiente' ? (hasta ?? null) : null } : f))
    setGuardandoId(null)
  }

  if (autorizado === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg px-5 text-center">
        <p className="text-sm text-zr-text-muted">Esta pantalla es solo para Administración.</p>
      </div>
    )
  }

  const q = busqueda.trim().toLowerCase()
  const programas = [...new Set(filas.map((f) => f.programa).filter((x): x is string => !!x))].sort()
  const visibles = filas.filter((f) =>
    (!q || `${f.nombre} ${f.cedula}`.toLowerCase().includes(q))
    && (!filtroPrograma || f.programa === filtroPrograma)
    && (!filtroEstado || f.estado === filtroEstado),
  )

  if (cargando || autorizado === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-5 pt-14 pb-10">
      <BotonVolver href="/panel" />

      <Encabezado
        sobretitulo="Administración"
        titulo="Finanzas"
        descripcion="No Solvente bloquea la asistencia y el Material del estudiante. Solvente (PENDIENTE) le recuerda cada día que sigue atrasado."
      />
      <Regla delay={60} />

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {filas.length === 0 ? (
        <EstadoVacio titulo="Sin estudiantes" explicacion="Todavía no hay estudiantes registrados." />
      ) : (
        <>
          <div className="space-y-3">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o cédula"
              className="w-full rounded-lg border border-zr-border bg-zr-surface px-4 py-3 text-sm text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Select
                value={filtroPrograma}
                onChange={(e) => setFiltroPrograma(e.target.value)}
                className="rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
              >
                <option value="">Todos los programas</option>
                {programas.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
              <Select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as '' | Estado)}
                className="rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
              >
                <option value="">Todos los estados</option>
                {(Object.keys(ETIQUETA) as Estado[]).map((e) => <option key={e} value={e}>{ETIQUETA[e]}</option>)}
              </Select>
            </div>
            <p className="text-xs text-zr-text-muted">{visibles.length} de {filas.length} estudiantes</p>
          </div>

          {/* Computadora: tabla compacta tipo Excel, mismo patrón que /asistencias. */}
          <div className="hidden overflow-x-auto rounded-lg border border-zr-border lg:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-zr-surface">
                  <th className="sticky left-0 z-10 min-w-[220px] border-b border-r border-zr-border bg-zr-surface px-4 py-3 text-left font-bold text-zr-text">
                    Estudiante
                  </th>
                  <th className="min-w-[260px] border-b border-zr-border px-3 py-3 text-left font-bold text-zr-text-muted">
                    Estado de solvencia
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.studentId} className="border-b border-zr-border last:border-b-0">
                    <td className="sticky left-0 z-10 border-r border-zr-border bg-zr-surface px-4 py-2.5">
                      <p className="truncate font-semibold text-zr-text">{f.nombre}</p>
                      <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula} · {f.cohorteNombre ?? 'sin cohorte'}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1.5">
                        {(Object.keys(ETIQUETA) as Estado[]).map((estado) => (
                          <button
                            key={estado}
                            onClick={() => elegirEstado(f, estado)}
                            disabled={guardandoId === f.studentId}
                            className={`rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                              f.estado === estado ? ESTILO[estado] : 'bg-zr-bg text-zr-text-muted'
                            }`}
                          >
                            {ETIQUETA[estado]}
                          </button>
                        ))}
                      </div>
                      {f.estado === 'solvente_pendiente' && f.hasta && (
                        <p className="mt-1 text-xs font-semibold text-zr-warning">Hasta el {textoFecha(f.hasta)}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Teléfono: una tarjeta compacta por estudiante. */}
          <div className="space-y-2 lg:hidden">
            {visibles.map((f) => (
              <div key={f.studentId} className="zr-card p-3">
                <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula} · {f.cohorteNombre ?? 'sin cohorte'}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(Object.keys(ETIQUETA) as Estado[]).map((estado) => (
                    <button
                      key={estado}
                      onClick={() => elegirEstado(f, estado)}
                      disabled={guardandoId === f.studentId}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                        f.estado === estado ? ESTILO[estado] : 'bg-zr-bg text-zr-text-muted'
                      }`}
                    >
                      {ETIQUETA[estado]}
                    </button>
                  ))}
                </div>
                {f.estado === 'solvente_pendiente' && f.hasta && (
                  <p className="mt-1.5 text-xs font-semibold text-zr-warning">Hasta el {textoFecha(f.hasta)}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {plazo && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 backdrop-blur-md sm:items-center sm:p-5"
          onClick={() => setPlazo(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-t-2xl border border-white/15 bg-zr-surface/85 p-6 pb-8 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:rounded-2xl sm:pb-6"
          >
            <div>
              <p className="zr-display text-xl text-zr-text">Solvente (PENDIENTE)</p>
              <p className="mt-1 text-sm text-zr-text-muted">{plazo.nombre}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-zr-text-muted">¿Hasta cuándo tiene chance?</label>
              <input
                type="date"
                value={plazo.fecha}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setPlazo({ ...plazo, fecha: e.target.value })}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-3 py-3 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              />
              <p className="mt-2 text-xs text-zr-text-muted">
                Si pasa ese día y no se confirma el pago, pasa solo a &ldquo;No Solvente&rdquo; y queda bloqueado.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPlazo(null)}
                className="min-h-12 flex-1 rounded-lg border border-zr-border text-sm font-bold text-zr-text"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const { studentId, fecha } = plazo
                  setPlazo(null)
                  void cambiarEstado(studentId, 'solvente_pendiente', fecha)
                }}
                disabled={!plazo.fecha}
                className="min-h-12 flex-1 rounded-lg bg-zr-warning text-sm font-bold text-zr-bg disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
