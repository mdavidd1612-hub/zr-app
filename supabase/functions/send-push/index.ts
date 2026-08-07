import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

/**
 * FUNCIÓN 7 · send-push (spec/03_EDGE_FUNCTIONS.md)
 *
 * Disparo: pg_cron cada 5 minutos. NO la llama el navegador — por eso no
 * valida un token de usuario como las demás funciones, solo usa el
 * service_role.
 *
 * Toma las notificaciones con sent_at is null y channel = 'push', las manda
 * por Web Push, y marca sent_at. Si una suscripción devuelve 404/410, el
 * dispositivo ya no existe y se borra en vez de reintentar para siempre.
 */

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

webpush.setVapidDetails(
  'mailto:soporte@zrmecademy.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  const supabase = adminClient()

  const { data: pendientes, error: falloConsulta } = await supabase
    .from('notifications')
    .select('id, profile_id, title, body, payload')
    .is('sent_at', null)
    .eq('channel', 'push')
    .limit(100)

  if (falloConsulta) {
    console.error('send-push: no se pudo leer notifications', falloConsulta.code)
    return new Response(JSON.stringify({ error: { code: 'ERROR_INTERNO', message: 'No se pudo leer notificaciones' } }), { status: 500 })
  }

  let enviadas = 0
  let suscripcionesBorradas = 0

  for (const noti of pendientes ?? []) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('profile_id', noti.profile_id)

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title: noti.title, body: noti.body, payload: noti.payload }),
        )
        enviadas++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          suscripcionesBorradas++
        } else {
          console.error('send-push: fallo al enviar', status ?? 'sin código')
        }
      }
    }

    await supabase.from('notifications').update({ sent_at: new Date().toISOString() }).eq('id', noti.id)
  }

  return new Response(
    JSON.stringify({ ok: true, procesadas: pendientes?.length ?? 0, enviadas, suscripcionesBorradas }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
