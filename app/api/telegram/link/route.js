import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: u, error } = await admin.auth.getUser(token)
  if (error || !u?.user) return NextResponse.json({ error: 'Pehle login karo' }, { status: 401 })
  const uid = u.user.id

  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`)
  const json = await res.json()
  if (!json.ok) return NextResponse.json({ error: json.description || 'Telegram error' }, { status: 500 })

  const hit = [...json.result].reverse().find((x) => x.message?.text === `/start ${uid}`)
  if (!hit) {
    return NextResponse.json(
      { error: 'Abhi /start nahi mila. Telegram me bot kholo, START dabao, phir dobara verify karo.' },
      { status: 404 }
    )
  }

  const chatId = String(hit.message.chat.id)
  await admin.from('profiles').update({ telegram_chat_id: chatId }).eq('id', uid)

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: '✅ ComplianceOS se Telegram connect ho gaya! Ab yahan due date reminders aayenge.' }),
  })

  return NextResponse.json({ ok: true })
}