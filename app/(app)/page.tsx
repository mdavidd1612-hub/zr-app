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
    <div className="flex flex-col h-dvh bg-zr-background">
      {/* Status bar spacing */}
      <div className="h-12 bg-zr-background" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="space-y-6 pt-6">
          <div>
            <h1 className="text-2xl font-bold text-zr-text">Hola, {nombre || 'Estudiante'} 👋</h1>
            <p className="text-sm text-zr-text-muted mt-1">Bienvenido a ZR App</p>
          </div>

          {/* Quick actions */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/carnet')}
              className="w-full bg-gradient-to-r from-zr-blue to-zr-blue-deep text-white rounded-2xl p-4 text-left font-semibold shadow-lg"
            >
              📱 Mi Carnet
            </button>
            <button
              onClick={() => router.push('/clases')}
              className="w-full bg-white/10 backdrop-blur-xl border border-white/20 text-zr-text rounded-2xl p-4 text-left font-semibold"
            >
              📚 Mis Clases
            </button>
            <button
              onClick={() => router.push('/examenes')}
              className="w-full bg-white/10 backdrop-blur-xl border border-white/20 text-zr-text rounded-2xl p-4 text-left font-semibold"
            >
              ✅ Exámenes
            </button>
            <button
              onClick={() => router.push('/contenido')}
              className="w-full bg-white/10 backdrop-blur-xl border border-white/20 text-zr-text rounded-2xl p-4 text-left font-semibold"
            >
              📖 Material
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-zr-blue">0</p>
              <p className="text-xs text-zr-text-muted mt-1">Competencias dominadas</p>
            </div>
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-zr-warning">0</p>
              <p className="text-xs text-zr-text-muted mt-1">En progreso</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom navbar - Instagram style */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zr-background border-t border-white/10 px-4 py-3 flex justify-around">
        <NavIcon label="Inicio" icon="🏠" active href="/" />
        <NavIcon label="Clases" icon="📚" href="/clases" />
        <NavIcon label="Examen" icon="✅" href="/examenes" />
        <NavIcon label="Perfil" icon="👤" href="/perfil" />
      </nav>
    </div>
  )
}

function NavIcon({
  label,
  icon,
  active,
  href,
}: {
  label: string
  icon: string
  active?: boolean
  href: string
}) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push(href)}
      className={`flex flex-col items-center gap-1 py-2 ${
        active ? 'text-zr-blue' : 'text-zr-text-muted'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}
