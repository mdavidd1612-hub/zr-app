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

        // Generate QR
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
      <div className="flex items-center justify-center h-dvh bg-zr-background">
        <div className="text-zr-text-muted">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-zr-background min-h-dvh">
      <div className="h-12" />

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <div className="space-y-6 pt-4">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-zr-text">{profile?.full_name || 'Estudiante'}</h1>
            <p className="text-sm text-zr-text-muted mt-1">{profile?.cedula}</p>
          </div>

          {/* Carnet Horizontal - Modern Digital Card */}
          <div className="perspective">
            <div className="bg-gradient-to-r from-zr-blue-deep via-zr-blue to-zr-blue-mid rounded-3xl p-6 shadow-2xl overflow-hidden relative">
              {/* Background accent */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />

              {/* Carnet content - horizontal layout */}
              <div className="relative z-10 flex justify-between items-center gap-6">
                {/* Left side - Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/60 uppercase tracking-widest mb-3">ZR Academy</p>
                  <h2 className="text-white font-bold text-lg mb-2 truncate">{profile?.full_name}</h2>
                  <p className="text-white/80 text-sm mb-4">{profile?.cedula}</p>

                  {/* Badge */}
                  <div className="inline-block px-3 py-1 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm">
                    <p className="text-xs text-white font-medium">Estudiante Activo</p>
                  </div>
                </div>

                {/* Right side - QR */}
                {qrUrl && (
                  <div className="flex-shrink-0">
                    <div className="bg-white rounded-xl p-2 shadow-lg">
                      <img src={qrUrl} alt="QR" className="w-28 h-28" />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom stripe */}
              <div className="mt-6 pt-4 border-t border-white/20 text-xs text-white/70">
                Código: <span className="font-mono text-white">{totp}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zr-surface border border-zr-border rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-zr-blue">0</p>
              <p className="text-xs text-zr-text-muted mt-2">Dominadas</p>
            </div>
            <div className="bg-zr-surface border border-zr-border rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-zr-blue-mid">0</p>
              <p className="text-xs text-zr-text-muted mt-2">En progreso</p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="w-full bg-zr-error/20 text-zr-error rounded-2xl p-4 font-semibold border border-zr-error/30 hover:bg-zr-error/30 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
