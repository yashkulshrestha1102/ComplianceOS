import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { runReminders } from '@/lib/reminderEngine'

export async function POST(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: u } = await admin.auth.getUser(token)
  if (!u?.user) return NextResponse.json({ error: 'Pehle login karo' }, { status: 401 })

  const { data: p } = await admin.from('profiles').select('role').eq('id', u.user.id).single()
  if (p?.role !== 'admin') return NextResponse.json({ error: 'Sirf admin' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const force = body?.force === true
  const summary = await runReminders(admin, { force, trigger: force ? 'manual-force' : 'manual' })
  return NextResponse.json(summary)
}