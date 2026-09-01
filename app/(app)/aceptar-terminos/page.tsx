'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'

// B-1 (docs/18_BRECHAS_SPEC_FUNCIONAL_ZRM.md, spec §20): casilla obligatoria
// y NO premarcada, con el texto completo visible antes de poder aceptar.
// Si sube system_config['terms.version'], todos vuelven a caer aquí en su
// próximo ingreso (el gate está en (app)/layout.tsx).
export default function AceptarTerminos() {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [marcado, setMarcado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('system_config').select('value').eq('key', 'terms.text').maybeSingle()

      setTexto((data?.value as string) ?? 'No se pudo cargar el texto. Intenta de nuevo.')
      setCargando(false)
    }

    cargar()
  }, [router])

  async function aceptar() {
    setEnviando(true)
    setError(null)

    const res = await fetch('/api/terms/accept', { method: 'POST' })
    if (!res.ok) {
      setError('No se pudo registrar tu aceptación. Intenta de nuevo.')
      setEnviando(false)
      return
    }

    router.replace('/')
    router.refresh()
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-5 pb-32 pt-14">
      <Encabezado
        sobretitulo="Antes de seguir"
        titulo="Términos y condiciones"
        descripcion="Léelos completos antes de aceptar."
      />
      <Regla delay={60} />

      <div className="zr-card max-h-[50vh] overflow-y-auto whitespace-pre-line p-5 text-sm leading-relaxed text-zr-text-muted">
        {texto}
      </div>

      <label className="zr-card flex cursor-pointer items-start gap-3 p-5">
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => setMarcado(e.target.checked)}
          className="mt-0.5 size-5 shrink-0"
        />
        <span className="text-sm font-medium text-zr-text">
          He leído y acepto los Términos y Condiciones de ZR Mecademy.
        </span>
      </label>

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm text-zr-error">
          {error}
        </p>
      )}

      <button
        onClick={aceptar}
        disabled={!marcado || enviando}
        className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {enviando ? 'Guardando…' : 'Aceptar y continuar'}
      </button>
    </div>
  )
}
