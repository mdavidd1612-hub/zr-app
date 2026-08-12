'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Estado = 'pendiente' | 'aprobado' | 'rechazado' | 'sin_solicitud'

const MENSAJE: Record<Estado, { titulo: string; texto: string }> = {
  pendiente: {
    titulo: 'Tu solicitud está en revisión',
    texto: 'Dirección Académica va a revisar tus datos y asignarte un curso. Te avisamos apenas quede lista.',
  },
  aprobado: {
    titulo: 'Ya eres profesor',
    texto: 'Tu solicitud fue aprobada. Vuelve a entrar para ver tu interfaz de profesor.',
  },
  rechazado: {
    titulo: 'Tu solicitud no fue aprobada',
    texto: 'Si crees que es un error, contacta a la coordinación de la academia.',
  },
  sin_solicitud: {
    titulo: 'No tienes ninguna solicitud',
    texto: 'Vuelve al inicio de sesión y marca "¿Eres un profesor?" antes de entrar.',
  },
}

export default function SolicitudProfesor() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado | null>(null)

  useEffect(() => {
    let vigente = true

    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('professor_applications')
        .select('status')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!vigente) return
      setEstado((data?.status as Estado) ?? 'sin_solicitud')
    }

    cargar()
    return () => { vigente = false }
  }, [router])

  if (!estado) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </main>
    )
  }

  const { titulo, texto } = MENSAJE[estado]

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center bg-zr-bg px-5">
      <div className="w-full space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zr-border bg-zr-surface text-zr-blue text-3xl">
          {estado === 'aprobado' ? '✓' : estado === 'rechazado' ? '✕' : '⏳'}
        </div>
        <h1 className="zr-display text-2xl text-zr-text">{titulo}</h1>
        <p className="text-base text-zr-text-muted">{texto}</p>

        <button
          onClick={async () => {
            const supabase = createClient()
            await supabase.auth.signOut()
            router.push('/login')
          }}
          className="w-full py-4 bg-zr-surface border border-zr-border text-zr-text font-medium text-sm rounded-lg hover:border-zr-blue/50 transition-all"
        >
          Volver al inicio de sesión
        </button>
      </div>
    </main>
  )
}
