import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { generateRecurring } from '@/lib/recurring'
const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function sendEmail(to, name, subject, html) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
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

  const results = []

  for (const f of filings) {
    const days = Math.round((new Date(f.due_date) - new Date(today)) / 86400000)
    const matches = days < 0 || f.reminder_days.includes(days)
    if (!force && !matches) continue
    if (force && days > 30) continue

    const filingName = `${f.filing_types?.name} (${f.clients?.name})`
    const title = `${filingName} ${whenText(days)}`

    for (const a of f.filing_assignees) {
      const p = a.profiles
      for (const ch of f.channels) {
        if (!['email', 'push', 'telegram'].includes(ch)) continue // WhatsApp button se jata hai

        if (!force) {
          const { error: logErr } = await supabase.from('reminder_log').insert({
            filing_id: f.id, user_id: a.user_id, channel: ch, days_before: days,
          })
          if (logErr) continue // pehle hi bhej chuke hain
        }

        try {
          if (ch === 'email') {
            if (!p?.email) throw new Error('user ki email nahi hai')
            await sendEmail(
              p.email, p.full_name,
              `Reminder: ${title}`,
              `<div style="font-family:Arial,sans-serif">
                 <h2>Compliance Reminder</h2>
                 <p>Namaste ${p.full_name || ''},</p>
                 <p><b>${filingName}</b> (Period: ${f.period || '-'}) ${whenText(days)}.</p>
                 <p>Due date: <b>${f.due_date}</b></p>
                 <p>Please time par file karke status update kar dein.</p>
                 <p>- ComplianceOS</p>
               </div>`
            )
          } else if (ch === 'telegram') {
            if (!p?.telegram_chat_id) throw new Error('telegram connect nahi hai')
            await sendTelegram(
              p.telegram_chat_id,
              `🔔 Compliance Reminder\n\n${filingName}\nPeriod: ${f.period || '-'}\n${whenText(days)}\nDue date: ${f.due_date}`
            )
          } else {
            await supabase.from('notifications').insert({
              user_id: a.user_id, filing_id: f.id, title,
              message: `Due date: ${f.due_date}`,
            })
          }
          results.push({ filing: filingName, user: p?.email, channel: ch, status: 'sent' })
        } catch (e) {
          results.push({ filing: filingName, user: p?.email, channel: ch, status: 'error', error: String(e.message || e) })
          if (!force) {
            await supabase.from('reminder_log').delete()
              .eq('filing_id', f.id).eq('user_id', a.user_id).eq('channel', ch).eq('days_before', days)
          }
        }
      }
    }
  }

  return NextResponse.json({ date: today, generated, checked: filings.length, sent: results })
}