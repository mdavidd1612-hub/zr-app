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
          const url = await QRCode.toDataURL(qrString, { width: 200 })
          setQrUrl(url)
        }
      }

      setLoading(false)
    }

    loadProfile()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="animate-spin">⏳</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-dvh bg-zr-background">
      <div className="h-12 bg-zr-background" />

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="space-y-6 pt-6">
          {/* Header */}
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-zr-blue to-zr-blue-deep rounded-full mx-auto flex items-center justify-center text-4xl">
              👤
            </div>
            <h1 className="text-xl font-bold text-zr-text mt-4">{profile?.full_name}</h1>
            <p className="text-sm text-zr-text-muted">{profile?.cedula}</p>
          </div>

          {/* Carnet */}
          <div className="bg-gradient-to-br from-zr-blue/20 to-zr-blue-deep/20 border border-zr-blue/30 rounded-3xl p-6 backdrop-blur-xl">
            <p className="text-xs text-zr-text-muted mb-4">Mi Carnet Digital</p>
            <div className="bg-white/5 rounded-2xl p-4 flex justify-center">
              {qrUrl && (
                <img src={qrUrl} alt="QR" className="w-40 h-40" />
              )}
            </div>
            <p className="text-center text-xs text-zr-text-muted mt-4">Código: {totp}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-zr-green">✓</p>
              <p className="text-xs text-zr-text-muted mt-2">Dominadas</p>
            </div>
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-zr-warning">◐</p>
              <p className="text-xs text-zr-text-muted mt-2">En progreso</p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="w-full bg-zr-error/20 text-zr-error rounded-2xl p-4 font-semibold border border-zr-error/30"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
