import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateRecurring } from '@/lib/recurring'

export async function POST(request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: u } = await admin.auth.getUser(token)
  if (!u?.user) return NextResponse.json({ error: 'Pehle login karo' }, { status: 401 })

  const { data: p } = await admin.from('profiles').select('role').eq('id', u.user.id).single()
  if (!['admin', 'staff'].includes(p?.role)) {
    return NextResponse.json({ error: 'Access nahi hai' }, { status: 403 })
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const created = await generateRecurring(admin, today)
  return NextResponse.json({ created })
}