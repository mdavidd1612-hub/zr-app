'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EtiquetaSede } from '@/components/ui/EtiquetaSede'

/**
 * R-20 y R-21 · docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md
 *
 * Ajuste hecho el 2 de septiembre de 2026 a pedido del cliente, después de
 * ver la primera versión de esta pantalla: para la academia, "programa" es
 * PTMA-2026-II — lo que el código llama `cohorts`. Esta pantalla mostraba
 * antes las dos entradas de currículo (PTMA/PFTA) con sus siglas como si
 * fueran "los programas", y eso confundía porque no son lo que el vendedor
 * ve ni inscribe. Ahora "Catálogo de programas" muestra TODOS los programas
 * reales (los mismos que /(vendedor)/programas, de solo lectura aquí), y lo
 * que antes se llamaba "crear programa" pasa a "Plan de estudio nuevo" —
 * una herramienta aparte, para el caso raro de sumar un currículo nuevo
 * (otro PTMA/PFTA), no para el día a día de abrir un corte.
 *
 * Las siglas siguen alimentando `set_student_code_calc()` (migración 067):
 * antes de esa migración, cualquier plan de estudio que no se llamara
 * "PTMA…" caía en silencio al prefijo "PFTA". La validación de aquí (3-5
 * letras mayúsculas, únicas) es la misma que exige la base.
 */

interface ProgramaReal {
  id: string
  name: string
  sede: string | null
  turno: string | null
  estado: 'activa' | 'finalizada' | 'suspendida'
}

interface PlanDeEstudio {
  id: string
  name: string
  siglas: string
  programas: ProgramaReal[]
}

interface Sede {
  id: string
  nombre: string
  activa: boolean
}

const SIGLAS_RX = /^[A-Z]{3,5}$/

export default function Catalogo() {
  const router = useRouter()
  const [esSuper, setEsSuper] = useState<boolean | null>(null)
  const [planes, setPlanes] = useState<PlanDeEstudio[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  const [creandoPlan, setCreandoPlan] = useState(false)
  const [nombrePlan, setNombrePlan] = useState('')
  const [siglas, setSiglas] = useState('')
  const [totalModulos, setTotalModulos] = useState('14')
  const [totalMeses, setTotalMeses] = useState('13')
  const [guardandoPlan, setGuardandoPlan] = useState(false)
  const [errorPlan, setErrorPlan] = useState<string | null>(null)
  const [avisoPlan, setAvisoPlan] = useState<string | null>(null)

  const [nombreSede, setNombreSede] = useState('')
  const [guardandoSede, setGuardandoSede] = useState(false)
  const [errorSede, setErrorSede] = useState<string | null>(null)

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

      const esSuperAdmin = perfil?.role === 'super_admin'
      setEsSuper(esSuperAdmin)
      if (!esSuperAdmin) {
        setCargando(false)
        return
      }

      const [{ data: progs }, { data: seds }] = await Promise.all([
        supabase
          .from('programs')
          .select('id, name, siglas, cohorts(id, name, sede, turno, status)')
          .order('name'),
        supabase.from('sedes').select('id, nombre, activa').order('nombre'),
      ])

      const filas = (progs ?? []) as unknown as {
        id: string; name: string; siglas: string
        cohorts: { id: string; name: string; sede: string | null; turno: string | null; status: 'activa' | 'finalizada' | 'suspendida' }[]
      }[]

      setPlanes(filas.map((p) => ({
        id: p.id,
        name: p.name,
        siglas: p.siglas,
        programas: [...p.cohorts]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({ id: c.id, name: c.name, sede: c.sede, turno: c.turno, estado: c.status })),
      })))
      setSedes(seds ?? [])
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  function mensajeDeError(codigo?: string, texto?: string) {
    if (codigo === '23505') return 'Ya existe un plan de estudio o una sede con ese nombre o esas siglas.'
    return texto ?? 'No se pudo guardar. Revisa tu conexión.'
  }

  async function crearPlan() {
    setGuardandoPlan(true); setErrorPlan(null); setAvisoPlan(null)

    const { error: fallo } = await createClient().from('programs').insert({
      name: nombrePlan.trim(),
      siglas: siglas.trim().toUpperCase(),
      total_modules: Number(totalModulos) || 14,
      total_duration_months: Number(totalMeses) || 13,
    })

    if (fallo) {
      setErrorPlan(mensajeDeError(fallo.code, fallo.message))
      setGuardandoPlan(false)
      return
    }

    setAvisoPlan(`Plan de estudio "${nombrePlan.trim()}" creado con siglas ${siglas.trim().toUpperCase()}.`)
    setNombrePlan(''); setSiglas(''); setTotalModulos('14'); setTotalMeses('13'); setCreandoPlan(false)
    setGuardandoPlan(false)
    setVersion((v) => v + 1)
  }

  async function crearSede() {
    setGuardandoSede(true); setErrorSede(null)

    const { error: fallo } = await createClient().from('sedes').insert({ nombre: nombreSede.trim() })

    if (fallo) {
      setErrorSede(mensajeDeError(fallo.code, fallo.message))
      setGuardandoSede(false)
      return
    }

    setNombreSede('')
    setGuardandoSede(false)
    setVersion((v) => v + 1)
  }

  async function alternarSede(s: Sede) {
    await createClient().from('sedes').update({ activa: !s.activa }).eq('id', s.id)
    setVersion((v) => v + 1)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  if (esSuper === false) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zr-bg px-5">
        <div className="zr-card max-w-sm p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Solo super_admin</p>
          <p className="mt-2 text-sm text-zr-text-muted">
            Un plan de estudio nuevo o una sede nueva cambian el código de carnet de toda la
            academia. Solo super_admin puede crearlos.
          </p>
        </div>
        <BotonVolver href="/panel" />
      </div>
    )
  }

  const siglasValidas = SIGLAS_RX.test(siglas.trim().toUpperCase())
  const planCompleto = Boolean(nombrePlan.trim() && siglasValidas)

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <BotonVolver href="/panel" />
      <Encabezado sobretitulo="Super admin" titulo="Catálogo de programas" descripcion="Todos los programas de la academia, con sus sedes" />
      <Regla delay={60} />

      {planes.map((plan, i) => (
        <Seccion key={plan.id} numero={i + 1} titulo={plan.name} delay={100 + i * 60}>
          <div className="space-y-3">
            {plan.programas.length === 0 && (
              <p className="zr-card p-5 text-sm text-zr-text-muted">Todavía no hay ningún programa de {plan.siglas}.</p>
            )}
            {plan.programas.map((p) => (
              <div key={p.id} className="zr-card flex items-center justify-between gap-4 p-5">
                <div className="min-w-0 space-y-2">
                  <p className="truncate text-sm font-semibold text-zr-text">{p.name}</p>
                  <EtiquetaSede sede={p.sede} turno={p.turno} />
                </div>
                {p.estado !== 'activa' && (
                  <span className="shrink-0 rounded-full border border-zr-border bg-zr-bg px-2.5 py-1 text-[11px] font-bold text-zr-text-muted">
                    {p.estado === 'finalizada' ? 'Terminado' : 'Suspendido'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Seccion>
      ))}

      <Seccion numero={planes.length + 1} titulo="Sedes" delay={100 + planes.length * 60}>
        <div className="space-y-3">
          {sedes.map((s) => (
            <div key={s.id} className="zr-card flex items-center justify-between gap-4 p-5">
              <p className="text-sm font-semibold text-zr-text">{s.nombre}</p>
              <button
                onClick={() => alternarSede(s)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${
                  s.activa
                    ? 'border-zr-success/40 bg-zr-success/15 text-zr-success'
                    : 'border-zr-border text-zr-text-muted'
                }`}
              >
                {s.activa ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          ))}

          <div className="zr-card space-y-4 p-5">
            <p className="text-sm font-bold text-zr-text">+ Nueva sede</p>
            <input
              value={nombreSede}
              onChange={(e) => setNombreSede(e.target.value)}
              placeholder="Nombre de la sede"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
            {errorSede && <p className="text-sm font-medium text-zr-error">{errorSede}</p>}
            <button
              onClick={crearSede}
              disabled={!nombreSede.trim() || guardandoSede}
              className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
            >
              {guardandoSede ? 'Creando…' : 'Crear sede'}
            </button>
          </div>
        </div>
      </Seccion>

      {/* Aparte, al final y sin protagonismo: crear un plan de estudio nuevo
          (otro PTMA/PFTA) es raro — casi nunca vas a necesitarlo, y no es lo
          mismo que abrir un corte nuevo de un plan que ya existe (eso se
          hace desde el perfil de ventas, en Programas). */}
      <Seccion numero={planes.length + 2} titulo="Plan de estudio nuevo" delay={100 + (planes.length + 1) * 60}>
        <p className="mb-3 px-1 text-xs text-zr-text-muted">
          Esto es distinto de abrir un programa nuevo de PTMA o PFTA — eso se hace desde el
          perfil de ventas. Usa esto solo si la academia va a dictar un currículo que no existe
          todavía.
        </p>

        {avisoPlan && (
          <p className="mb-3 rounded-lg border border-zr-success/30 bg-zr-success/12 px-4 py-3 text-sm font-medium text-zr-success">
            {avisoPlan}
          </p>
        )}

        {creandoPlan ? (
          <div className="zr-card space-y-4 p-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Nombre</label>
              <input
                value={nombrePlan}
                onChange={(e) => setNombrePlan(e.target.value)}
                placeholder="Programa Técnico en Refrigeración"
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Siglas</label>
              <input
                value={siglas}
                onChange={(e) => setSiglas(e.target.value.toUpperCase())}
                placeholder="PTRE"
                maxLength={5}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base uppercase text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-zr-text-muted">
                3 a 5 letras mayúsculas. Es el prefijo del carnet de sus estudiantes — no se
                puede cambiar después de que alguien se inscriba.
              </p>
              {siglas.trim() && !siglasValidas && (
                <p className="mt-1.5 text-xs text-zr-warning">Deben ser solo letras, 3 a 5.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-zr-text">Total de módulos</label>
                <input
                  type="number"
                  value={totalModulos}
                  onChange={(e) => setTotalModulos(e.target.value)}
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-zr-text">Duración (meses)</label>
                <input
                  type="number"
                  value={totalMeses}
                  onChange={(e) => setTotalMeses(e.target.value)}
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
                />
              </div>
            </div>
            {errorPlan && <p className="text-sm font-medium text-zr-error">{errorPlan}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setCreandoPlan(false)}
                className="min-h-14 flex-1 rounded-lg border border-zr-border text-base font-semibold text-zr-text"
              >
                Cancelar
              </button>
              <button
                onClick={crearPlan}
                disabled={!planCompleto || guardandoPlan}
                className="min-h-14 flex-1 rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
              >
                {guardandoPlan ? 'Creando…' : 'Crear plan de estudio'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreandoPlan(true)}
            className="zr-card zr-card-interactive flex min-h-14 w-full items-center justify-center px-6 text-sm font-bold text-zr-blue"
          >
            + Plan de estudio nuevo
          </button>
        )}
      </Seccion>
    </div>
  )
}
