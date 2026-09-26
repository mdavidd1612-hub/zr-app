'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Finanzas -- EXCEPCIÓN explícita de Fase 1, aprobada directamente por el
 * coordinador (sept. 2026), mismo mecanismo que ZR Coffee (migración 090).
 * Deliberadamente muy básico: solo inscripción y la mensualidad del módulo
 * actual, pagado/pendiente, con el monto que la administradora anote --
 * los montos oficiales todavía no están decididos ("eso lo dejamos al
 * final"), así que nunca se asume un número aquí (regla 5 de AGENTS.md).
 *
 * Esto NO es el módulo de financiamiento completo -- ese ya existe diseñado
 * y confirmado en docs/02_MODULO_FINANCIAMIENTO.md (estilo Cashea) y sigue
 * siendo la versión real de Fase 2.
 *
 * Solo admin y super_admin -- Dirección Académica no entra aquí (pedido
 * explícito, distinto del resto de las pantallas de esta app).
 */

interface Pago {
  id: string | null
  status: 'pagado' | 'pendiente'
  amount: number | null
  paidAt: string | null
}

interface FilaEstudiante {
  studentId: string
  nombre: string
  cedula: string
  moduleId: string | null
  moduloNombre: string | null
  inscripcion: Pago
  mensualidad: Pago
}

const PAGO_VACIO: Pago = { id: null, status: 'pendiente', amount: null, paidAt: null }

export default function Finanzas() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [filas, setFilas] = useState<FilaEstudiante[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [montoBorrador, setMontoBorrador] = useState<Record<string, string>>({})

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

      const { data: estudiantes } = await supabase
        .from('v_students')
        .select('id, full_name, cedula, cohort_id, cohorts(current_module_id, modules(name))')
        .order('full_name')

      if (!vigente) return

      type EstudianteCrudo = {
        id: string; full_name: string; cedula: string; cohort_id: string | null
        cohorts: { current_module_id: string | null; modules: { name: string } | null } | null
      }
      const estudiantesCrudos = (estudiantes ?? []) as unknown as EstudianteCrudo[]

      const { data: pagos } = await supabase
        .from('student_payments')
        .select('id, student_id, concept, module_id, status, amount, paid_at')
        .in('student_id', estudiantesCrudos.map((e) => e.id))

      if (!vigente) return

      type PagoCrudo = {
        id: string; student_id: string; concept: string; module_id: string | null
        status: 'pagado' | 'pendiente'; amount: number | null; paid_at: string | null
      }
      const pagosCrudos = (pagos ?? []) as PagoCrudo[]

      setFilas(
        estudiantesCrudos.map((e) => {
          const moduleId = e.cohorts?.current_module_id ?? null
          const inscripcionRow = pagosCrudos.find((p) => p.student_id === e.id && p.concept === 'inscripcion')
          const mensualidadRow = pagosCrudos.find((p) => p.student_id === e.id && p.concept === 'mensualidad' && p.module_id === moduleId)

          return {
            studentId: e.id,
            nombre: e.full_name,
            cedula: e.cedula,
            moduleId,
            moduloNombre: e.cohorts?.modules?.name ?? null,
            inscripcion: inscripcionRow
              ? { id: inscripcionRow.id, status: inscripcionRow.status, amount: inscripcionRow.amount, paidAt: inscripcionRow.paid_at }
              : PAGO_VACIO,
            mensualidad: mensualidadRow
              ? { id: mensualidadRow.id, status: mensualidadRow.status, amount: mensualidadRow.amount, paidAt: mensualidadRow.paid_at }
              : PAGO_VACIO,
          }
        }),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  async function marcarPago(
    fila: FilaEstudiante,
    concept: 'inscripcion' | 'mensualidad',
    nuevoEstado: 'pagado' | 'pendiente',
  ) {
    const clave = `${fila.studentId}-${concept}`
    const montoTexto = montoBorrador[clave]
    const monto = montoTexto ? parseFloat(montoTexto) : (concept === 'inscripcion' ? fila.inscripcion.amount : fila.mensualidad.amount)

    setGuardandoId(clave)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error: fallo } = await supabase
      .from('student_payments')
      .upsert(
        {
          student_id: fila.studentId,
          concept,
          module_id: concept === 'mensualidad' ? fila.moduleId : null,
          status: nuevoEstado,
          amount: monto,
          paid_at: nuevoEstado === 'pagado' ? new Date().toISOString().slice(0, 10) : null,
          registered_by: user?.id,
        },
        { onConflict: concept === 'inscripcion' ? 'student_id' : 'student_id,module_id' },
      )
      .select('id, status, amount, paid_at')
      .single()

    if (fallo) {
      setError(fallo.message)
      setGuardandoId(null)
      return
    }

    setFilas((fs) => fs.map((f) => f.studentId === fila.studentId
      ? {
          ...f,
          [concept]: { id: data.id, status: data.status, amount: data.amount, paidAt: data.paid_at },
        }
      : f))
    setGuardandoId(null)
  }

  if (autorizado === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg px-5 text-center">
        <p className="text-sm text-zr-text-muted">Esta pantalla es solo para Administración.</p>
      </div>
    )
  }

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
        descripcion="Inscripción y mensualidad del módulo actual. Los montos todavía no están decididos oficialmente — anótalos caso por caso."
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
        <div className="space-y-3">
          {filas.map((f) => (
            <div key={f.studentId} className="zr-card space-y-4 p-5">
              <div>
                <p className="text-base font-semibold text-zr-text">{f.nombre}</p>
                <p className="text-sm tabular-nums text-zr-text-muted">{f.cedula}</p>
              </div>

              {([
                ['inscripcion', 'Inscripción', f.inscripcion] as const,
                ...(f.moduleId ? [['mensualidad', `Mensualidad — ${f.moduloNombre ?? 'módulo actual'}`, f.mensualidad] as const] : []),
              ]).map(([concept, etiqueta, pago]) => {
                const clave = `${f.studentId}-${concept}`
                return (
                  <div key={concept} className="rounded-lg border border-zr-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zr-text">{etiqueta}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          pago.status === 'pagado'
                            ? 'bg-zr-success/12 text-zr-success'
                            : 'bg-zr-warning/12 text-zr-warning'
                        }`}
                      >
                        {pago.status === 'pagado' ? 'Pagado' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Monto ($)"
                        defaultValue={pago.amount ?? ''}
                        onChange={(e) => setMontoBorrador((m) => ({ ...m, [clave]: e.target.value }))}
                        className="w-28 rounded-lg border border-zr-border bg-zr-bg px-2 py-1.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
                      />
                      <button
                        onClick={() => marcarPago(f, concept, pago.status === 'pagado' ? 'pendiente' : 'pagado')}
                        disabled={guardandoId === clave}
                        className="rounded-lg border border-zr-blue/40 px-3 py-1.5 text-xs font-bold text-zr-blue-mid disabled:opacity-50"
                      >
                        {guardandoId === clave ? '…' : pago.status === 'pagado' ? 'Marcar pendiente' : 'Marcar pagado'}
                      </button>
                      {pago.paidAt && <span className="text-xs text-zr-text-muted">{pago.paidAt}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
