'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

/**
 * Antes de entrar a una sección, el profesor elige DÓNDE está trabajando:
 *   1. el programa (cohorte), solo si da clase en más de uno;
 *   2. el módulo, solo si en ese programa tiene más de uno.
 * Con un solo programa y un solo módulo entra directo. Los módulos de otro
 * programa nunca aparecen mezclados: la lista de módulos depende del programa
 * elegido. La elección se recuerda para las demás secciones.
 *
 * Los módulos que no están vigentes (ya cursados o que aún no empiezan) se
 * pueden elegir, pero la sección debe mostrarlos bloqueados con
 * <AvisoModuloBloqueado />.
 */

export type EstadoModulo = 'sin_calendario' | 'no_empezo' | 'en_curso' | 'terminado'

export interface ContextoSel {
  cohortId: string
  moduleId: string
  programaNombre: string
  cohorteNombre: string
  sede: string | null
  moduloNombre: string
  moduloOrden: number
  estado: EstadoModulo
}

export function moduloVigente(estado: EstadoModulo): boolean {
  return estado === 'en_curso' || estado === 'sin_calendario'
}

export function AvisoModuloBloqueado({ estado }: { estado: EstadoModulo }) {
  if (moduloVigente(estado)) return null
  return (
    <div className="zr-card flex items-start gap-3 border-zr-border p-5">
      <span aria-hidden className="text-lg">🔒</span>
      <div>
        <p className="text-base font-semibold text-zr-text">
          {estado === 'terminado' ? 'Este módulo ya se cursó' : 'Este módulo aún no empieza'}
        </p>
        <p className="mt-1 text-sm text-zr-text-muted">
          {estado === 'terminado'
            ? 'Ya terminó: queda disponible solo para consulta.'
            : 'Se habilita solo cuando llegue su fecha en el calendario.'}
        </p>
      </div>
    </div>
  )
}


interface Props {
  sobretitulo: string
  titulo: string
  volverHref?: string
  /** 'programa': solo se elige el programa (para secciones que no dependen del módulo). */
  nivel?: 'modulo' | 'programa'
  children: (c: ContextoSel) => React.ReactNode
}

const ETIQUETA_ESTADO: Record<EstadoModulo, string | null> = {
  sin_calendario: null,
  en_curso: null,
  no_empezo: 'Aún no empieza',
  terminado: 'Ya se cursó',
}

export function ContextoDocente({ sobretitulo, titulo, volverHref = '/hoy', nivel = 'modulo', children }: Props) {
  const router = useRouter()
  const [opciones, setOpciones] = useState<ContextoSel[] | null>(null)
  const [cohortId, setCohortId] = useState<string | null>(null)
  const [moduleId, setModuleId] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: pares } = await supabase.rpc('mis_asignaciones_docente')
      const asignados = (pares ?? []) as unknown as { cohort_id: string; module_id: string }[]
      const idsMod = [...new Set(asignados.map((p) => p.module_id))]
      const idsCoh = [...new Set(asignados.map((p) => p.cohort_id))]
      const [estados, { data: mods }, { data: cohs }] = await Promise.all([
        Promise.all(asignados.map((p) => supabase.rpc('estado_modulo_cohorte', { p_cohort: p.cohort_id, p_module: p.module_id }))),
        idsMod.length ? supabase.from('modules').select('id, name, order_index').in('id', idsMod) : Promise.resolve({ data: [] }),
        idsCoh.length ? supabase.from('cohorts').select('id, name, sede, programs(name)').in('id', idsCoh) : Promise.resolve({ data: [] }),
      ])
      if (!vigente) return

      const modPor = new Map(((mods ?? []) as unknown as { id: string; name: string; order_index: number }[]).map((m) => [m.id, m]))
      const cohPor = new Map(
        ((cohs ?? []) as unknown as { id: string; name: string; sede: string | null; programs: { name: string } | null }[]).map((c) => [c.id, c]),
      )
      const lista: ContextoSel[] = asignados
        .map((p, i) => {
          const m = modPor.get(p.module_id)
          const c = cohPor.get(p.cohort_id)
          if (!m || !c) return null
          return {
            cohortId: p.cohort_id,
            moduleId: p.module_id,
            programaNombre: c.programs?.name ?? '',
            cohorteNombre: c.name,
            sede: c.sede,
            moduloNombre: m.name,
            moduloOrden: m.order_index,
            estado: ((estados[i].data as EstadoModulo | null) ?? 'sin_calendario') as EstadoModulo,
          }
        })
        .filter((x): x is ContextoSel => x !== null)
        .sort((a, b) => a.cohorteNombre.localeCompare(b.cohorteNombre) || a.moduloOrden - b.moduloOrden)

      setOpciones(lista)
    }
    cargar()
    return () => { vigente = false }
  }, [router, nivel])

  const programas = useMemo(() => {
    const vistos = new Map<string, ContextoSel>()
    for (const o of opciones ?? []) if (!vistos.has(o.cohortId)) vistos.set(o.cohortId, o)
    return [...vistos.values()]
  }, [opciones])

  if (opciones === null) return <PantallaEsqueleto />

  if (opciones.length === 0) {
    return (
      <div className="space-y-6 px-5 pb-10 pt-14">
        <BotonVolver href={volverHref} />
        <EstadoVacio titulo="Sin programa asignado" explicacion="Dirección Académica es quien te asigna los programas y módulos." />
      </div>
    )
  }

  // Elección automática cuando no hay nada que elegir.
  const programaUnico = programas.length === 1 ? programas[0].cohortId : null
  const cohortEfectivo = cohortId ?? programaUnico
  const delPrograma = opciones.filter((o) => o.cohortId === cohortEfectivo)
  const moduloUnico = cohortEfectivo && delPrograma.length === 1 ? delPrograma[0].moduleId : null
  const moduloEfectivo = nivel === 'programa' ? delPrograma[0]?.moduleId ?? null : moduleId ?? moduloUnico
  const seleccion = cohortEfectivo && moduloEfectivo
    ? opciones.find((o) => o.cohortId === cohortEfectivo && o.moduleId === moduloEfectivo) ?? null
    : null

  const hayQueElegir = opciones.length > 1 && !(nivel === 'programa' && programas.length === 1)

  function cambiar() {
    setCohortId(null)
    setModuleId(null)
  }

  // ── Ya hay selección: la sección + una franja para cambiar ──
  if (seleccion) {
    return (
      <>
        {hayQueElegir && (
          <div className="flex items-center justify-between gap-3 border-b border-zr-border bg-zr-surface px-5 pb-3 pt-12">
            <p className="min-w-0 truncate text-xs font-semibold text-zr-text-muted">
              {seleccion.cohorteNombre}{seleccion.sede ? ` · ${seleccion.sede}` : ''}
              {nivel === 'modulo' ? ` · Módulo ${seleccion.moduloOrden} · ${seleccion.moduloNombre}` : ''}
            </p>
            <button onClick={cambiar} className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-zr-blue-mid">
              Cambiar
            </button>
          </div>
        )}
        {children(seleccion)}
      </>
    )
  }

  // ── Paso 1: programa (solo si hay más de uno) ──
  if (!cohortEfectivo) {
    return (
      <div className="space-y-6 px-5 pb-10 pt-14">
        <BotonVolver href={volverHref} />
        <header>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">{sobretitulo}</p>
          <h1 className="zr-display mt-3 text-3xl text-zr-text">{titulo}</h1>
          <p className="mt-2 text-sm text-zr-text-muted">¿En qué programa quieres trabajar?</p>
        </header>
        <div className="space-y-3">
          {programas.map((p) => {
            const cuantos = opciones.filter((o) => o.cohortId === p.cohortId).length
            return (
              <button
                key={p.cohortId}
                onClick={() => {
                  setCohortId(p.cohortId)
                }}
                className="zr-card zr-card-interactive flex w-full items-center justify-between gap-3 p-5 text-left"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-zr-text">{p.cohorteNombre}</p>
                  <p className="mt-0.5 text-sm text-zr-text-muted">
                    {[p.programaNombre, p.sede].filter(Boolean).join(' · ')}
                    {nivel === 'modulo' ? ` · ${cuantos} módulo${cuantos === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-zr-text-muted">›</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Paso 2: módulo, solo de ESE programa ──
  return (
    <div className="space-y-6 px-5 pb-10 pt-14">
      {programas.length > 1 ? (
        <button
          onClick={cambiar}
          className="-ml-1 flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-zr-text-muted active:text-zr-text"
        >
          ‹ Elegir otro programa
        </button>
      ) : (
        <BotonVolver href={volverHref} />
      )}
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">{sobretitulo}</p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">{titulo}</h1>
        <p className="mt-2 text-sm text-zr-text-muted">
          {delPrograma[0].cohorteNombre}{delPrograma[0].sede ? ` · ${delPrograma[0].sede}` : ''} — ¿qué módulo quieres revisar?
        </p>
      </header>
      <div className="space-y-3">
        {delPrograma.map((o) => (
          <button
            key={o.moduleId}
            onClick={() => {
              setModuleId(o.moduleId)
            }}
            className="zr-card zr-card-interactive flex w-full items-center justify-between gap-3 p-5 text-left"
          >
            <div className="min-w-0">
              <p className="text-base font-semibold text-zr-text">Módulo {o.moduloOrden} · {o.moduloNombre}</p>
              {ETIQUETA_ESTADO[o.estado] && (
                <p className="mt-0.5 text-sm text-zr-text-muted">🔒 {ETIQUETA_ESTADO[o.estado]}</p>
              )}
            </div>
            <span className="shrink-0 text-zr-text-muted">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
