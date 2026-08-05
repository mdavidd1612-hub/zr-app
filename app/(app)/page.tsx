'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (profile) setNombre(profile.full_name)
    }

    getUser()
  }, [])

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      {/* Status bar spacing */}
      <div className="h-12" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <div className="space-y-6 pt-4">
          {/* Greeting */}
          <div>
            <h1 className="text-3xl font-bold text-zr-text">
              Hola, {nombre || 'Estudiante'}
            </h1>
            <p className="text-sm text-zr-text-muted mt-2">Bienvenido a ZR Academy</p>
          </div>

          {/* Quick actions - Card style */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/perfil')}
              className="w-full bg-gradient-to-r from-zr-blue-deep to-zr-blue text-white rounded-2xl p-4 text-left font-semibold hover:shadow-lg transition-all"
            >
              <span className="block text-sm">Mi Carnet</span>
              <span className="text-xs text-white/70">Ver código QR</span>
            </button>
            <button
              onClick={() => router.push('/clases')}
              className="w-full bg-zr-surface border border-zr-border text-zr-text rounded-2xl p-4 text-left font-semibold hover:border-zr-blue/50 transition-all"
            >
              <span className="block text-sm">Mis Clases</span>
              <span className="text-xs text-zr-text-muted">Próximas sesiones</span>
            </button>
            <button
              onClick={() => router.push('/examenes')}
              className="w-full bg-zr-surface border border-zr-border text-zr-text rounded-2xl p-4 text-left font-semibold hover:border-zr-blue/50 transition-all"
            >
              <span className="block text-sm">Exámenes</span>
              <span className="text-xs text-zr-text-muted">Mis evaluaciones</span>
            </button>
            <button
              onClick={() => router.push('/contenido')}
              className="w-full bg-zr-surface border border-zr-border text-zr-text rounded-2xl p-4 text-left font-semibold hover:border-zr-blue/50 transition-all"
            >
              <span className="block text-sm">Material</span>
              <span className="text-xs text-zr-text-muted">Recursos de estudio</span>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-zr-surface border border-zr-border rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-zr-blue">0</p>
              <p className="text-xs text-zr-text-muted mt-2">Dominadas</p>
            </div>
            <div className="bg-zr-surface border border-zr-border rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-zr-blue-mid">0</p>
              <p className="text-xs text-zr-text-muted mt-2">En progreso</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
