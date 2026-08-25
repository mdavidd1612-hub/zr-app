'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { CASOS, diaSemanaISO, lunesDeLaSemana, fechaISO } from '@/lib/casos-fase0'
import { IconoCarnet, IconoCheck } from '@/components/ui/Iconos'

interface ProximoSabado {
  sessionId: string
  fecha: string
  semana: number
  modulo: string
  competencia: string | null
  investigacion: string | null
}

interface Modulo {
  nombre: string
  descripcion: string | null
}

const NOMBRE_DIA = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const INICIAL_DIA = ['', 'L', 'M', 'X', 'J', 'V', 'S']

export default function Inicio() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [proximo, setProximo] = useState<ProximoSabado | null>(null)
  const [modulo, setModulo] = useState<Modulo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [hechos, setHechos] = useState<Set<string>>(new Set())

  const hoy = new Date()
  const diaHoy = diaSemanaISO(hoy)
  const lunes = lunesDeLaSemana(hoy)
  const esSabado = diaHoy === 6
  const casoHoy = CASOS[diaHoy]

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase
        .from('profiles').select('full_name').eq('id', user.id).single()
      if (perfil) setNombre(perfil.full_name)

      const { data: prox } = await supabase
        .from('v_proximo_sabado')
        .select('*')
        .eq('student_id', user.id)
        .maybeSingle()

      if (prox) {
        setProximo({
          sessionId: prox.session_id!,
          fecha: prox.session_date!,
          semana: prox.week_number!,
          modulo: prox.module_name!,
          competencia: prox.sub_competency_name,
          investigacion: prox.pre_practice_description,
        })
      }

      // "Mi módulo" no depende de que haya guía digitalizada para el próximo
      // sábado (v_proximo_sabado puede venir vacía) — se lee directo de la
      // cohorte del estudiante, igual que hará la pantalla Mi módulo (Sprint 3).
      const { data: est } = await supabase
        .from('students')
        .select('cohorts(current_module_id)')
        .eq('id', user.id)
        .single()
      const moduloId = (est as unknown as { cohorts: { current_module_id: string | null } | null } | null)
        ?.cohorts?.current_module_id
      if (moduloId) {
        const { data: mod } = await supabase
          .from('modules')
          .select('name, description')
          .eq('id', moduloId)
          .single()
        if (mod) setModulo({ nombre: mod.name, descripcion: mod.description })
      }

      setCargando(false)
    }

    cargar()

    // Qué días de esta semana ya se trabajaron (Fase 0: se guarda en el
    // teléfono, sin backend — docs/14_FASE0_PLAN_SPRINTS.md, Sprint 2).
    try {
      const marcados = new Set<string>()
      for (let i = 0; i < 6; i++) {
        const d = new Date(lunes)
        d.setDate(d.getDate() + i)
        if (localStorage.getItem(`zr_caso_${fechaISO(d)}`)) marcados.add(fechaISO(d))
      }
      setHechos(marcados)
    } catch {
      // localStorage puede fallar en modo privado; no es crítico.
    }
  }, [router])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  const primerNombre = nombre.split(' ')[0] || 'Estudiante'
  const fechaCorta = proximo
    ? new Date(proximo.fecha + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })
    : ''

  const diasSemana = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(d.getDate() + i)
    const iso = fechaISO(d)
    const num = diaSemanaISO(hoy)
    let estado: 'hoy' | 'hecho' | 'pasado' | 'futuro' = 'futuro'
    if (i + 1 === num) estado = 'hoy'
    else if (hechos.has(iso)) estado = 'hecho'
    else if (i + 1 < num) estado = 'pasado'
    return { d, iso, estado }
  })

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-11">
        <header className="animate-rise" style={{ animationDelay: '0ms' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
            ZR Mecademy
          </p>
          <h1 className="zr-display mt-3 text-4xl text-zr-text">{primerNombre}</h1>
        </header>

        <Regla delay={60} />

        {/* 01 — SEMANA Y HOY */}
        <Seccion
          numero={1}
          titulo={`Hoy, ${NOMBRE_DIA[diaHoy].toLowerCase()} ${hoy.getDate()} de ${hoy.toLocaleDateString('es-VE', { month: 'long' })}`}
          delay={120}
        >
          <div className="grid grid-cols-6 gap-1.5">
            {diasSemana.map(({ d, iso, estado }, i) => (
              <div
                key={iso}
                className={`rounded-lg border py-2.5 text-center text-xs font-semibold ${
                  estado === 'hoy'
                    ? 'border-zr-blue bg-zr-blue text-white'
                    : estado === 'hecho'
                    ? 'border-zr-success/30 bg-zr-success/12 text-zr-success'
                    : estado === 'pasado'
                    ? 'border-zr-border text-zr-text-muted'
                    : 'border-zr-border/60 text-zr-text-muted/50'
                }`}
              >
                <p className="text-[13px] font-bold">{d.getDate()}</p>
                <p className="mt-0.5">{INICIAL_DIA[i + 1]}</p>
              </div>
            ))}
          </div>

          {esSabado ? (
            <div className="zr-card overflow-hidden">
              <div className="border-b border-zr-border px-6 py-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Hoy toca clase</p>
                <p className="zr-display mt-2 text-xl text-zr-text">Marca tu asistencia</p>
              </div>
              <div className="space-y-4 px-6 py-6">
                <p className="text-sm leading-relaxed text-zr-text-muted">
                  Escanea el código que administración muestra en pantalla al llegar.
                </p>
                <button
                  onClick={() => router.push('/asistencia')}
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-zr-blue text-base font-bold text-white transition-colors active:bg-zr-blue-deep"
                >
                  <IconoCarnet size={20} />
                  Tomar asistencia
                </button>
              </div>
            </div>
          ) : (
            <div className="zr-card overflow-hidden">
              <div className="border-b border-zr-border px-6 py-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">El caso de hoy</p>
                <p className="zr-display mt-2 text-xl text-zr-text">{casoHoy?.titulo ?? 'Sin caso asignado'}</p>
              </div>
              <div className="space-y-4 px-6 py-6">
                {casoHoy && <p className="text-sm leading-relaxed text-zr-text-muted">{casoHoy.escenario}</p>}
                <button
                  onClick={() => router.push('/caso')}
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-zr-blue text-base font-bold text-white transition-colors active:bg-zr-blue-deep"
                >
                  {hechos.has(fechaISO(hoy)) ? (
                    <>
                      <IconoCheck size={20} />
                      Ver el caso otra vez
                    </>
                  ) : (
                    'Trabajar el caso'
                  )}
                </button>
              </div>
            </div>
          )}
        </Seccion>

        {/* 02 — MI MÓDULO */}
        {modulo && (
          <Seccion numero={2} titulo="Mi módulo" delay={200}>
            <button
              onClick={() => router.push('/clases')}
              className="zr-card zr-card-interactive w-full overflow-hidden p-0 text-left"
            >
              <div className="px-6 py-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-zr-blue-mid">{modulo.nombre}</p>
                  {proximo && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-zr-text-muted">
                      Semana {proximo.semana}
                    </p>
                  )}
                </div>
                <p className="mt-1 text-xs text-zr-text-muted">
                  {proximo
                    ? `Próxima clase: ${fechaCorta} · toca para ver qué vas a aprender`
                    : 'Toca para ver qué vas a aprender'}
                </p>
              </div>
            </button>
          </Seccion>
        )}

        {/* 03 — ACCESOS */}
        <Seccion numero={3} titulo="Accesos" delay={280}>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/perfil')}
              className="w-full overflow-hidden rounded-lg bg-gradient-to-r from-zr-blue-deep to-zr-blue px-6 py-5 text-left transition-all hover:shadow-lg hover:shadow-zr-blue/25"
            >
              <p className="text-base font-bold text-white">Mi carnet</p>
            </button>

            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/contenido', titulo: 'Material', sub: 'Guías y PDFs' },
                { href: '/clases',    titulo: 'Mi módulo', sub: 'Qué vas a aprender' },
              ].map((a) => (
                <button
                  key={a.href}
                  onClick={() => router.push(a.href)}
                  className="zr-card zr-card-interactive px-4 py-4 text-left"
                >
                  <p className="text-sm font-bold text-zr-text">{a.titulo}</p>
                  <p className="mt-0.5 text-xs text-zr-text-muted">{a.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </Seccion>
      </div>
    </div>
  )
}
