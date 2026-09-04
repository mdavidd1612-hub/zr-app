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
 * resúmenes de "Mi módulo" que ve el estudiante. Son textos ESTÁTICOS —
 * nadie los genera automáticamente, y no cambian solos con el tiempo ni al
 * crear un programa nuevo. Solo cambian si alguien de aquí los edita.
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
  cantidadProgramas: number
}

export default function EditarModulos() {
  const router = useRouter()
  const [rol, setRol] = useState<UserRole | null>(null)
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
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

      const { data: mods } = await supabase
        .from('modules')
        .select('name, order_index, description')
        .order('order_index')

      const filas = (mods ?? []) as { name: string; order_index: number; description: string | null }[]

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
    setTexto(m.descripcion)
    setError(null)
    setExito(null)
  }

  async function guardar(nombre: string) {
    setGuardando(true)
    setError(null)

    const { error: fallo } = await createClient()
      .from('modules')
      .update({ description: texto.trim() || null })
      .eq('name', nombre)

    setGuardando(false)

    if (fallo) {
      setError('No se pudo guardar. Intenta de nuevo.')
      return
    }

    setEditando(null)
    setExito(`Resumen de "${nombre}" actualizado.`)
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
        descripcion="Lo que cada estudiante ve en Mi módulo. Es texto estático — no cambia solo."
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
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={10}
                    placeholder="Escribe el resumen extenso de este módulo — lo que el estudiante va a ver, trabajar y aprender."
                    className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-sm leading-relaxed text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                  />
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
