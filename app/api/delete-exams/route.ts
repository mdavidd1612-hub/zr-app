import { NextRequest, NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function DELETE(req: NextRequest) {
  // Verify the caller is an authenticated professor who owns all the exams
  const supabase = await createUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'no_auth' }, { status: 401 })

  const { ids } = await req.json() as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids_required' }, { status: 400 })
  }

  // El rol se lee en el servidor, nunca viene del cliente. Dirección Académica y
  // super_admin pueden borrar cualquier examen; el profesor, solo los suyos.
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const esAcademico = perfil?.role === 'direccion_academica' || perfil?.role === 'super_admin'

  // Verify all exams are the caller's (or the caller is academic) before using admin client
  let consulta = supabase.from('exams').select('id').in('id', ids)
  if (!esAcademico) consulta = consulta.eq('teacher_id', user.id)
  const { data: propios, error: checkErr } = await consulta

  if (checkErr) return NextResponse.json({ error: checkErr.message }, { status: 500 })
  if ((propios ?? []).length !== ids.length) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const admin = adminClient()

  // Cascade delete in order (FK constraints)
  const { data: intentos } = await admin
    .from('exam_attempts').select('id').in('exam_id', ids)
  const intentoIds = (intentos ?? []).map((a: { id: string }) => a.id)

  if (intentoIds.length > 0) {
    await admin.from('exam_rehabilitation_requests' as never).delete().in('attempt_id', intentoIds)
    await admin.from('exam_answers').delete().in('attempt_id', intentoIds)
    await admin.from('exam_attempts').delete().in('id', intentoIds)
  }

  await admin.from('exam_questions').delete().in('exam_id', ids)

  // Pedido explícito (8-nov-2026): eliminar el examen desde esta pantalla
  // debe quitarlo de Notas también, aunque ya tenga nota puesta -- a
  // diferencia de borrar la UNIDAD completa (fn_limpiar_definicion_huerfana_
  // examen, migración 199), que a propósito deja intacta una evaluación ya
  // calificada. Aquí el profesor está borrando el examen mismo, así que la
  // nota que generó debe irse con él.
  const { data: definiciones } = await admin
    .from('manual_exam_definitions' as never)
    .select('id')
    .in('source_exam_id', ids)
  const definicionIds = (definiciones ?? []).map((d: { id: string }) => d.id)
  if (definicionIds.length > 0) {
    await admin.from('manual_exam_scores' as never).delete().in('definition_id', definicionIds)
    await admin.from('manual_exam_definitions' as never).delete().in('id', definicionIds)
  }

  const { error } = await admin.from('exams').delete().in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
