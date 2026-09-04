'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { Boton } from '@/components/ui/Boton'
import { Aviso } from '@/components/ui/Aviso'
import type { UserRole } from '@/lib/types'

/**
 * A pedido explícito (fuera del plan post-directiva): editor de los
 * resúmenes de módulo que ve el estudiante. Son textos ESTÁTICOS —
 * nadie los genera automáticamente, y no cambian solos con el tiempo ni al
 * crear un programa nuevo. Solo cambian si alguien de aquí los edita.
 *
 * Dos textos, no uno (migración 080, pedido explícito del coordinador —
 * el resumen largo "se ve feo" en la malla curricular, donde van los 14
 * juntos, pero SÍ tiene sentido en Mi módulo, donde se ve uno a la vez):
 *   - Resumen corto:  una frase, se ve en la malla curricular (los 14 a la vez).
 *   - Resumen largo:  el texto extenso, se ve en Mi módulo (uno a la vez).
 *
 * Cada nombre de módulo existe una vez por programa (PTMA, PFTA, el que
 * venga) porque `modules` está atado a `program_id` — pero hoy todos los
 * programas comparten el mismo currículo de 14 módulos, mismo nombre y
 * orden. Editar "Módulo 1" aquí actualiza TODAS las filas que comparten
 * ese nombre, para no tener que repetir la edición por cada programa ni
 * dejar sedes desincronizadas entre sí.
 */

interface Modulo {
  nombre: string
  ordenIndex: number
  descripcion: string
  resumenLargo: string
  duracionSemanas: number
  cantidadProgramas: number
}

export default function EditarModulos() {
  const router = useRouter()
  const [rol, setRol] = useState<UserRole | null>(null)
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [textoCorto, setTextoCorto] = useState('')
  const [textoLargo, setTextoLargo] = useState('')
  const [semanas, setSemanas] = useState(4)
  const [horasPorSabado, setHorasPorSabado] = useState(4)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

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

      const rolActual = (perfil?.role as UserRole) ?? null
      setRol(rolActual)
      const puede = esDireccionAcademica(rolActual)
      setAutorizado(puede)
      if (!puede) {
        setCargando(false)
        return
      }

      const [{ data: mods }, { data: config }] = await Promise.all([
        supabase
          .from('modules')
          .select('name, order_index, description, resumen_largo, duration_weeks')
          .order('order_index'),
        supabase.from('system_config').select('value').eq('key', 'academia.horas_por_sabado').maybeSingle(),
      ])
      if (config?.value != null) setHorasPorSabado(Number(config.value))

      const filas = (mods ?? []) as {
        name: string; order_index: number; description: string | null
        resumen_largo: string | null; duration_weeks: number
      }[]

      // Agrupar por nombre: todos los programas comparten el mismo currículo,
      // así que solo hace falta una fila por módulo en la pantalla — pero se
      // guarda el conteo para poder avisar si algún programa quedó distinto.
      const porNombre = new Map<string, Modulo>()
      for (const f of filas) {
        const existente = porNombre.get(f.name)
        if (existente) {
          existente.cantidadProgramas += 1
        } else {
          porNombre.set(f.name, {
            nombre: f.name,
            ordenIndex: f.order_index,
            descripcion: f.description ?? '',
            resumenLargo: f.resumen_largo ?? '',
            duracionSemanas: f.duration_weeks,
            cantidadProgramas: 1,
          })
        }
      }

      setModulos([...porNombre.values()].sort((a, b) => a.ordenIndex - b.ordenIndex))
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  function abrir(m: Modulo) {
    setEditando(m.nombre)
    setTextoCorto(m.descripcion)
    setTextoLargo(m.resumenLargo)
    setSemanas(m.duracionSemanas)
    setError(null)
    setExito(null)
  }

  async function guardar(nombre: string) {
    setGuardando(true)
    setError(null)

    const { error: fallo } = await createClient()
      .from('modules')
      .update({
        description: textoCorto.trim() || null,
        resumen_largo: textoLargo.trim() || null,
        duration_weeks: semanas,
      })
      .eq('name', nombre)

    setGuardando(false)

    if (fallo) {
      setError('No se pudo guardar. Intenta de nuevo.')
      return
    }

    setEditando(null)
    setExito(`"${nombre}" actualizado.`)
    setVersion((v) => v + 1)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  if (autorizado === false) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zr-bg px-5">
        <div className="zr-card max-w-sm p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Solo dirección académica</p>
          <p className="mt-2 text-sm text-zr-text-muted">
            Esta pantalla edita lo que ve todo estudiante en "Mi módulo". Solo super_admin o
            dirección académica pueden entrar.
          </p>
        </div>
        <BotonVolver href="/panel" />
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <BotonVolver href="/panel" />
      <Encabezado
        sobretitulo={rol === 'super_admin' ? 'Super admin' : 'Dirección académica'}
        titulo="Resúmenes de módulos"
        descripcion="Resumen corto (malla), resumen largo (Mi módulo) y duración. Texto estático — no cambia solo."
      />
      <Regla delay={60} />

      {exito && <Aviso tipo="exito">{exito}</Aviso>}

      <Seccion numero={1} titulo="Los 14 módulos" delay={100}>
        <div className="space-y-3">
          {modulos.map((m) => (
            <div key={m.nombre} className="zr-card p-5">
              {editando === m.nombre ? (
                <div className="space-y-4">
                  <p className="text-sm font-bold text-zr-text">
                    {m.ordenIndex}. {m.nombre}
                  </p>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zr-text-muted">
                      Resumen corto — malla curricular (una frase)
                    </label>
                    <textarea
                      value={textoCorto}
                      onChange={(e) => setTextoCorto(e.target.value)}
                      rows={2}
                      placeholder="Una frase corta: qué se ve en este módulo."
                      className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-sm leading-relaxed text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zr-text-muted">
                      Resumen largo — Mi módulo (el que se está cursando)
                    </label>
                    <textarea
                      value={textoLargo}
                      onChange={(e) => setTextoLargo(e.target.value)}
                      rows={10}
                      placeholder="El resumen extenso — lo que el estudiante va a ver, trabajar y aprender."
                      className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-sm leading-relaxed text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zr-text-muted">
                      Duración (sábados)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={semanas}
                      onChange={(e) => setSemanas(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-28 rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base tabular-nums text-zr-text focus:border-zr-blue focus:outline-none"
                    />
                    <p className="mt-1.5 text-xs text-zr-text-muted">
                      {semanas * horasPorSabado} horas académicas ({semanas} sábados × {horasPorSabado} horas)
                    </p>
                  </div>

                  {error && <Aviso tipo="error">{error}</Aviso>}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditando(null)}
                      className="min-h-14 flex-1 rounded-lg border border-zr-border text-base font-semibold text-zr-text"
                    >
                      Cancelar
                    </button>
                    <Boton onClick={() => guardar(m.nombre)} cargando={guardando} className="flex-1">
                      Guardar
                    </Boton>
                  </div>
                </div>
              ) : (
                <button onClick={() => abrir(m)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-bold text-zr-text">
                      {m.ordenIndex}. {m.nombre}
                      <span className="ml-2 font-normal text-zr-text-muted">
                        · {m.duracionSemanas * horasPorSabado}h ({m.duracionSemanas} sábados)
                      </span>
                    </p>
                    <span className="shrink-0 text-xs font-semibold text-zr-blue">Editar</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-zr-text-muted">
                    {m.descripcion || 'Todavía no tiene resumen — el estudiante ve el módulo sin descripción.'}
                  </p>
                </button>
              )}
            </div>
          ))}
        </div>
      </Seccion>
    </div>
  )
}
