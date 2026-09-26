'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * "General - Por Módulo" -- pedido explícito del coordinador (sept. 2026).
 * Dirección Académica solo define AQUÍ el nombre de campos evaluativos
 * extra (más allá de Teoría/Práctica/Participación, que ya existen desde
 * la migración 005 y no se tocan). NUNCA un valor por estudiante -- eso lo
 * llena el profesor, en su propia pantalla de Notas.
 */

interface Campo {
  id: string
  key: string
  label: string
}

function aKey(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default function CamposEvaluativos() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [campos, setCampos] = useState<Campo[]>([])
  const [nuevoLabel, setNuevoLabel] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      const { data } = await supabase.from('module_evaluation_field_defs').select('id, key, label').order('created_at')
      if (!vigente) return
      setCampos(data ?? [])
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  async function agregarCampo() {
    const label = nuevoLabel.trim()
    if (!label) return
    const key = aKey(label)
    if (!key) {
      setError('Ese nombre no se puede convertir en un campo válido.')
      return
    }

    setGuardando(true)
    setError(null)
    const supabase = createClient()
    const { data, error: fallo } = await supabase
      .from('module_evaluation_field_defs')
      .insert({ key, label })
      .select('id, key, label')
      .single()

    if (fallo) {
      setError(fallo.code === '23505' ? 'Ya existe un campo con ese nombre.' : fallo.message)
      setGuardando(false)
      return
    }

    setCampos((c) => [...c, data])
    setNuevoLabel('')
    setGuardando(false)
  }

  async function borrarCampo(id: string) {
    const supabase = createClient()
    const { error: fallo } = await supabase.from('module_evaluation_field_defs').delete().eq('id', id)
    if (!fallo) setCampos((c) => c.filter((campo) => campo.id !== id))
  }

  if (autorizado === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg px-5 text-center">
        <p className="text-sm text-zr-text-muted">Esta pantalla es solo para Dirección Académica.</p>
      </div>
    )
  }

  if (autorizado === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-5 pt-14 pb-10">
      <BotonVolver href="/notas-academicas" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
          Dirección Académica
        </p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">General - Por Módulo</h1>
        <p className="mt-2 text-sm text-zr-text-muted">
          Teoría, Práctica y Participación ya existen y no se editan aquí. Agrega otros campos si
          hace falta evaluar algo más — el profesor es quien pone la nota de cada estudiante en
          estos campos, no tú.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      <div className="zr-card space-y-3 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-zr-text-muted">Campos fijos</p>
        <div className="flex flex-wrap gap-2">
          {['Teoría', 'Práctica', 'Participación'].map((f) => (
            <span key={f} className="rounded-full border border-zr-border px-3 py-1.5 text-xs font-semibold text-zr-text-muted">
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="zr-card space-y-3 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-zr-text-muted">Campos extra</p>
        {campos.length === 0 ? (
          <p className="text-sm text-zr-text-muted">Todavía no hay campos extra.</p>
        ) : (
          <div className="divide-y divide-zr-border">
            {campos.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3">
                <span className="text-sm font-semibold text-zr-text">{c.label}</span>
                <button onClick={() => borrarCampo(c.id)} className="text-xs font-bold text-zr-error">
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <input
            value={nuevoLabel}
            onChange={(e) => setNuevoLabel(e.target.value)}
            placeholder="Ej. Puntualidad"
            className="min-w-0 flex-1 rounded-lg border border-zr-border bg-zr-bg px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
          />
          <button
            onClick={agregarCampo}
            disabled={guardando || !nuevoLabel.trim()}
            className="shrink-0 rounded-lg bg-zr-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {guardando ? '…' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}
