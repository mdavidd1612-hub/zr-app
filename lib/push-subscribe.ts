import { createClient } from '@/lib/supabase/client'

/**
 * T-408 · Suscripción a Web Push.
 *
 * La clave pública VAPID viaja en claro en el navegador a propósito — es la
 * mitad pública del par de llaves, exactamente como una clave anon. La
 * privada solo la tiene la Edge Function send-push.
 */

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Segura = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Segura)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function soportaPush(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function estaSuscrito(): Promise<boolean> {
  if (!soportaPush()) return false
  const registro = await navigator.serviceWorker.ready
  const sub = await registro.pushManager.getSubscription()
  return sub !== null
}

export async function suscribirPush(): Promise<{ ok: boolean; error?: string }> {
  if (!soportaPush()) return { ok: false, error: 'Este navegador no admite notificaciones.' }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return { ok: false, error: 'Necesitas permitir las notificaciones.' }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) return { ok: false, error: 'Notificaciones no configuradas.' }

  const registro = await navigator.serviceWorker.ready
  const sub = await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
  })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesión expirada.' }

  const claves = sub.toJSON().keys
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      profile_id: user.id,
      endpoint: sub.endpoint,
      p256dh: claves?.p256dh ?? '',
      auth: claves?.auth ?? '',
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  )

  if (error) return { ok: false, error: 'No se pudo guardar la suscripción.' }
  return { ok: true }
}
