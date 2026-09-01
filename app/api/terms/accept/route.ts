import { createClient as createServerClient } from '@/lib/supabase/server'

// B-1 (docs/18_BRECHAS_SPEC_FUNCIONAL_ZRM.md, spec §20): registrar la
// aceptación de términos con IP requiere el request del servidor — el
// navegador no puede reportar su propia IP pública de forma confiable.
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { data: version } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'terms.version')
    .single()

  const termsVersion = Number(version?.value ?? 1)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  const { error } = await supabase.from('terms_acceptances').insert({
    user_id: user.id,
    terms_version: termsVersion,
    ip_address: ip,
  })

  // Ya aceptó esta versión antes (unique user_id+terms_version) — no es un
  // error real, solo confirma que ya está al día.
  if (error && error.code !== '23505') {
    return Response.json({ error: 'No se pudo registrar la aceptación' }, { status: 400 })
  }

  return Response.json({ ok: true, termsVersion })
}
