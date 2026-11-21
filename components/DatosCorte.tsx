'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select } from '@/components/ui/Select'

/**
 * Datos editables de un corte (20-nov-2026, pedido del coordinador: "poder
 * modificar desde aquí como super admin lo que se edita al crear: el nombre,
 * la sede, entre otras cosas"). Super_admin y, desde v1.91, también Dirección
 * Académica (para poner el horario de los cortes y cursos que crea). Todo es un `update` simple
 * sobre `cohorts`; la RLS ("admin: escribir cohortes") ya lo permite.
 */
interface Datos {
  name: string; sede: string; turno: string; location: string
  days: string; schedule: string; start_date: string; status: string
  weekdays: number[]; start: string; end: string
}

// 0 = domingo … 6 = sábado (igual que `cohorts.class_weekdays`, migración 233).
const DIAS = [{ n: 1, t: 'Lun' }, { n: 2, t: 'Mar' }, { n: 3, t: 'Mié' }, { n: 4, t: 'Jue' }, { n: 5, t: 'Vie' }, { n: 6, t: 'Sáb' }, { n: 0, t: 'Dom' }]

const CAMPO = 'min-h-11 w-full rounded-xl border border-zr-border bg-zr-surface/40 px-3 text-sm text-zr-text outline-none focus:border-zr-blue'

export function DatosCorte({ cohorteId, onGuardado }: { cohorteId: string; onGuardado?: (nombre: string, estado: string) => void }) {
  const [esSuper, setEsSuper] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [d, setD] = useState<Datos | null>(null)
  const [sedes, setSedes] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (perfil?.role !== 'super_admin' && perfil?.role !== 'direccion_academica') return
      setEsSuper(true)
      const [{ data: c }, { data: s }] = await Promise.all([
        supabase.from('cohorts').select('name, sede, turno, location, days, schedule, start_date, status, class_weekdays, class_start, class_end' as 'name, sede, turno, location, days, schedule, start_date, status').eq('id', cohorteId).maybeSingle(),
        supabase.from('sedes').select('nombre').eq('activa', true).order('nombre'),
      ])
      setSedes((s ?? []).map((x) => x.nombre))
      if (c) {
        const x = c as typeof c & { class_weekdays: number[] | null; class_start: string | null; class_end: string | null }
        setD({
          name: c.name, sede: c.sede ?? '', turno: c.turno ?? 'mañana', location: c.location ?? '',
          days: c.days ?? '', schedule: c.schedule ?? '', start_date: c.start_date, status: c.status,
          weekdays: x.class_weekdays ?? [6], start: (x.class_start ?? '').slice(0, 5), end: (x.class_end ?? '').slice(0, 5),
        })
      }
    })
  }, [cohorteId])

  if (!esSuper || !d) return null

  const poner = (k: keyof Datos, v: string) => setD({ ...d, [k]: v })

  async function guardar() {
    if (!d) return
    if (!d.name.trim()) { setAviso({ ok: false, texto: 'El nombre no puede quedar vacío.' }); return }
    if (d.weekdays.length === 0) { setAviso({ ok: false, texto: 'Elige al menos un día de clase.' }); return }
    if (d.start && d.end && d.end <= d.start) { setAviso({ ok: false, texto: 'La hora de fin tiene que ser después de la de inicio.' }); return }
    setGuardando(true)
    setAviso(null)
    const { error } = await createClient().from('cohorts').update({
      name: d.name.trim(),
      sede: d.sede || null,
      turno: d.turno || null,
      location: d.location.trim() || null,
      days: d.days.trim() || null,
      schedule: d.schedule.trim() || null,
      start_date: d.start_date,
      status: d.status as 'activa' | 'finalizada' | 'suspendida',
      class_weekdays: d.weekdays,
      class_start: d.start || null,
      class_end: d.end || null,
    } as never).eq('id', cohorteId)
    setGuardando(false)
    if (error) {
      setAviso({ ok: false, texto: error.code === '23505' ? 'Ya existe un corte con ese nombre o número en esa sede.' : 'No se pudo guardar. Revisa los datos e inténtalo otra vez.' })
      return
    }
    setAviso({ ok: true, texto: 'Guardado.' })
    onGuardado?.(d.name.trim(), d.status)
  }

  return (
    <div className="zr-card overflow-hidden">
      <button onClick={() => setAbierto((a) => !a)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span>
          <span className="block text-sm font-bold text-zr-text">Datos del corte</span>
          <span className="block text-xs text-zr-text-muted">Nombre, sede, turno, días, horario, fecha de inicio y estado · Dirección Académica y super admin</span>
        </span>
        <span aria-hidden className={`text-zr-text-muted transition-transform ${abierto ? 'rotate-90' : ''}`}>›</span>
      </button>
      {abierto && (
        <div className="space-y-4 border-t border-zr-border p-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block space-y-1.5 md:col-span-2 xl:col-span-1">
              <span className="text-xs font-semibold text-zr-text-muted">Nombre</span>
              <input value={d.name} onChange={(e) => poner('name', e.target.value)} className={CAMPO} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-zr-text-muted">Sede</span>
              <Select value={d.sede} onChange={(e) => poner('sede', e.target.value)} className={CAMPO}>
                <option value="">Sin sede</option>
                {sedes.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-zr-text-muted">Turno</span>
              <Select value={d.turno} onChange={(e) => poner('turno', e.target.value)} className={CAMPO}>
                <option value="mañana">Mañana</option>
                <option value="tarde">Tarde</option>
              </Select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-zr-text-muted">Ubicación</span>
              <input value={d.location} onChange={(e) => poner('location', e.target.value)} className={CAMPO} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-zr-text-muted">Días (se imprime en la planilla)</span>
              <input value={d.days} onChange={(e) => poner('days', e.target.value)} placeholder="Sábados" className={CAMPO} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-zr-text-muted">Horario</span>
              <input value={d.schedule} onChange={(e) => poner('schedule', e.target.value)} placeholder="8:00 a.m. – 12:00 m." className={CAMPO} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-zr-text-muted">Fecha de inicio</span>
              <input type="date" value={d.start_date} onChange={(e) => poner('start_date', e.target.value)} className={CAMPO} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-zr-text-muted">Estado</span>
              <Select value={d.status} onChange={(e) => poner('status', e.target.value)} className={CAMPO}>
                <option value="activa">Activa</option>
                <option value="suspendida">Suspendida</option>
                <option value="finalizada">Finalizada</option>
              </Select>
            </label>
          </div>
          <div className="space-y-2 rounded-xl border border-zr-border p-3">
            <p className="text-xs font-semibold text-zr-text-muted">Horario de clase (lo usa el calendario general)</p>
            <div className="flex flex-wrap gap-1.5">
              {DIAS.map((x) => {
                const on = d.weekdays.includes(x.n)
                return (
                  <button
                    key={x.n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setD({ ...d, weekdays: on ? d.weekdays.filter((y) => y !== x.n) : [...d.weekdays, x.n] })}
                    className={`min-h-10 min-w-12 rounded-full border px-3 text-xs font-bold ${on ? 'border-zr-blue bg-zr-blue/20 text-zr-text' : 'border-zr-border text-zr-text-muted'}`}
                  >
                    {x.t}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-zr-text-muted">Desde</span>
                <input type="time" value={d.start} onChange={(e) => poner('start', e.target.value)} className={CAMPO} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-zr-text-muted">Hasta</span>
                <input type="time" value={d.end} onChange={(e) => poner('end', e.target.value)} className={CAMPO} />
              </label>
            </div>
          </div>
          <p className="text-xs text-zr-text-muted">
            Cambiar la sede cambia los salones que se pueden elegir. El número del carnet de los estudiantes ya inscritos no se modifica.
          </p>
          {aviso && <p className={`text-sm font-semibold ${aviso.ok ? 'text-zr-success' : 'text-zr-error'}`}>{aviso.texto}</p>}
          <button onClick={guardar} disabled={guardando} className="min-h-11 rounded-xl bg-zr-blue px-6 text-sm font-bold text-white disabled:opacity-40">
            {guardando ? 'Guardando…' : 'Guardar datos del corte'}
          </button>
        </div>
      )}
    </div>
  )
}
