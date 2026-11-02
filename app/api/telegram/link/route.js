import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export async function POST(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: u, error } = await admin.auth.getUser(token)
  if (error || !u?.user) return NextResponse.json({ error: 'Pehle login karo' }, { status: 401 })

  const linkToken = randomBytes(18).toString('base64url')
  await admin.from('telegram_link_tokens').delete().eq('user_id', u.user.id)
  const { error: insErr } = await admin.from('telegram_link_tokens').insert({ token: linkToken, user_id: u.user.id })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({
    link: `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=${linkToken}`,
  })
}