'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import { generateTOTP } from '@/lib/totp'
import { getQRSecret } from '@/lib/qr-secret'

interface CarnetInfo {
  fullName: string
  cedula: string
  cohorte: string
  modulo: string
}

export default function Carnet() {
  const router = useRouter()
  const supabase = createClient()
  const [carnet, setCarnet] = useState<CarnetInfo | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [totp, setTotp] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCarnet() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, cedula')
        .eq('id', user.id)
        .single()

      if (profile) {
        setCarnet({
          fullName: profile.full_name,
          cedula: profile.cedula,
          cohorte: 'Cohorte 2026-A',
          modulo: 'Electricidad Automotriz',
        })

        // Generate QR
        const secret = await getQRSecret(profile.cedula || '')
        if (secret) {
          const codigo = generateTOTP(secret.secret, secret.label)
          setTotp(codigo)
          const qrString = `ZR1|${profile.cedula}|${codigo}`
          const url = await QRCode.toDataURL(qrString, { width: 200 })
          setQrUrl(url)
        }
      }

      setLoading(false)
    }

    loadCarnet()
  }, [])

  if (loading) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-zr-text-muted">Preparando carnet...</p>
        </div>
      </div>
    )
  }

  if (!carnet) {
    return (
      <div className="h-dvh bg-zr-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-zr-error">Error al cargar carnet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh bg-zr-background">
      <div className="h-12 bg-zr-background" />

      <div className="px-4 pt-6 pb-24 space-y-4">
        {/* Carnet card */}
        <div className="bg-gradient-to-br from-zr-blue to-zr-blue-deep rounded-3xl p-6 text-white space-y-4 shadow-lg">
          {/* Header */}
          <div>
            <p className="text-xs opacity-70">ZR MECADEMY</p>
            <h2 className="text-xl font-bold">{carnet.fullName}</h2>
            <p className="text-sm opacity-90">{carnet.cedula}</p>
          </div>

          {/* QR */}
          <div className="bg-white/10 rounded-2xl p-4 flex justify-center">
            {qrUrl && <img src={qrUrl} alt="QR" className="w-40 h-40" />}
          </div>

          {/* Footer */}
          <div className="space-y-2 text-sm">
            <p>
              <span className="opacity-70">Módulo:</span> {carnet.modulo}
            </p>
            <p>
              <span className="opacity-70">Código:</span> {totp}
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-center">
            <p className="text-xs text-zr-text-muted">Cohorte</p>
            <p className="text-sm font-semibold text-zr-text mt-2">{carnet.cohorte}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-center">
            <p className="text-xs text-zr-text-muted">Estado</p>
            <p className="text-sm font-semibold text-zr-green mt-2">Activo</p>
          </div>
        </div>
      </div>
    </div>
  )
}
