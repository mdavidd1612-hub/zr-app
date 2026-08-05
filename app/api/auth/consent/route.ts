import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const formData = await req.formData()

  // 1. El usuario actual debe estar logueado y ser estudiante menor
  const serverSb = await createServerClient()
  const { data: { user } } = await serverSb.auth.getUser()
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  const representativeName = formData.get('representativeName') as string
  const representativeCedula = formData.get('representativeCedula') as string
  const representativeEmail = formData.get('representativeEmail') as string
  const representativePhone = formData.get('representativePhone') as string
  const method = formData.get('method') as string
  const document = formData.get('document') as File | null

  // Validaciones básicas
  if (!representativeName || !representativeCedula || !representativeEmail) {
    return Response.json(
      { error: 'Faltan datos del representante' },
      { status: 400 }
    )
  }

  if (method !== 'fisico' && method !== 'digital') {
    return Response.json({ error: 'Método inválido' }, { status: 400 })
  }

  if (method === 'digital' && !document) {
    return Response.json({ error: 'Debes subir el documento' }, { status: 400 })
  }

  const admin = createAdminClient()

  let documentUrl: string | null = null

  // 2. Si es digital, subir el documento al bucket `consentimientos`
  if (method === 'digital' && document) {
    const filename = `${user.id}/${Date.now()}-${document.name}`
    const buffer = await document.arrayBuffer()

    const { data: uploadData, error: uploadError } = await admin.storage
      .from('consentimientos')
      .upload(filename, buffer, { contentType: document.type })

    if (uploadError) {
      return Response.json({ error: 'Error al subir documento' }, { status: 400 })
    }

    documentUrl = uploadData.path
  }

  // 3. Insertar en parental_consents
  const { error: insertError } = await admin.from('parental_consents').insert({
    student_id: user.id,
    representative_name: representativeName,
    representative_cedula: representativeCedula,
    representative_email: representativeEmail,
    representative_phone: representativePhone || null,
    consent_type: 'account_creation',
    method: method as 'fisico' | 'digital',
    document_url: documentUrl,
  })

  if (insertError) {
    return Response.json(
      { error: 'Error al registrar consentimiento' },
      { status: 400 }
    )
  }

  // 4. Actualizar onboarding_status a 'completo'
  // El middleware controla que SOLO puede seguir después de esto
  const { error: updateError } = await admin
    .from('students')
    .update({ onboarding_status: 'completo' })
    .eq('id', user.id)

  if (updateError) {
    return Response.json(
      {
        error:
          'La ley requiere el consentimiento del representante. Por favor contacta a la coordinación.',
      },
      { status: 400 }
    )
  }

  return Response.json({ success: true })
}
