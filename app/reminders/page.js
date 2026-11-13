'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/fetchAll'
import { AlarmClock, Mail, Bell, Send, MessageCircle } from 'lucide-react'
import { PageHeader, EmptyState, Skeleton } from '@/components/ui'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const todayStr = () => new Date().toLocaleDateString('en-CA')
const fmt = (d) => { const [y, m, dd] = d.split('-'); return `${+dd} ${MONTHS[+m - 1]} ${y}` }
const minusDays = (due, n) => {
  const d = new Date(due + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
const ICON = { email: Mail, push: Bell, telegram: Send, whatsapp: MessageCircle }
const CH_NAME = { email: 'Email', push: 'Popup', telegram: 'Telegram', whatsapp: 'WhatsApp' }

export default function Reminders() {
  const [tab, setTab] = useState('upcoming')
  const [filings, setFilings] = useState(null)
  const [log, setLog] = useState(null)

  useEffect(() => {
    fetchAll(() => supabase.from('filings')
      .select('id, due_date, status, reminder_days, channels, clients(name), filing_types(name), filing_assignees(profiles(full_name))')
      .neq('status', 'filed').order('due_date'))
      .then(setFilings).catch(() => setFilings([]))

    supabase.from('reminder_log')
      .select('id, channel, days_before, sent_at, user_id, profiles(full_name), filings(period, clients(name), filing_types(name))')
      .order('sent_at', { ascending: false }).limit(60)
      .then(({ data }) => setLog(data || []))
  }, [])

  const { schedule, overdue } = useMemo(() => {
    const today = todayStr()
    const end = minusDays(today, -14)
    const rows = []
    const od = []
    ;(filings || []).forEach((f) => {
      if (f.due_date < today) { od.push(f); return }
      f.reminder_days.forEach((n) => {
        const date = minusDays(f.due_date, n)
        if (date >= today && date <= end) rows.push({ date, n, f })
      })
    })
    rows.sort((a, b) => a.date.localeCompare(b.date))
    return { schedule: rows, overdue: od }
  }, [filings])

  const byDate = {}
  schedule.forEach((r) => { (byDate[r.date] = byDate[r.date] || []).push(r) })
  const who = (f) => f.filing_assignees.map((a) => a.profiles?.full_name).filter(Boolean).join(', ') || 'Unassigned'

  return (
    <div className="page">
      <PageHeader icon={AlarmClock} title="Reminders" subtitle="What\'s coming up and what\'s been sent so far" />

      <div className="flex gap-2 mb-5">
        <button className={`btn ${tab === 'upcoming' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('upcoming')}>Upcoming (14 days)</button>
        <button className={`btn ${tab === 'sent' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('sent')}>Sent</button>
      </div>

      {tab === 'upcoming' && (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <div className="card p-4 flex items-center justify-between gap-3" style={{ borderColor: '#ef4444' }}>
              <div className="text-sm">
                <b className="text-red-400">{overdue.length} overdue filings</b> receive daily reminders until they are filed.
              </div>
            </div>
          )}

          {filings === null ? (
            <Skeleton className="h-40" />
          ) : Object.keys(byDate).length === 0 ? (
            <div className="card"><EmptyState title="No reminders in the next 14 days" text="New filings or changes to reminder days will appear here." /></div>
          ) : (
            Object.entries(byDate).map(([date, items]) => (
              <div key={date} className="card p-4">
                <div className="font-semibold mb-3">{fmt(date)} {date === todayStr() && <span className="badge badge-blue ml-2">Today</span>}</div>
                <div className="space-y-2">
                  {items.map(({ f, n }) => (
                    <div key={f.id + n} className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="font-medium">{f.filing_types?.name}</span>
                      <span className="text-[var(--muted)]">· {f.clients?.name}</span>
                      <span className="badge badge-gray">{n === 0 ? 'On due date' : `${n} days before`}</span>
                      <span className="text-xs text-[var(--muted)]">{who(f)}</span>
                      <span className="flex gap-2 ml-auto">
                        {f.channels.filter((c) => c !== 'whatsapp').map((c) => {
                          const Icon = ICON[c]
                          return Icon ? <Icon key={c} size={15} className="text-[var(--muted)]" title={CH_NAME[c]} /> : null
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'sent' && (
        <div className="card overflow-x-auto">
          {log === null ? (
            <div className="p-4"><Skeleton className="h-40" /></div>
          ) : log.length === 0 ? (
            <EmptyState title="No reminders sent yet" text="Records will appear here once the cron runs." />
          ) : (
            <table className="data-table">
              <thead><tr><th>When</th><th>Filing</th><th>To</th><th>Channel</th></tr></thead>
              <tbody>
                {log.map((r) => (
                  <tr key={r.id}>
                    <td className="text-sm whitespace-nowrap">{new Date(r.sent_at).toLocaleString('en-IN')}</td>
                    <td>
                      <div className="font-semibold">{r.filings?.filing_types?.name}</div>
                      <div className="text-xs text-[var(--muted)]">{r.filings?.clients?.name} · {r.filings?.period || '-'}</div>
                    </td>
                    <td>{r.profiles?.full_name || '-'}</td>
                    <td>
                      {r.channel.startsWith('esc_')
                        ? <span className="badge badge-red">Escalation · {CH_NAME[r.channel.slice(4)] || r.channel}</span>
                        : <span className="badge badge-blue">{CH_NAME[r.channel] || r.channel}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}