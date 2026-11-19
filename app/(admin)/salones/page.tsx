'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { TarjetaHero } from '@/components/ui/TarjetaHero'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { IconoCalendario } from '@/components/ui/Iconos'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import type { UserRole } from '@/lib/types'

/**
 * Salones (18-nov-2026, migración 216). El super_admin crea los salones de cada
 * sede; Dirección Académica (y super_admin) elige en qué salón tiene clase cada
 * cohorte cada sábado. Si un sábado no tiene salón propio, se repite el último
 * asignado. Estudiante y profesor lo ven en su calendario.
 */

interface Sede { id: string; nombre: string }
interface Salon { id: string; sede_id: string; nombre: string }
interface Cohorte { id: string; name: string; sede: string | null }
interface Dia { cohort_id: string; class_date: string; room_id: string }

const CAMPO = 'min-h-11 w-full rounded-xl border border-zr-border bg-zr-surface/40 px-3 text-sm text-zr-text outline-none focus:border-zr-blue'

function proximosSabados(n: number): string[] {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7))
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d)
    x.setDate(d.getDate() + i * 7)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  })
}

function etiquetaFecha(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function Salones() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [esSuper, setEsSuper] = useState(false)
  const [userId, setUserId] = useState('')
  const [sedes, setSedes] = useState<Sede[]>([])
  const [salones, setSalones] = useState<Salon[]>([])
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [dias, setDias] = useState<Dia[]>([])
  const [nuevo, setNuevo] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const [s, r, c, d] = await Promise.all([
      supabase.from('sedes').select('id, nombre').eq('activa', true).order('nombre'),
      supabase.from('rooms' as never).select('id, sede_id, nombre').order('nombre'),
      supabase.from('cohorts').select('id, name, sede').eq('status', 'activa').order('name'),
      supabase.from('cohort_room_days' as never).select('cohort_id, class_date, room_id'),
    ])
    setSedes((s.data ?? []) as Sede[])
    setSalones((r.data ?? []) as unknown as Salon[])
    setCohortes((c.data ?? []) as Cohorte[])
    setDias((d.data ?? []) as unknown as Dia[])
  }, [])

  useEffect(() => {
    async function iniciar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setUserId(user.id)
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const rol = perfil?.role as UserRole | undefined
      if (rol !== 'super_admin' && rol !== 'direccion_academica') { setCargando(false); return }
      setEsSuper(rol === 'super_admin')
      await cargar()
      setCargando(false)
    }
    iniciar()
  }, [router, cargar])

  async function agregarSalon(sedeId: string) {
    const nombre = (nuevo[sedeId] ?? '').trim()
    if (!nombre) return
    const { error } = await createClient().from('rooms' as never).insert({ sede_id: sedeId, nombre } as never)
    if (error) { setAviso(error.code === '23505' ? 'Ese salón ya existe en esta sede.' : 'No se pudo guardar el salón.'); return }
    setAviso('')
    setNuevo({ ...nuevo, [sedeId]: '' })
    await cargar()
  }

  async function quitarSalon(id: string) {
    const { error } = await createClient().from('rooms' as never).delete().eq('id', id)
    if (error) { setAviso('Ese salón ya se usó en alguna clase y no se puede borrar.'); return }
    setAviso('')
    await cargar()
  }

  async function elegir(cohortId: string, fecha: string, roomId: string) {
    const supabase = createClient()
    if (!roomId) {
      await supabase.from('cohort_room_days' as never).delete().eq('cohort_id', cohortId).eq('class_date', fecha)
    } else {
      await supabase.from('cohort_room_days' as never).upsert(
        { cohort_id: cohortId, class_date: fecha, room_id: roomId, set_by: userId } as never,
      )
    }
    await cargar()
  }

  if (cargando) return <PantallaEsqueleto variante="lista" />

  const sabados = proximosSabados(6)
  const nombreSalon = (id: string) => salones.find((x) => x.id === id)?.nombre ?? ''

  return (
    <div className="px-5 pb-28 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <div className="space-y-8">
        <BotonVolver href="/panel" />

        <div className="animate-rise">
          <TarjetaHero
            sobretitulo="Dirección académica"
            titulo="Salones"
            texto="Elige en qué salón tiene clase cada cohorte cada sábado. Estudiantes y profesores lo ven en su calendario."
            icono={<IconoCalendario size={24} />}
          />
        </div>

        {aviso && <p className="rounded-xl bg-zr-error/10 px-4 py-3 text-sm font-semibold text-zr-error">{aviso}</p>}

        <Seccion numero={1} titulo="Salón de cada sábado" delay={60}>
          {cohortes.length === 0 ? (
            <EstadoVacio Icono={IconoCalendario} titulo="No hay cohortes activas" explicacion="Cuando abras un corte, aquí eliges su salón." />
          ) : (
            <div className="space-y-4">
              {cohortes.map((c) => {
                const opciones = salones.filter((s) => sedes.find((x) => x.id === s.sede_id)?.nombre === c.sede)
                const propios = dias.filter((d) => d.cohort_id === c.id)
                return (
                  <div key={c.id} className="zr-card space-y-3 p-5">
                    <div>
                      <p className="text-sm font-bold text-zr-text">{c.name}</p>
                      <p className="text-xs text-zr-text-muted">Sede: {c.sede ?? 'sin sede'}</p>
                    </div>
                    {opciones.length === 0 ? (
                      <p className="text-sm text-zr-text-muted">Esta sede todavía no tiene salones. Pídele al super admin que los cree abajo.</p>
                    ) : (
                      <div className="divide-y divide-zr-border/60">
                        {sabados.map((f) => {
                          const propio = propios.find((d) => d.class_date === f)
                          const heredado = !propio
                            ? [...propios].filter((d) => d.class_date < f).sort((a, b) => b.class_date.localeCompare(a.class_date))[0]
                            : undefined
                          return (
                            <div key={f} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-sm font-semibold capitalize text-zr-text">{etiquetaFecha(f)}</span>
                              <select
                                value={propio?.room_id ?? ''}
                                onChange={(e) => elegir(c.id, f, e.target.value)}
                                className={`${CAMPO} sm:max-w-[16rem]`}
                              >
                                <option value="">{heredado ? `Igual que antes (${nombreSalon(heredado.room_id)})` : 'Sin salón asignado'}</option>
                                {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                              </select>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Seccion>

        {esSuper && (
          <Seccion numero={2} titulo="Salones de cada sede" delay={140}>
            <div className="space-y-4">
              {sedes.map((s) => {
                const lista = salones.filter((x) => x.sede_id === s.id)
                return (
                  <div key={s.id} className="zr-card space-y-3 p-5">
                    <p className="text-sm font-bold text-zr-text">{s.nombre}</p>
                    {lista.length === 0 && <p className="text-sm text-zr-text-muted">Sin salones todavía.</p>}
                    <div className="flex flex-wrap gap-2">
                      {lista.map((x) => (
                        <span key={x.id} className="inline-flex items-center gap-2 rounded-full bg-zr-surface px-3 py-1.5 text-sm font-semibold text-zr-text">
                          {x.nombre}
                          <button onClick={() => quitarSalon(x.id)} aria-label={`Quitar ${x.nombre}`} className="text-zr-error">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={nuevo[s.id] ?? ''}
                        onChange={(e) => setNuevo({ ...nuevo, [s.id]: e.target.value })}
                        placeholder="Nombre del salón (ej. Aula 2)"
                        className={CAMPO}
                      />
                      <button
                        onClick={() => agregarSalon(s.id)}
                        disabled={!(nuevo[s.id] ?? '').trim()}
                        className="min-h-11 shrink-0 rounded-xl bg-zr-blue px-4 text-sm font-bold text-white disabled:opacity-40"
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Seccion>
        )}
      </div>
    </div>
  )
}
