import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// PELIGRO: este cliente ignora Row Level Security.
// Úsalo únicamente en rutas de servidor y solo cuando la operación ya validó
// que quien la pide tiene permiso. Jamás lo importes en un componente cliente.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
