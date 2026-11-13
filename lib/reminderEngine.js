import { fetchAll } from '@/lib/fetchAll'
import { generateRecurring } from '@/lib/recurring'

const DAY = 86400000
const diffDays = (a, b) => Math.round((new Date(a) - new Date(b)) / DAY)

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

// Pehle log likho (duplicate roke), fail ho to log hata do taaki agli baar retry ho
async function once(supabase, key, force, fn) {
  if (!force) {
    const { error } = await supabase.from('reminder_log').insert(key)
    if (error) return null
  }
  try {
    await fn()
    return { status: 'sent' }
  } catch (e) {
    if (!force) await supabase.from('reminder_log').delete().match(key)
    return { status: 'error', error: String(e.message || e) }
  }
}

export async function runReminders(supabase, { force = false, trigger = 'cron' } = {}) {
  const started = Date.now()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const sent = []
  const escalated = []
  let generated = 0
  let checked = 0
  let fatal = null

  try {
    generated = await generateRecurring(supabase, today)

    const filings = await fetchAll(() =>
      supabase.from('filings')
        .select('*, clients(name), filing_types(name), filing_assignees(user_id, profiles(full_name, email, telegram_chat_id))')
        .neq('status', 'filed').neq('work_status', 'not_applicable').order('due_date').order('id'))
    checked = filings.length

    // ---------- 1) Assigned users ko reminders ----------
    for (const f of filings) {
      const days = diffDays(f.due_date, today)
      let point = null
      if (days < 0) point = days                                   // overdue: roz
      else if (force) point = days <= 30 ? days : null             // sirf testing
      else {
        // Jo reminder points paar ho chuke hain unme se sabse nazdeeki (cron miss ho to bhi jayega)
        const reached = (f.reminder_days || []).filter((r) => r >= days)
        if (reached.length) point = Math.min(...reached)
      }
      if (point === null) continue

      const filingName = `${f.filing_types?.name} (${f.clients?.name})`
      const title = `Reminder: ${filingName} ${whenText(days)}`
      const lines = [`Due date: ${f.due_date}`, `Period: ${f.period || '-'}`, 'Kripya time par file karke status update kar dein.']

      for (const a of f.filing_assignees) {
        for (const ch of f.channels) {
          if (!['email', 'push', 'telegram'].includes(ch)) continue // WhatsApp button se jata hai
          const r = await once(
            supabase,
            { filing_id: f.id, user_id: a.user_id, channel: ch, days_before: point },
            force,
            () => deliver(supabase, ch, a.profiles, a.user_id, f.id, title, lines)
          )
          if (r) sent.push({ channel: ch, ...r })
        }
      }
    }

    // ---------- 2) Escalation ----------
    const { data: cfg } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    if (cfg?.escalation_enabled) {
      const { data: people } = await supabase
        .from('profiles').select('id, full_name, email, telegram_chat_id, role')
      const recipients = (people || []).filter(
        (p) => (cfg.escalate_to_admins && p.role === 'admin') || (cfg.escalation_user_ids || []).includes(p.id)
      )
      const levels = (cfg.escalation_days || []).map(Number).filter((n) => n > 0)

      for (const f of filings) {
        const over = diffDays(today, f.due_date)
        if (over <= 0) continue

        let level
        if (force) level = over
        else {
          const reached = levels.filter((l) => over >= l)
          if (!reached.length) continue
          level = Math.max(...reached) // sabse ooncha level jo paar hua
        }

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
              { filing_id: f.id, user_id: p.id, channel: 'esc_' + ch, days_before: -level },
              force,
              () => deliver(supabase, ch, p, p.id, f.id, title, lines)
            )
            if (r) escalated.push({ channel: ch, ...r })
          }
        }
      }
    }
  } catch (e) {
    fatal = String(e.message || e)
  }

  const errs = [...sent, ...escalated].filter((r) => r.status === 'error')
  const samples = [
    ...(fatal ? [`fatal: ${fatal}`] : []),
    ...errs.slice(0, 3).map((e) => `${e.channel}: ${e.error}`),
  ].map((s) => s.slice(0, 200))

  const summary = {
    date: today,
    trigger,
    generated,
    checked,
    reminders_sent: sent.filter((r) => r.status === 'sent').length,
    escalations_sent: escalated.filter((r) => r.status === 'sent').length,
    errors: errs.length + (fatal ? 1 : 0),
    error_samples: samples,
    duration_ms: Date.now() - started,
  }

  await supabase.from('cron_runs').insert({
    trigger,
    generated,
    reminders_sent: summary.reminders_sent,
    escalations_sent: summary.escalations_sent,
    errors: summary.errors,
    error_samples: samples.join(' | ') || null,
    duration_ms: summary.duration_ms,
  })

  return summary
}