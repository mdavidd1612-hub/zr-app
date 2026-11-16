'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

// Gestión de exámenes para Dirección Académica y super_admin: de todos los
// profesores, con módulo, quién lo creó, tipo, preguntas, fechas e intentos.
// Desde aquí abren cada examen para verlo, editarlo o revisar resultados.

interface Examen {
  id: string
  titulo: string
  moduloNombre: string | null
  cohorteNombre: string | null
  profesorNombre: string | null
  publicado: boolean
  creadoEl: string
  tipo: string
  preguntas: number
  intentos: number
  peso: number | null
  abreEl: string | null
  cierraEl: string | null
  politica: string
  topeRemedial: number | null
}

export default function ExamenesAcademicos() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [examenes, setExamenes] = useState<Examen[]>([])
  const [cargando, setCargando] = useState(true)
  const [busca, setBusca] = useState('')
  const [modulo, setModulo] = useState('')
  const [estado, setEstado] = useState<'' | 'publicado' | 'borrador'>('')

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

      if (!esDireccionAcademica(perfil?.role as UserRole | undefined)) {
        setAutorizado(false)
        return
      }
      setAutorizado(true)

      const { data } = await supabase
        .from('exams')
        .select('id, title, status, created_at, kind, max_attempts, weight, opens_at, closes_at, retake_policy, retake_cap_pct, modules(name), cohorts(name), profiles!exams_teacher_id_fkey(full_name), exam_questions(count)')
        .order('created_at', { ascending: false })

      if (!vigente) return

      type ExamenCrudo = {
        id: string
        title: string
        status: string
        created_at: string
        modules: { name: string } | null
        cohorts: { name: string } | null
        profiles: { full_name: string } | null
        kind: string | null
        max_attempts: number | null
        weight: number | null
        opens_at: string | null
        closes_at: string | null
        retake_policy: string | null
        retake_cap_pct: number | null
        exam_questions: { count: number }[] | null
      }

      setExamenes(
        ((data ?? []) as unknown as ExamenCrudo[]).map((e) => ({
          id: e.id,
          titulo: e.title,
          moduloNombre: e.modules?.name ?? null,
          cohorteNombre: e.cohorts?.name ?? null,
          profesorNombre: e.profiles?.full_name ?? null,
          publicado: e.status !== 'oculto',
          creadoEl: e.created_at,
          tipo: e.kind === 'certificacion' ? 'Certificación' : 'Práctica',
          preguntas: e.exam_questions?.[0]?.count ?? 0,
          intentos: e.max_attempts ?? 1,
          peso: e.weight,
          abreEl: e.opens_at,
          cierraEl: e.closes_at,
          politica: e.retake_policy ?? 'mejor',
          topeRemedial: e.retake_cap_pct,
        })),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  const modulos = useMemo(
    () => Array.from(new Set(examenes.map((e) => e.moduloNombre).filter(Boolean) as string[])).sort(),
    [examenes],
  )
  const visibles = useMemo(
    () => examenes.filter((e) =>
      (!modulo || e.moduloNombre === modulo) &&
      (!estado || (estado === 'publicado') === e.publicado) &&
      (!busca.trim() || `${e.titulo} ${e.profesorNombre ?? ''}`.toLowerCase().includes(busca.trim().toLowerCase())),
    ),
    [examenes, modulo, estado, busca],
  )

  if (autorizado === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg px-5 text-center">
        <p className="text-sm text-zr-text-muted">Esta pantalla es solo para Dirección Académica.</p>
      </div>
    )
  }

  if (cargando || autorizado === null) {
    return (
      <PantallaEsqueleto />
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-5 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-28">
      <BotonVolver href="/panel" />

      <Encabezado sobretitulo="Dirección Académica" titulo="Exámenes" descripcion={`${examenes.length} en total, de todos los profesores`} />

      <Regla delay={60} />

      {examenes.length === 0 ? (
        <EstadoVacio titulo="Sin exámenes" explicacion="Todavía ningún profesor ha creado un examen." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por examen o profesor"
              className="min-h-12 rounded-lg border border-zr-border bg-zr-bg px-4 text-sm text-zr-text outline-none focus:border-zr-blue"
            />
            <select
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
              className="min-h-12 min-w-0 rounded-lg border border-zr-border bg-zr-bg px-3 text-sm text-zr-text"
            >
              <option value="">Todos los módulos</option>
              {modulos.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as '' | 'publicado' | 'borrador')}
              className="min-h-12 min-w-0 rounded-lg border border-zr-border bg-zr-bg px-3 text-sm text-zr-text"
            >
              <option value="">Publicados y borradores</option>
              <option value="publicado">Solo publicados</option>
              <option value="borrador">Solo borradores</option>
            </select>
          </div>
          <p className="text-xs text-zr-text-muted">Mostrando {visibles.length} de {examenes.length}</p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibles.map((e) => {
              const fecha = (d: string | null) => (d ? new Date(d).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }) : null)
              const politicas: Record<string, string> = { mejor: 'se queda la más alta', ultimo: 'cuenta el último', promedio: 'se promedian' }
              return (
                <div key={e.id} className="zr-card flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-base font-semibold text-zr-text">{e.titulo}</p>
                    <Etiqueta tono={e.publicado ? 'exito' : 'neutro'}>
                      {e.publicado ? 'Publicado' : 'Borrador'}
                    </Etiqueta>
                  </div>
                  <p className="text-sm text-zr-text-muted">
                    {e.moduloNombre ?? '—'}{e.cohorteNombre ? ` · ${e.cohorteNombre}` : ''}
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div><dt className="text-zr-text-muted">Tipo</dt><dd className="font-semibold text-zr-text">{e.tipo}</dd></div>
                    <div><dt className="text-zr-text-muted">Preguntas</dt><dd className="font-semibold text-zr-text">{e.preguntas}</dd></div>
                    <div><dt className="text-zr-text-muted">Intentos</dt><dd className="font-semibold text-zr-text">{e.intentos}</dd></div>
                    <div><dt className="text-zr-text-muted">Vale en la nota</dt><dd className="font-semibold text-zr-text">{e.peso ? `${e.peso} %` : '—'}</dd></div>
                    <div><dt className="text-zr-text-muted">Se abre</dt><dd className="font-semibold text-zr-text">{fecha(e.abreEl) ?? 'Sin fecha'}</dd></div>
                    <div><dt className="text-zr-text-muted">Se cierra</dt><dd className="font-semibold text-zr-text">{fecha(e.cierraEl) ?? 'Sin fecha'}</dd></div>
                  </dl>
                  {e.intentos > 1 && (
                    <p className="text-xs text-zr-text-muted">
                      Remedial: {politicas[e.politica] ?? e.politica}, máx. {e.topeRemedial ?? 80} %
                    </p>
                  )}
                  <p className="text-xs text-zr-text-muted">
                    Creado por {e.profesorNombre ?? 'sin profesor'} · {new Date(e.creadoEl).toLocaleDateString('es-VE')}
                  </p>
                  <div className="mt-auto flex gap-3 border-t border-zr-border/60 pt-3 text-xs font-bold">
                    <Link href={`/crear-examen/${e.id}`} className="text-zr-blue">Ver y editar</Link>
                    <Link href={`/calificar/${e.id}`} className="text-zr-blue">Ver resultados</Link>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
