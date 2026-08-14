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

  // Verify all exams belong to this professor before using admin client
  const { data: propios, error: checkErr } = await supabase
    .from('exams')
    .select('id')
    .eq('teacher_id', user.id)
    .in('id', ids)

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
  const { error } = await admin.from('exams').delete().in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
