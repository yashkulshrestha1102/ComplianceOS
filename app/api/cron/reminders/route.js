import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runReminders } from '@/lib/reminderEngine'

function authorized(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(got)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const summary = await runReminders(supabase, { trigger: 'cron' })
  return NextResponse.json(summary)
}