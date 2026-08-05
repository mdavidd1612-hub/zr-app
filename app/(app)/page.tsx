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
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <div className="space-y-8 pt-12">
          {/* Greeting */}
          <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0ms' }}>
            <h1 className="text-4xl font-bold text-zr-text tracking-tight">
              {nombre || 'Estudiante'}
            </h1>
            <p className="text-sm text-zr-text-muted font-medium">Bienvenido a ZR Academy</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-zr-border animate-fade-in" style={{ animationDelay: '100ms' }} />

          {/* Main Actions */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: '150ms' }}>
            <button
              onClick={() => router.push('/perfil')}
              className="w-full group bg-gradient-to-r from-zr-blue-deep to-zr-blue text-white rounded-lg p-5 text-left hover:shadow-md transition-all duration-300 hover:translate-y-[-2px]"
            >
              <span className="block text-base font-semibold group-hover:translate-x-1 transition-transform">Mi Carnet</span>
              <span className="text-sm text-white/70 group-hover:text-white/80">Ver código QR y detalles</span>
            </button>
          </div>

          {/* Secondary Actions - Grid */}
          <div className="grid grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <button
              onClick={() => router.push('/clases')}
              className="bg-zr-surface border border-zr-border text-zr-text rounded-lg p-4 text-center hover:border-zr-blue/50 hover:bg-zr-surface/80 transition-all duration-200 hover:translate-y-[-2px]"
            >
              <span className="block text-sm font-semibold">Clases</span>
              <span className="text-xs text-zr-text-muted mt-1">Próximas sesiones</span>
            </button>
            <button
              onClick={() => router.push('/examenes')}
              className="bg-zr-surface border border-zr-border text-zr-text rounded-lg p-4 text-center hover:border-zr-blue/50 hover:bg-zr-surface/80 transition-all duration-200 hover:translate-y-[-2px]"
            >
              <span className="block text-sm font-semibold">Exámenes</span>
              <span className="text-xs text-zr-text-muted mt-1">Evaluaciones</span>
            </button>
          </div>

          {/* Material Link */}
          <button
            onClick={() => router.push('/contenido')}
            className="w-full bg-zr-surface border border-zr-border text-zr-text rounded-lg p-4 text-left hover:border-zr-blue/50 hover:bg-zr-surface/80 transition-all duration-200 animate-fade-in hover:translate-y-[-2px]"
            style={{ animationDelay: '250ms' }}
          >
            <span className="block text-sm font-semibold">Material de Estudio</span>
            <span className="text-xs text-zr-text-muted mt-1">Recursos y documentos</span>
          </button>

          {/* Stats - Section with number prefix */}
          <div className="space-y-4 pt-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-zr-blue-mid font-bold tracking-widest">01 — PROGRESO</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zr-surface border border-zr-border rounded-lg p-5 text-center hover:border-zr-blue/30 transition-all hover:translate-y-[-2px]">
                <p className="text-3xl font-bold text-zr-blue">0</p>
                <p className="text-xs text-zr-text-muted mt-3 font-medium">Dominadas</p>
              </div>
              <div className="bg-zr-surface border border-zr-border rounded-lg p-5 text-center hover:border-zr-blue/30 transition-all hover:translate-y-[-2px]">
                <p className="text-3xl font-bold text-zr-blue-mid">0</p>
                <p className="text-xs text-zr-text-muted mt-3 font-medium">En Progreso</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
