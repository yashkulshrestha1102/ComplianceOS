import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

const safeEqual = (a, b) => {
  const x = Buffer.from(a || '')
  const y = Buffer.from(b || '')
  return x.length === y.length && timingSafeEqual(x, y)
}

async function send(chatId, text) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

export async function POST(request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || !safeEqual(request.headers.get('x-telegram-bot-api-secret-token'), secret)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = await request.json().catch(() => null)
  const msg = update?.message
  const ok = NextResponse.json({ ok: true }) // Telegram ko hamesha 200 do, warna wo retry karta hai
  if (!msg?.text || !msg.chat?.id) return ok

  const chatId = String(msg.chat.id)
  const m = msg.text.trim().match(/^\/start(?:\s+(\S+))?$/)
  if (!m) return ok

  if (!m[1]) {
    await send(chatId, 'Hello! Go to the Settings page in the ComplianceOS app, tap "Connect Telegram", and come back here.')
    return ok
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: row } = await admin.from('telegram_link_tokens')
    .select('user_id, expires_at').eq('token', m[1]).maybeSingle()

  if (!row || new Date(row.expires_at) < new Date()) {
    await send(chatId, 'This link is old or invalid. Tap "Connect Telegram" again in the app.')
    return ok
  }

  await admin.from('profiles').update({ telegram_chat_id: chatId }).eq('id', row.user_id)
  await admin.from('telegram_link_tokens').delete().eq('token', m[1])
  await send(chatId, '✅ Telegram connected to ComplianceOS! Due-date reminders will now arrive here.')
  return ok
}