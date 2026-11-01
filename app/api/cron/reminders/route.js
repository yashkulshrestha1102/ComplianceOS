import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateRecurring } from '@/lib/recurring'

const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

async function sendEmail(to, name, subject, html) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'ComplianceOS', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: to, name: name || to }],
      subject,
      htmlContent: html,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
}

async function sendTelegram(chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) throw new Error(await res.text())
}

function whenText(days) {
  if (days === 0) return 'aaj due hai'
  if (days < 0) return `${-days} din se OVERDUE hai`
  return `${days} din baad due hai`
}

// Ek channel par ek message bhejo
async function deliver(supabase, ch, p, userId, filingId, title, lines) {
  if (ch === 'email') {
    if (!p?.email) throw new Error('user ki email nahi hai')
    await sendEmail(
      p.email, p.full_name, title,
      `<div style="font-family:Arial,sans-serif"><h2>${esc(title)}</h2>
        <p>Namaste ${esc(p.full_name || '')},</p>
        ${lines.map((l) => `<p>${esc(l)}</p>`).join('')}
        <p>- ComplianceOS</p></div>`
    )
  } else if (ch === 'telegram') {
    if (!p?.telegram_chat_id) throw new Error('telegram connect nahi hai')
    await sendTelegram(p.telegram_chat_id, `🔔 ${title}\n\n${lines.join('\n')}`)
  } else {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId, filing_id: filingId, title, message: lines[0] || '',
    })
    if (error) throw error
  }
}

// Duplicate rokne wala wrapper: pehle log likho, fail ho to log hata do
async function once(supabase, key, force, fn) {
  if (!force) {
    const { error } = await supabase.from('reminder_log').insert(key)
    if (error) return null // pehle hi bhej chuke hain
  }
  try {
    await fn()
    return { status: 'sent' }
  } catch (e) {
    if (!force) await supabase.from('reminder_log').delete().match(key)
    return { status: 'error', error: String(e.message || e) }
  }
}

export async function GET(request) {
  const url = new URL(request.url)
  const secret =
    url.searchParams.get('secret') ||
    (request.headers.get('authorization') || '').replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const force = url.searchParams.get('force') === '1' // sirf testing ke liye
  const supabase = adminClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  const generated = await generateRecurring(supabase, today)

  const { data: filings, error } = await supabase
    .from('filings')
    .select('*, clients(name), filing_types(name), filing_assignees(user_id, profiles(full_name, email, telegram_chat_id))')
    .neq('status', 'filed')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sent = []
  const escalated = []

  // ---------- 1) Assigned users ko reminders ----------
  for (const f of filings) {
    const days = Math.round((new Date(f.due_date) - new Date(today)) / 86400000)
    const matches = days < 0 || f.reminder_days.includes(days)
    if (!force && !matches) continue
    if (force && days > 30) continue

    const filingName = `${f.filing_types?.name} (${f.clients?.name})`
    const title = `Reminder: ${filingName} ${whenText(days)}`
    const lines = [`Due date: ${f.due_date}`, `Period: ${f.period || '-'}`, 'Kripya time par file karke status update kar dein.']

    for (const a of f.filing_assignees) {
      for (const ch of f.channels) {
        if (!['email', 'push', 'telegram'].includes(ch)) continue // WhatsApp button se jata hai
        const r = await once(
          supabase,
          { filing_id: f.id, user_id: a.user_id, channel: ch, days_before: days },
          force,
          () => deliver(supabase, ch, a.profiles, a.user_id, f.id, title, lines)
        )
        if (r) sent.push({ filing: filingName, user: a.profiles?.email, channel: ch, ...r })
      }
    }
  }

  // ---------- 2) Escalation: overdue par seniors ko ----------
  const { data: cfg } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  if (cfg?.escalation_enabled) {
    const { data: people } = await supabase
      .from('profiles').select('id, full_name, email, telegram_chat_id, role')
    const recipients = (people || []).filter(
      (p) => (cfg.escalate_to_admins && p.role === 'admin') || (cfg.escalation_user_ids || []).includes(p.id)
    )

    for (const f of filings) {
      const over = Math.round((new Date(today) - new Date(f.due_date)) / 86400000)
      if (over <= 0) continue
      if (!force && !(cfg.escalation_days || []).includes(over)) continue

      const filingName = `${f.filing_types?.name} (${f.clients?.name})`
      const who = f.filing_assignees.map((a) => a.profiles?.full_name).filter(Boolean).join(', ') || 'koi nahi'
      const title = `⚠️ ESCALATION: ${filingName} ${over} din se overdue`
      const lines = [
        `Due date thi: ${f.due_date} (${over} din overdue)`,
        `Client: ${f.clients?.name}`,
        `Assigned: ${who}`,
        'Turant action lena zaroori hai.',
      ]

      for (const p of recipients) {
        for (const ch of cfg.escalation_channels || []) {
          if (!['email', 'push', 'telegram'].includes(ch)) continue
          const r = await once(
            supabase,
            { filing_id: f.id, user_id: p.id, channel: 'esc_' + ch, days_before: -over },
            force,
            () => deliver(supabase, ch, p, p.id, f.id, title, lines)
          )
          if (r) escalated.push({ filing: filingName, to: p.email, channel: ch, overdue_days: over, ...r })
        }
      }
    }
  }

  return NextResponse.json({ date: today, generated, checked: filings.length, sent, escalated })
}