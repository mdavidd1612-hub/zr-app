import 'server-only'
import { createClient } from '@/lib/supabase/server'

// Lee el perfil de quien tiene la sesión abierta, SIEMPRE desde el servidor.
// Nunca confíes en un rol que venga del navegador: el cliente puede escribir
// lo que quiera en su propio estado.
//
// Está separado de `lib/auth-helpers.ts` porque aquello se importa desde
// componentes de navegador y esto no puede: usa `next/headers`.
export async function getSessionProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, role, full_name, cedula, avatar_url, status')
    .eq('id', user.id)
    .single()

  return data
}
