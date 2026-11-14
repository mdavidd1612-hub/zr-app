import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Google Fotos no ofrece un embed público: el link compartido (photos.app.goo.gl/...)
 * es una página web. Aquí, en el servidor, se lee esa página y se saca la dirección
 * de la imagen (og:image) para poder mostrarla DENTRO de la app. Solo con sesión
 * iniciada y solo para los dominios de Google Fotos (no es un proxy abierto).
 */
const HOSTS_PAGINA = new Set(['photos.app.goo.gl', 'photos.google.com', 'goo.gl'])

function hostValido(h: string, lista: Set<string>): boolean {
  return lista.has(h)
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'no_auth' }, { status: 401 })

  const crudo = req.nextUrl.searchParams.get('url') ?? ''
  let url: URL
  try { url = new URL(crudo) } catch { return NextResponse.json({ error: 'url_invalida' }, { status: 400 }) }
  if (url.protocol !== 'https:' || !hostValido(url.hostname, HOSTS_PAGINA)) {
    return NextResponse.json({ error: 'dominio_no_permitido' }, { status: 400 })
  }

  try {
    const r = await fetch(url.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZRApp/1.0)', 'Accept-Language': 'es' },
      signal: AbortSignal.timeout(8000),
    })
    // Tras seguir las redirecciones, la página final también tiene que ser de Google Fotos.
    const final = new URL(r.url)
    if (!hostValido(final.hostname, HOSTS_PAGINA)) {
      return NextResponse.json({ error: 'redireccion_no_permitida' }, { status: 400 })
    }
    const html = (await r.text()).slice(0, 400_000)
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (!m) return NextResponse.json({ error: 'sin_imagen' }, { status: 404 })

    const src = new URL(m[1].replace(/&amp;/g, '&'))
    if (src.protocol !== 'https:' || !src.hostname.endsWith('googleusercontent.com')) {
      return NextResponse.json({ error: 'imagen_no_permitida' }, { status: 400 })
    }
    // Pide una versión grande (el og:image viene en miniatura).
    const grande = src.toString().replace(/=[wsh][^=?#]*$/, '=w2000')
    return NextResponse.json({ src: grande })
  } catch {
    return NextResponse.json({ error: 'no_se_pudo_leer' }, { status: 502 })
  }
}
