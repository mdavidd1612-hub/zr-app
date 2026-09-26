'use client'

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
  estado: Estado
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
        .select('id, full_name, cedula, payment_status, cohorts(name)')
        .order('full_name')

      if (!vigente) return

      type Cruda = { id: string; full_name: string; cedula: string; payment_status: Estado; cohorts: { name: string } | null }
      setFilas(
        ((data ?? []) as unknown as Cruda[]).map((e) => ({
          studentId: e.id,
          nombre: e.full_name,
          cedula: e.cedula,
          cohorteNombre: e.cohorts?.name ?? null,
          estado: e.payment_status,
        })),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  async function cambiarEstado(studentId: string, estado: Estado) {
    setGuardandoId(studentId)
    setError(null)
    const supabase = createClient()
    const { error: fallo } = await supabase.from('students').update({ payment_status: estado }).eq('id', studentId)

    if (fallo) {
      setError(fallo.message)
      setGuardandoId(null)
      return
    }
    setFilas((fs) => fs.map((f) => f.studentId === studentId ? { ...f, estado } : f))
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
        descripcion="No Solvente bloquea el botón de tomar asistencia del estudiante."
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
                {filas.map((f) => (
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
                            onClick={() => cambiarEstado(f.studentId, estado)}
                            disabled={guardandoId === f.studentId}
                            className={`rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                              f.estado === estado ? ESTILO[estado] : 'bg-zr-bg text-zr-text-muted'
                            }`}
                          >
                            {ETIQUETA[estado]}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Teléfono: una tarjeta compacta por estudiante. */}
          <div className="space-y-2 lg:hidden">
            {filas.map((f) => (
              <div key={f.studentId} className="zr-card p-3">
                <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula} · {f.cohorteNombre ?? 'sin cohorte'}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(Object.keys(ETIQUETA) as Estado[]).map((estado) => (
                    <button
                      key={estado}
                      onClick={() => cambiarEstado(f.studentId, estado)}
                      disabled={guardandoId === f.studentId}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                        f.estado === estado ? ESTILO[estado] : 'bg-zr-bg text-zr-text-muted'
                      }`}
                    >
                      {ETIQUETA[estado]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
