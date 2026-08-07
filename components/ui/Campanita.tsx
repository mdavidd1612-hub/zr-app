'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { IconoCampana, IconoCerrar } from '@/components/ui/Iconos'

/**
 * T-409 · Campanita de notificaciones, compartida por los 3 roles.
 *
 * Solo lee `notifications` (canal in_app o ya enviado por push) — no
 * gestiona la suscripción push en sí, eso vive en cada pantalla de perfil
 * porque pedir permiso del navegador es una acción explícita del usuario,
 * no algo que deba pasar solo con abrir la campanita.
 */

interface Notificacion {
  id: string
  titulo: string
  cuerpo: string
  leida: boolean
  creada: string
  payload: Record<string, unknown> | null
}

function hace(iso: string): string {
  const horas = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (horas < 1) return 'hace minutos'
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.floor(horas / 24)} d`
}

export function Campanita() {
  const router = useRouter()
  const [abierta, setAbierta] = useState(false)
  const [notis, setNotis] = useState<Notificacion[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('notifications')
        .select('id, title, body, read_at, created_at, payload')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!vigente) return

      setNotis(
        (data ?? []).map((n) => ({
          id: n.id,
          titulo: n.title,
          cuerpo: n.body,
          leida: n.read_at !== null,
          creada: n.created_at,
          payload: n.payload as Record<string, unknown> | null,
        })),
      )
      setCargando(false)
    }

    cargar()
    // Refresco periódico simple: no hay realtime aquí, y cada 60s es
    // suficiente para algo que no es un chat.
    const intervalo = setInterval(cargar, 60_000)
    return () => { vigente = false; clearInterval(intervalo) }
  }, [])

  const sinLeer = notis.filter((n) => !n.leida).length

  async function abrirNoti(n: Notificacion) {
    if (!n.leida) {
      await createClient().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
      setNotis((xs) => xs.map((x) => (x.id === n.id ? { ...x, leida: true } : x)))
    }

    setAbierta(false)
    const examId = n.payload?.exam_id as string | undefined
    if (examId) router.push(`/examenes/${examId}`)
  }

  return (
    <>
      <button
        onClick={() => setAbierta(true)}
        aria-label="Notificaciones"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-zr-text-muted transition-colors active:bg-zr-border/40"
      >
        <IconoCampana size={22} />
        {sinLeer > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-zr-error" />
        )}
      </button>

      {abierta && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setAbierta(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[75vh] w-full overflow-y-auto rounded-t-2xl border-t border-white/15 bg-zr-surface pb-10 pt-2 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]"
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-zr-border" />

            <div className="flex items-center justify-between px-5 pt-4">
              <p className="text-base font-bold text-zr-text">Notificaciones</p>
              <button
                onClick={() => setAbierta(false)}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zr-text-muted active:bg-zr-border/50"
              >
                <IconoCerrar size={18} />
              </button>
            </div>

            <div className="mt-3 space-y-1 px-3">
              {cargando && (
                <p className="px-2 py-6 text-center text-sm text-zr-text-muted">Cargando…</p>
              )}

              {!cargando && notis.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-zr-text-muted">
                  No tienes notificaciones todavía.
                </p>
              )}

              {notis.map((n) => (
                <button
                  key={n.id}
                  onClick={() => abrirNoti(n)}
                  className={`w-full rounded-lg px-3 py-3 text-left transition-colors ${
                    n.leida ? 'text-zr-text-muted' : 'bg-zr-blue/10 text-zr-text'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">{n.titulo}</p>
                    {!n.leida && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-zr-blue" />}
                  </div>
                  <p className="mt-1 text-sm text-zr-text-muted">{n.cuerpo}</p>
                  <p className="mt-1.5 text-xs text-zr-text-muted">{hace(n.creada)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
