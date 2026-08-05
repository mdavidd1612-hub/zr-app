'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import { generateTOTP } from '@/lib/totp'
import { getQRSecret } from '@/lib/qr-secret'

interface Profile {
  full_name: string
  cedula: string
}

export default function Perfil() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [totp, setTotp] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (prof) {
        setProfile(prof)

        const secret = await getQRSecret(prof.cedula || '')
        if (secret) {
          const codigo = generateTOTP(secret.secret, secret.label)
          setTotp(codigo)
          const qrString = `ZR1|${prof.cedula}|${codigo}`
          const url = await QRCode.toDataURL(qrString, { width: 160 })
          setQrUrl(url)
        }
      }

      setLoading(false)
    }

    loadProfile()
  }, [])

  if (loading) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center">
        <div className="text-zr-text-muted">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <div className="space-y-8 pt-12">
          {/* Header */}
          <div className="space-y-1 animate-fade-in" style={{ animationDelay: '0ms' }}>
            <h1 className="text-3xl font-bold text-zr-text tracking-tight">
              {profile?.full_name || 'Estudiante'}
            </h1>
            <p className="text-sm text-zr-text-muted font-medium">{profile?.cedula}</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-zr-border animate-fade-in" style={{ animationDelay: '100ms' }} />

          {/* Carnet Horizontal */}
          <div className="perspective animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="bg-gradient-to-r from-zr-blue-deep via-zr-blue to-zr-blue-mid rounded-2xl p-6 shadow-xl overflow-hidden relative hover:shadow-2xl transition-all duration-300">
              {/* Background accent */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />

              {/* Carnet content */}
              <div className="relative z-10 flex justify-between items-center gap-6">
                {/* Left side */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/60 uppercase tracking-widest font-semibold mb-3">ZR Academy</p>
                  <h2 className="text-white font-bold text-lg mb-1 truncate">{profile?.full_name}</h2>
                  <p className="text-white/80 text-sm mb-4">{profile?.cedula}</p>

                  <div className="inline-block px-3 py-1.5 rounded-full bg-white/15 border border-white/25 backdrop-blur-sm hover:bg-white/20 transition-colors">
                    <p className="text-xs text-white font-semibold">Estudiante Activo</p>
                  </div>
                </div>

                {/* Right side - QR */}
                {qrUrl && (
                  <div className="flex-shrink-0 hover:scale-105 transition-transform">
                    <div className="bg-white rounded-lg p-2 shadow-lg">
                      <img src={qrUrl} alt="QR" className="w-28 h-28" />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom stripe */}
              <div className="mt-6 pt-4 border-t border-white/20 text-xs text-white/70 font-medium">
                Código: <span className="font-mono text-white/90 ml-1">{totp}</span>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-zr-blue-mid font-bold tracking-widest">02 — COMPETENCIAS</span>
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

          {/* Divider */}
          <div className="h-px bg-zr-border animate-fade-in" style={{ animationDelay: '250ms' }} />

          {/* Logout */}
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="w-full bg-zr-error/15 text-zr-error rounded-lg p-4 font-semibold border border-zr-error/30 hover:bg-zr-error/25 transition-all duration-200 animate-fade-in hover:translate-y-[-2px]"
            style={{ animationDelay: '300ms' }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
