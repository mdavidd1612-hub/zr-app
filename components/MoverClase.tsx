'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Mover una clase desde el calendario general (parte 2, 20-nov-2026;
 * migración 234, `fn_mover_clase`).
 *
 * Reglas del coordinador:
 *  - A otra semana posterior: se corren esa clase y todas las siguientes del
 *    corte (el módulo termina después y los siguientes empiezan después).
 *  - Dentro de la misma semana (reposición): se mueve solo esa.
 *  - "No hay clase este día": se corre la cadena una semana.
 * Siempre se muestra primero "Qué va a cambiar" (la base lo simula y lo
 * deshace) y recién al confirmar se guarda y se avisa a estudiantes y profesor.
 */

interface Props {
  cohortId: string
  fecha: string            // YYYY-MM-DD
  horaInicio: string | null
  horaFin: string | null
  sede: string | null
  onListo: () => void
}

interface Tramo { modulo: string; desde: string; hasta: string }
interface Resumen {
  cadena: boolean; clases: number; fecha_nueva: string
  antes: Tramo[]; despues: Tramo[]
  fin_antes: string | null; fin_despues: string | null
  choques: { corte: string; hora: string; motivo: string }[]
}

const CAMPO = 'min-h-11 w-full rounded-xl border border-zr-border bg-zr-bg px-3 text-sm text-zr-text'
const f = (s: string | null) => s ? new Date(`${s}T12:00:00`).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const masDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export function MoverClase({ cohortId, fecha, horaInicio, horaFin, sede, onListo }: Props) {
  const [nueva, setNueva] = useState(masDias(fecha, 7))
  const [ini, setIni] = useState((horaInicio ?? '').slice(0, 5))
  const [fin, setFin] = useState((horaFin ?? '').slice(0, 5))
  const [salon, setSalon] = useState('')
  const [salones, setSalones] = useState<{ id: string; nombre: string }[]>([])
  const [motivo, setMotivo] = useState('')
  const [sinClase, setSinClase] = useState(false)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void (async () => {
      const { data: s } = await supabase.from('sedes').select('id').eq('nombre', sede ?? '').maybeSingle()
      if (!s) return
      const { data } = await supabase.from('rooms' as never).select('id, nombre').eq('sede_id', s.id).order('nombre')
      setSalones((data ?? []) as unknown as { id: string; nombre: string }[])
    })()
  }, [sede])

  // Al cambiar algo, el resumen anterior ya no vale.
  useEffect(() => { setResumen(null) }, [nueva, ini, fin, salon, sinClase])

  async function llamar(simular: boolean) {
    setOcupado(true); setError(null)
    const cambioHora = ini !== (horaInicio ?? '').slice(0, 5) || fin !== (horaFin ?? '').slice(0, 5)
    const { data, error: e } = await createClient().rpc('fn_mover_clase' as never, {
      p_cohort: cohortId,
      p_fecha: fecha,
      p_nueva: sinClase ? null : nueva,
      p_inicio: !sinClase && cambioHora && ini ? ini : null,
      p_fin: !sinClase && cambioHora && fin ? fin : null,
      p_room: !sinClase && salon ? salon : null,
      p_motivo: motivo.trim() || null,
      p_simular: simular,
    } as never) as { data: Resumen | null; error: { message: string } | null }
    setOcupado(false)
    if (e) { setError(e.message); return }
    if (simular) setResumen(data)
    else { setHecho(true); onListo() }
  }

  if (hecho) {
    return <p className="rounded-xl bg-zr-success/10 px-3 py-3 text-sm font-semibold text-zr-success">Listo. Se avisó a los estudiantes y al profesor.</p>
  }

  return (
    <div className="space-y-3 border-t border-zr-border pt-4">
      <p className="text-sm font-bold text-zr-text">Mover esta clase</p>

      <label className="flex items-center gap-2 text-sm text-zr-text">
        <input type="checkbox" checked={sinClase} onChange={(e) => setSinClase(e.target.checked)} className="h-5 w-5" />
        No hay clase este día (se corre todo una semana)
      </label>

      {!sinClase && (
        <>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-zr-text-muted">Nueva fecha</span>
            <input type="date" value={nueva} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setNueva(e.target.value)} className={CAMPO} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-zr-text-muted">Desde</span>
              <input type="time" value={ini} onChange={(e) => setIni(e.target.value)} className={CAMPO} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-zr-text-muted">Hasta</span>
              <input type="time" value={fin} onChange={(e) => setFin(e.target.value)} className={CAMPO} />
            </label>
          </div>
          {salones.length > 0 && (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-zr-text-muted">Salón</span>
              <select value={salon} onChange={(e) => setSalon(e.target.value)} className={CAMPO}>
                <option value="">El de siempre</option>
                {salones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
          )}
        </>
      )}

      <label className="block space-y-1">
        <span className="text-xs font-semibold text-zr-text-muted">Motivo (le llega a los estudiantes)</span>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. feriado, reposición" className={CAMPO} />
      </label>

      {error && <p className="rounded-xl bg-zr-error/10 px-3 py-2 text-xs font-semibold text-zr-error">{error}</p>}

      {resumen && (
        <div className="space-y-2 rounded-xl border border-zr-border bg-zr-bg/60 p-3 text-sm">
          <p className="font-bold text-zr-text">Qué va a cambiar</p>
          {resumen.cadena ? (
            <>
              <p className="text-zr-text">
                Se corren <b>{resumen.clases}</b> clases {resumen.fecha_nueva && `desde el ${f(resumen.fecha_nueva)}`}.
                El corte termina el <b>{f(resumen.fin_despues)}</b> (antes {f(resumen.fin_antes)}).
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-zr-text-muted">
                {resumen.despues.slice(0, 6).map((t, i) => (
                  <li key={i}><span className="text-zr-text">{t.modulo}</span>: {f(t.desde)} – {f(t.hasta)}</li>
                ))}
                {resumen.despues.length > 6 && <li>… y {resumen.despues.length - 6} tramos más</li>}
              </ul>
            </>
          ) : (
            <p className="text-zr-text">Solo se mueve esta clase, al <b>{f(resumen.fecha_nueva)}</b>. Las demás quedan igual.</p>
          )}
          {resumen.choques.length > 0 && (
            <p className="rounded-lg bg-zr-error/10 px-2 py-1.5 text-xs font-semibold text-zr-error">
              Choca con {resumen.choques.map((c) => `${c.corte} (${c.hora}, ${c.motivo})`).join('; ')}. Puedes mover igual.
            </p>
          )}
        </div>
      )}

      {resumen ? (
        <button onClick={() => llamar(false)} disabled={ocupado} className="min-h-12 w-full rounded-xl bg-zr-blue text-sm font-bold text-white disabled:opacity-50">
          {ocupado ? 'Guardando…' : 'Confirmar y avisar'}
        </button>
      ) : (
        <button onClick={() => llamar(true)} disabled={ocupado || (!sinClase && !nueva)} className="min-h-12 w-full rounded-xl border border-zr-blue/60 text-sm font-bold text-zr-text disabled:opacity-50">
          {ocupado ? 'Calculando…' : 'Ver qué va a cambiar'}
        </button>
      )}
    </div>
  )
}
