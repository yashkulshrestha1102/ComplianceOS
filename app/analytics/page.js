'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/fetchAll'
import { BarChart3, FileText, CheckCircle2, AlertTriangle, Timer } from 'lucide-react'
import { PageHeader, Skeleton, EmptyState } from '@/components/ui'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayStr = () => ymd(new Date())

const COLORS = { pending: '#facc15', in_progress: '#60a5fa', filed: '#22c55e', overdue: '#ef4444' }
const shownStatus = (f) => (f.status !== 'filed' && f.due_date < todayStr() ? 'overdue' : f.status)

function Kpi({ icon: Icon, value, label, color }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '26' }}>
        <Icon size={24} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-[var(--muted)]">{label}</div>
      </div>
    </div>
  )
}

function Donut({ data }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  const R = 15.9155
  let offset = 25
  return (
    <svg viewBox="0 0 36 36" className="w-40 h-40 shrink-0">
      <circle cx="18" cy="18" r={R} fill="none" stroke="var(--border)" strokeWidth="4" />
      {total > 0 && data.map((d) => {
        const pct = (d.value / total) * 100
        const el = (
          <circle key={d.label} cx="18" cy="18" r={R} fill="none" stroke={d.color} strokeWidth="4"
            strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />
        )
        offset -= pct
        return el
      })}
      <text x="18" y="20" textAnchor="middle" fill="currentColor" style={{ fontSize: '7px', fontWeight: 700 }}>{total}</text>
    </svg>
  )
}

function MonthBars({ months }) {
  const max = Math.max(1, ...months.map((m) => m.total))
  return (
    <div className="flex gap-2">
      {months.map((m) => (
        <div key={m.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div className="text-xs text-[var(--muted)] h-4">{m.total || ''}</div>
          <div className="h-36 w-full flex items-end">
            <div className="w-full rounded-t-md overflow-hidden flex flex-col justify-end"
              style={{ height: `${(m.total / max) * 100}%`, minHeight: m.total ? 4 : 0 }}>
              <div style={{ flex: m.total - m.filed, background: 'var(--accent)' }} />
              <div style={{ flex: m.filed, background: '#22c55e' }} />
            </div>
          </div>
          <div className="text-[10px] text-[var(--muted)] whitespace-nowrap">{m.label}</div>
        </div>
      ))}
    </div>
  )
}

function fyStart() {
  const t = new Date()
  const y = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1
  return `${y}-04-01`
}

export default function Analytics() {
  const [all, setAll] = useState(null)
  const [range, setRange] = useState('all')

  useEffect(() => {
    fetchAll(() => supabase.from('filings')
      .select('id, due_date, status, filed_on, client_id, clients(name), filing_types(name), filing_assignees(user_id, profiles(full_name))')
      .order('due_date').order('id'))
      .then(setAll)
      .catch(() => setAll([]))
  }, [])

  const data = useMemo(() => {
    const list = all || []
    const t = new Date()
    const sixAgo = ymd(new Date(t.getFullYear(), t.getMonth() - 6, 1))
    const rows = list.filter((f) =>
      range === 'all' ? true : range === 'fy' ? f.due_date >= fyStart() : f.due_date >= sixAgo)

    const today = todayStr()
    const counts = { pending: 0, in_progress: 0, filed: 0, overdue: 0 }
    rows.forEach((f) => { counts[shownStatus(f)]++ })

    const filedRows = rows.filter((f) => f.status === 'filed' && f.filed_on)
    const onTime = filedRows.filter((f) => f.filed_on <= f.due_date).length
    const onTimeRate = filedRows.length ? Math.round((onTime / filedRows.length) * 100) : null

    // Mahine-wise (pichhle 6 + agle 5 mahine, poore data se)
    const months = []
    for (let i = -6; i <= 5; i++) {
      const d = new Date(t.getFullYear(), t.getMonth() + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push({ key, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, total: 0, filed: 0 })
    }
    list.forEach((f) => {
      const m = months.find((x) => x.key === f.due_date.slice(0, 7))
      if (m) { m.total++; if (f.status === 'filed') m.filed++ }
    })

    // Filing type
    const typeMap = {}
    rows.forEach((f) => {
      const n = f.filing_types?.name || 'Other'
      typeMap[n] = typeMap[n] || { name: n, total: 0, filed: 0 }
      typeMap[n].total++
      if (f.status === 'filed') typeMap[n].filed++
    })
    const types = Object.values(typeMap).sort((a, b) => b.total - a.total).slice(0, 8)

    // Staff
    const staffMap = {}
    rows.forEach((f) => f.filing_assignees.forEach((a) => {
      const s = (staffMap[a.user_id] = staffMap[a.user_id] || {
        name: a.profiles?.full_name || 'Unknown', assigned: 0, filed: 0, overdue: 0, onTime: 0,
      })
      s.assigned++
      if (f.status === 'filed') { s.filed++; if (f.filed_on && f.filed_on <= f.due_date) s.onTime++ }
      else if (f.due_date < today) s.overdue++
    }))
    const staff = Object.values(staffMap).sort((a, b) => b.assigned - a.assigned)

    // Clients with overdue
    const clientMap = {}
    rows.filter((f) => shownStatus(f) === 'overdue').forEach((f) => {
      const n = f.clients?.name || 'Unknown'
      clientMap[n] = (clientMap[n] || 0) + 1
    })
    const topOverdue = Object.entries(clientMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

    return { rows, counts, onTimeRate, months, types, staff, topOverdue }
  }, [all, range])

  const donut = [
    { label: 'Pending', value: data.counts.pending, color: COLORS.pending },
    { label: 'In progress', value: data.counts.in_progress, color: COLORS.in_progress },
    { label: 'Filed', value: data.counts.filed, color: COLORS.filed },
    { label: 'Overdue', value: data.counts.overdue, color: COLORS.overdue },
  ]

  return (
    <div className="page">
      <PageHeader icon={BarChart3} title="Analytics" subtitle="Kaam kaisa chal raha hai, ek nazar me">
        <select value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="all">Saara data</option>
          <option value="fy">Is saal (FY)</option>
          <option value="last6">Pichhle 6 mahine se</option>
        </select>
      </PageHeader>

      {all === null ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}</div>
          <Skeleton className="h-64" />
        </div>
      ) : data.rows.length === 0 ? (
        <div className="card"><EmptyState title="Abhi analytics ke liye data nahi hai" text="Filings add hote hi yahan charts dikhenge." /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi icon={FileText} value={data.rows.length} label="Total filings" color="#3b82f6" />
            <Kpi icon={CheckCircle2} value={data.counts.filed} label="Filed" color="#22c55e" />
            <Kpi icon={AlertTriangle} value={data.counts.overdue} label="Overdue" color="#ef4444" />
            <Kpi icon={Timer} value={data.onTimeRate === null ? '-' : `${data.onTimeRate}%`} label="Time par filed" color="#a78bfa" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="card p-5 lg:col-span-5">
              <h2 className="font-semibold mb-4">Status ka batwara</h2>
              <div className="flex items-center gap-6 flex-wrap">
                <Donut data={donut} />
                <ul className="space-y-2 text-sm">
                  {donut.map((d) => (
                    <li key={d.label} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                      <span className="text-[var(--muted)] w-24">{d.label}</span>
                      <b>{d.value}</b>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="card p-5 lg:col-span-7">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Mahine-wise filings (due date ke hisaab se)</h2>
                <div className="text-xs text-[var(--muted)] flex gap-3">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Filed</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--accent)' }} /> Baaki</span>
                </div>
              </div>
              <MonthBars months={data.months} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h2 className="font-semibold mb-4">Filing type ke hisaab se progress</h2>
              <div className="space-y-4">
                {data.types.map((t) => {
                  const pct = Math.round((t.filed / t.total) * 100)
                  const c = pct >= 80 ? '#22c55e' : pct >= 50 ? '#facc15' : '#ef4444'
                  return (
                    <div key={t.name} className="flex items-center gap-3 text-sm">
                      <span className="w-28 truncate">{t.name}</span>
                      <div className="flex-1 h-2.5 rounded-full bg-[var(--border)]">
                        <div className="h-2.5 rounded-full" style={{ width: pct + '%', background: c }} />
                      </div>
                      <span className="w-20 text-right text-xs text-[var(--muted)]">{t.filed}/{t.total} ({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="font-semibold mb-4">Sabse zyada overdue wale clients</h2>
              {data.topOverdue.length === 0 ? (
                <p className="text-sm text-green-400">Koi overdue nahi hai. 🎉</p>
              ) : (
                <div className="space-y-3">
                  {data.topOverdue.map(([name, n]) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span>{name}</span>
                      <span className="badge badge-red">{n} overdue</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card overflow-x-auto">
            <div className="p-5 pb-2"><h2 className="font-semibold">Staff-wise performance</h2></div>
            {data.staff.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-[var(--muted)]">Abhi kisi filing me koi user assign nahi hai.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Staff</th><th>Assigned</th><th>Filed</th><th>Overdue</th><th>Time par filed</th></tr>
                </thead>
                <tbody>
                  {data.staff.map((s) => (
                    <tr key={s.name}>
                      <td className="font-semibold">{s.name}</td>
                      <td>{s.assigned}</td>
                      <td className="text-green-400">{s.filed}</td>
                      <td className={s.overdue ? 'text-red-400' : ''}>{s.overdue}</td>
                      <td>{s.filed ? `${Math.round((s.onTime / s.filed) * 100)}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}