'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla } from '@/components/ui/Editorial'
import { CASOS, diaSemanaISO, lunesDeLaSemana, fechaISO } from '@/lib/casos-fase0'
import { leerSimulacionSabado } from '@/lib/demo-sabado'
import { CASOS_HABILITADO } from '@/lib/flags'
import { IconoCarnet, IconoCheck } from '@/components/ui/Iconos'
import { esAdmin } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

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
  competencias: string[] | null
}

const NOMBRE_DIA = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const INICIAL_DIA = ['', 'L', 'M', 'X', 'J', 'V', 'S']

export default function Inicio() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [proximo, setProximo] = useState<ProximoSabado | null>(null)
  const [modulo, setModulo] = useState<Modulo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [validado, setValidado] = useState(true)
  const [hechos, setHechos] = useState<Set<string>>(new Set())
  // PRUEBA TEMPORAL: interruptor de simulación de sábado, controlado desde
  // Perfil. Se lee de localStorage dentro de cargar(), como el resto del
  // estado — nunca directo en el cuerpo del efecto (ver Sprint 7 de
  // docs/14_FASE0_PLAN_SPRINTS.md, por qué eso rompe el lint).
  const [simulado, setSimulado] = useState(false)
  // Aviso de asistencia recién marcada (viene de /asistencia, ver ajuste
  // post-Sprint F de docs/15_FASE0_PLAN_ADMIN.md): apenas se lee, se borra
  // de sessionStorage y se autooculta solo, no hace falta que el estudiante
  // haga nada.
  const [avisoAsistencia, setAvisoAsistencia] = useState<'ok' | 'duplicado' | null>(null)

  const hoy = new Date()
  const diaHoy = simulado ? 6 : diaSemanaISO(hoy)
  const lunes = lunesDeLaSemana(hoy)
  const esSabado = diaHoy === 6
  const casoHoy = CASOS[diaHoy]

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      setSimulado(leerSimulacionSabado())

      try {
        const marca = sessionStorage.getItem('zr_asistencia_ok')
        if (marca === 'ok' || marca === 'duplicado') {
          setAvisoAsistencia(marca)
          sessionStorage.removeItem('zr_asistencia_ok')
          setTimeout(() => setAvisoAsistencia(null), 3500)
        }
      } catch {
        // sessionStorage puede fallar en modo privado; no es crítico.
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase
        .from('profiles').select('full_name, role').eq('id', user.id).single()
      if (perfil) setNombre(perfil.full_name)

      const { data: estValidacion } = await supabase
        .from('students').select('validated_at').eq('id', user.id).maybeSingle()
      // Vista de recorrido (a pedido explícito del coordinador: admin,
      // dirección académica y super_admin pueden recorrer esta vista) — esas
      // cuentas no tienen fila en `students`, así que sin esto se quedaban
      // atascadas viendo "Tu cuenta está siendo validada".
      const yaValidado = Boolean(estValidacion?.validated_at) || esAdmin(perfil?.role as UserRole | undefined)
      setValidado(yaValidado)

      // Sin validar todavía no tiene sentido cargar horario, módulo ni
      // casos — la cuenta apenas la creó ventas, puede que ni tenga cohorte
      // real asignada todavía.
      if (!yaValidado) {
        setCargando(false)
        return
      }

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
      let moduloId = (est as unknown as { cohorts: { current_module_id: string | null } | null } | null)
        ?.cohorts?.current_module_id

      // Vista de recorrido (admin, dirección académica y super_admin): no
      // tienen fila en `students`, así que no hay módulo propio que leer. En
      // vez de dejar este espacio vacío, se muestra en solo lectura el
      // módulo de una cohorte real que ya tenga uno asignado — igual que ya
      // hacían /clases y /malla.
      if (!moduloId && esAdmin(perfil?.role as UserRole | undefined)) {
        const { data: cohortesConModulo } = await supabase
          .from('cohorts')
          .select('current_module_id, students(id)')
          .not('current_module_id', 'is', null)
          .eq('status', 'activa')

        const filas = (cohortesConModulo ?? []) as unknown as {
          current_module_id: string; students: { id: string }[] | null
        }[]
        const mejor = [...filas].sort((a, b) => (b.students?.length ?? 0) - (a.students?.length ?? 0))[0]
        if (mejor) moduloId = mejor.current_module_id
      }

      if (moduloId) {
        const { data: mod } = await supabase
          .from('modules')
          .select('name, description, competencias')
          .eq('id', moduloId)
          .single()
        if (mod) setModulo({ nombre: mod.name, descripcion: mod.description, competencias: mod.competencias })
      }

      // Qué días de esta semana ya se trabajaron. Fase 0 (Sprint 2) los
      // guardaba solo en el teléfono; ahora se lee de la base
      // (case_completions, ver Sprint D de docs/16_FASE0_PLAN_PROFESOR.md)
      // para que sea la misma verdad en cualquier dispositivo, y coincida
      // con lo que ve el profesor.
      const inicioSemana = fechaISO(lunes)
      const finSemana = fechaISO(new Date(lunes.getTime() + 5 * 86400000))
      const { data: completados } = await supabase
        .from('case_completions')
        .select('case_date')
        .eq('student_id', user.id)
        .gte('case_date', inicioSemana)
        .lte('case_date', finSemana)

      setHechos(new Set((completados ?? []).map((c) => c.case_date)))

      setCargando(false)
    }

    cargar()
  }, [router])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  if (!validado) {
    return (
      <div className="flex min-h-dvh flex-col justify-center bg-zr-bg px-5 pb-28">
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zr-border bg-zr-surface text-3xl">
            ⏳
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
              {nombre.split(' ')[0] || 'Bienvenido(a)'}
            </p>
            <h1 className="zr-display mt-2 text-3xl text-zr-text">Tu cuenta está siendo validada</h1>
          </div>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-zr-text-muted">
            Administración confirma tu inscripción cuando firmes tu planilla en persona en la
            academia. Ya puedes completar tu perfil desde abajo mientras esperas.
          </p>
          <button
            onClick={() => router.push('/perfil')}
            className="mx-auto min-h-14 rounded-lg border border-zr-border px-8 text-base font-semibold text-zr-text"
          >
            Ir a mi perfil
          </button>
        </div>
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
    const num = diaHoy
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
            Panel del estudiante
          </p>
          <h1 className="zr-display mt-3 text-4xl text-zr-text">{primerNombre}</h1>
        </header>

        {avisoAsistencia && (
          <div className="flex animate-fade-in items-center gap-3 rounded-lg border border-zr-success/30 bg-zr-success/12 px-5 py-4">
            <IconoCheck size={20} className="shrink-0 text-zr-success" />
            <p className="text-sm font-semibold text-zr-text">
              {avisoAsistencia === 'duplicado' ? 'Ya estabas registrado hoy' : 'Asistencia registrada'}
            </p>
          </div>
        )}

        <Regla delay={60} />

        {/* 01 — SEMANA Y HOY */}
        <Seccion
          numero={1}
          titulo={`Hoy, ${NOMBRE_DIA[diaHoy].toLowerCase()} ${hoy.getDate()} de ${hoy.toLocaleDateString('es-VE', { month: 'long' })}`}
          delay={120}
        >
          <div id="tour-semana" className="grid grid-cols-6 gap-1.5">
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
          ) : CASOS_HABILITADO ? (
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
          ) : modulo ? (
            // Con "Casos" apagado (lib/flags.ts), este espacio no se deja
            // vacío: a pedido explícito del coordinador, va el resumen corto
            // y las competencias del módulo que está cursando — nada que
            // dependa de que alguien lo revise o lo actualice a diario. Más
            // un acceso directo al material adjunto, también pedido.
            <div className="zr-card overflow-hidden">
              <button
                onClick={() => router.push('/clases')}
                className="w-full text-left"
              >
                <div className="border-b border-zr-border px-6 py-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Estás cursando</p>
                  <p className="zr-display mt-2 text-xl text-zr-text">{modulo.nombre}</p>
                </div>
                <div className="space-y-3 px-6 py-6">
                  {modulo.descripcion && (
                    <p className="text-sm leading-relaxed text-zr-text-muted">{modulo.descripcion}</p>
                  )}
                  {modulo.competencias && modulo.competencias.length > 0 && (
                    <ul className="space-y-1.5">
                      {modulo.competencias.slice(0, 3).map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-zr-text">
                          <IconoCheck size={14} className="mt-0.5 shrink-0 text-zr-blue-mid" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="pt-1 text-xs font-bold uppercase tracking-wide text-zr-blue-mid">
                    Ver todo lo que vas a aprender ›
                  </p>
                </div>
              </button>
              <button
                onClick={() => router.push('/contenido')}
                className="flex min-h-14 w-full items-center justify-center gap-2 border-t border-zr-border text-sm font-bold text-zr-text active:bg-zr-border/30"
              >
                📁 Revisar el material del módulo
              </button>
            </div>
          ) : null}
        </Seccion>

        {/* 02 — MI MÓDULO: solo con "Casos" activo (lib/flags.ts) — si está
            apagado, la sección 01 ya muestra el módulo actual y repetirlo
            aquí sería lo mismo dos veces en la misma pantalla. */}
        {modulo && CASOS_HABILITADO && (
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
          <div id="tour-accesos" className="space-y-3">
            <button
              onClick={() => router.push('/perfil')}
              className="w-full overflow-hidden rounded-lg bg-gradient-to-r from-zr-blue-deep to-zr-blue px-6 py-5 text-left transition-all hover:shadow-lg hover:shadow-zr-blue/25"
            >
              <p className="text-base font-bold text-white">Mi carnet</p>
            </button>

            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/contenido', titulo: 'Material', sub: 'Guías y PDFs' },
                { href: '/dudas',     titulo: 'Dudas',    sub: 'Pregúntale al profesor' },
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
