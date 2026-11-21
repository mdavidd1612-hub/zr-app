'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Crear un curso corto (20-nov-2026, migración 237, `crear_curso`).
 * Un curso es un programa de un solo módulo: después se le abre un corte con
 * "+ Nueva" igual que a PTMA/PFTA, y se inscribe, se asigna profesor, se toma
 * asistencia y se ponen notas como en cualquier corte.
 */

const CAMPO = 'w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none'

export function NuevoCurso({ onCreado }: { onCreado: (p: { id: string; name: string; tipo: string }) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([])
  const [nombre, setNombre] = useState('')
  const [siglas, setSiglas] = useState('')
  const [sede, setSede] = useState('')
  const [semanas, setSemanas] = useState('8')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    void createClient().from('sedes').select('id, nombre').eq('activa', true).order('nombre')
      .then(({ data }) => { setSedes(data ?? []); if (data?.[0]) setSede(data[0].id) })
  }, [])

  const siglasOk = /^[A-Z]{3,5}$/.test(siglas)

  async function crear() {
    setError(null)
    if (!nombre.trim()) { setError('Pon el nombre del curso.'); return }
    if (!siglasOk) { setError('Las siglas son de 3 a 5 letras, sin números ni espacios (ej. MOTO).'); return }
    if (!sede) { setError('Elige la sede.'); return }
    setOcupado(true)
    const { data, error: e } = await createClient().rpc('crear_curso' as never, {
      p_nombre: nombre.trim(), p_siglas: siglas, p_sede: sede, p_semanas: Number(semanas) || 0, p_descripcion: descripcion || null,
    } as never) as { data: string | null; error: { message: string; code?: string } | null }
    setOcupado(false)
    if (e || !data) {
      setError(e?.code === '23505' ? 'Ya existe un programa o curso con ese nombre o esas siglas.' : (e?.message ?? 'No se pudo crear.'))
      return
    }
    onCreado({ id: data, name: nombre.trim(), tipo: 'curso' })
    setNombre(''); setSiglas(''); setDescripcion(''); setAbierto(false)
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="min-h-11 rounded-lg border border-zr-blue/60 px-5 text-sm font-bold text-zr-text">
        + Curso corto
      </button>
    )
  }

  return (
    <div className="zr-card space-y-4 p-6">
      <div>
        <p className="text-sm font-bold text-zr-text">Nuevo curso corto</p>
        <p className="mt-1 text-xs text-zr-text-muted">
          Funciona igual que un programa, pero con un solo módulo. Después de crearlo, ábrele un corte con &quot;+ Nueva&quot;,
          asígnale el profesor e inscribe a los estudiantes como siempre.
        </p>
      </div>
      <input placeholder="Nombre (ej. Mecánica de motos)" value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-zr-text-muted">Siglas del carnet</span>
          <input placeholder="MOTO" maxLength={5} value={siglas} onChange={(e) => setSiglas(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} className={CAMPO} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-zr-text-muted">Sede</span>
          <select value={sede} onChange={(e) => setSede(e.target.value)} className={CAMPO}>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-zr-text-muted">Duración (semanas)</span>
          <input type="number" min={1} max={52} value={semanas} onChange={(e) => setSemanas(e.target.value)} className={CAMPO} />
        </label>
      </div>
      <textarea placeholder="De qué trata (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className={CAMPO} />
      {error && <p className="rounded-lg bg-zr-error/10 px-3 py-2 text-sm font-semibold text-zr-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void crear()} disabled={ocupado} className="min-h-11 rounded-lg bg-zr-blue px-5 text-sm font-bold text-white disabled:opacity-50">
          {ocupado ? 'Creando…' : 'Crear curso'}
        </button>
        <button onClick={() => setAbierto(false)} className="min-h-11 rounded-lg border border-zr-border px-5 text-sm font-bold text-zr-text">Cancelar</button>
      </div>
    </div>
  )
}
