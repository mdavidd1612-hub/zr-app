import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * PowerPoint → PDF (18-nov-2026). Un .pptx no se puede mostrar dentro de la app,
 * pero un PDF sí (con zoom, progreso y marca de agua). Aquí, en el servidor, se
 * manda el archivo a CloudConvert y el PDF resultante se guarda al lado del
 * original (`<ruta>.pdf`) para convertir una sola vez por archivo.
 *
 * Seguridad: solo con sesión, y solo si la RLS deja a esa persona leer el
 * material (se consulta con su cliente, no con el de servicio). El cliente de
 * servicio se usa solo para guardar y firmar el PDF convertido.
 *
 * Sin la variable CLOUDCONVERT_API_KEY, o si el servicio falla (por ejemplo, se
 * acabó el cupo gratis del día), responde un error y el visor cae al
 * comportamiento de siempre: abrir en una pestaña aparte.
 */
export const maxDuration = 60

const BUCKET = 'contenido'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'no_auth' }, { status: 401 })

  const { contentItemId } = (await req.json().catch(() => ({}))) as { contentItemId?: string }
  if (!contentItemId) return NextResponse.json({ error: 'falta_id' }, { status: 400 })

  const { data: item } = await supabase
    .from('content_items')
    .select('storage_path, type')
    .eq('id', contentItemId)
    .maybeSingle()
  if (!item?.storage_path || item.type !== 'presentacion') {
    return NextResponse.json({ error: 'no_disponible' }, { status: 404 })
  }

  const admin = createAdminClient()
  const rutaPdf = `${item.storage_path}.pdf`

  // ¿Ya se convirtió antes?
  const previo = await admin.storage.from(BUCKET).createSignedUrl(rutaPdf, 3600)
  if (previo.data?.signedUrl) return NextResponse.json({ url: previo.data.signedUrl })

  const llave = process.env.CLOUDCONVERT_API_KEY
  if (!llave) return NextResponse.json({ error: 'sin_conversor' }, { status: 501 })

  const original = await admin.storage.from(BUCKET).createSignedUrl(item.storage_path, 600)
  if (!original.data?.signedUrl) return NextResponse.json({ error: 'sin_archivo' }, { status: 404 })

  try {
    const cabeceras = { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' }
    const crear = await fetch('https://api.cloudconvert.com/v2/jobs', {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({
        tasks: {
          importar: { operation: 'import/url', url: original.data.signedUrl },
          convertir: { operation: 'convert', input: 'importar', output_format: 'pdf' },
          exportar: { operation: 'export/url', input: 'convertir' },
        },
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!crear.ok) return NextResponse.json({ error: 'conversor_rechazo' }, { status: 502 })
    const trabajo = (await crear.json()) as { data: { id: string } }

    // La versión "sync" espera a que termine el trabajo.
    const fin = await fetch(`https://sync.api.cloudconvert.com/v2/jobs/${trabajo.data.id}`, {
      headers: { Authorization: `Bearer ${llave}` },
      signal: AbortSignal.timeout(50000),
    })
    const resultado = (await fin.json()) as {
      data: { status: string; tasks: { name: string; result?: { files?: { url: string }[] } }[] }
    }
    if (resultado.data.status !== 'finished') return NextResponse.json({ error: 'conversion_fallo' }, { status: 502 })
    const urlPdf = resultado.data.tasks.find((t) => t.name === 'exportar')?.result?.files?.[0]?.url
    if (!urlPdf) return NextResponse.json({ error: 'conversion_fallo' }, { status: 502 })

    const pdf = await fetch(urlPdf, { signal: AbortSignal.timeout(30000) })
    if (!pdf.ok) return NextResponse.json({ error: 'conversion_fallo' }, { status: 502 })
    const bytes = new Uint8Array(await pdf.arrayBuffer())
    const subida = await admin.storage.from(BUCKET).upload(rutaPdf, bytes, { contentType: 'application/pdf', upsert: true })
    if (subida.error) return NextResponse.json({ error: 'no_se_guardo' }, { status: 500 })

    const firmada = await admin.storage.from(BUCKET).createSignedUrl(rutaPdf, 3600)
    if (!firmada.data?.signedUrl) return NextResponse.json({ error: 'no_se_guardo' }, { status: 500 })
    return NextResponse.json({ url: firmada.data.signedUrl })
  } catch {
    return NextResponse.json({ error: 'conversion_fallo' }, { status: 502 })
  }
}
