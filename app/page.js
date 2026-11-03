'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/fetchAll'
import { Skeleton } from '@/components/ui'
import {
  CalendarDays, AlertTriangle, CheckCircle2, Clock, Bell, Heart, Plus, Zap, ShieldCheck, ArrowRight,
  ClipboardList, Repeat, Upload, Users, Activity, UserX, ListTodo, RefreshCw, FileText,
} from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const todayStr = () => new Date().toLocaleDateString('en-CA')
const daysLeft = (d) => Math.round((new Date(d) - new Date(todayStr())) / 86400000)

function Stat({ icon: Icon, value, label, sub, color, href }) {
  const body = (
    <div className="card p-4 flex items-center gap-4 h-full">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '26' }}>
        <Icon size={28} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-3xl font-bold leading-tight">{value}</div>
        <div className="text-sm text-[var(--muted)]">{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color }}>{sub}</div>}
      </div>
    </div>
  )
  return href ? <Link href={href} className="block transition hover:-translate-y-0.5">{body}</Link> : body
}

function DeadlineRow({ f }) {
  const d = daysLeft(f.due_date)
  const dt = new Date(f.due_date)
  const tone = d < 0 ? '#b91c1c' : d <= 2 ? '#c2410c' : d <= 7 ? '#a16207' : '#374151'
  const who = f.filing_assignees.map((a) => a.profiles?.full_name).filter(Boolean).join(', ') || 'Unassigned'
  const text = d < 0 ? `${-d} din se overdue` : d === 0 ? 'Aaj due hai' : `${d} din baaki`
  return (
    <Link href={`/filings?q=${encodeURIComponent(f.clients?.name || '')}`}
      className="flex items-center gap-3 rounded-lg p-1.5 -m-1.5 hover:bg-[var(--accent-soft)] transition">
      <div className="w-12 h-14 rounded-lg flex flex-col items-center justify-center text-white shrink-0" style={{ background: tone }}>
        <span className="text-lg font-bold leading-none">{dt.getUTCDate()}</span>
        <span className="text-xs">{MONTHS[dt.getUTCMonth()]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">
          {f.filing_types?.name} <span className="text-[var(--muted)] font-normal text-sm">· {f.clients?.name}</span>
        </div>
        <div className="text-xs text-[var(--muted)] truncate">{text} · {who}</div>
      </div>
      {f.filing_assignees.length === 0 && <span className="badge badge-yellow">Unassigned</span>}
    </Link>
  )
}

function Alert({ tone, icon: Icon, children, href, cta }) {
  const c = tone === 'red' ? '#ef4444' : '#f59e0b'
  return (
    <div className="card p-3 px-4 flex flex-wrap items-center gap-3" style={{ borderColor: c }}>
      <Icon size={18} style={{ color: c }} className="shrink-0" />
      <div className="text-sm flex-1 min-w-[200px]">{children}</div>
      {href && <Link href={href} className="text-sm font-semibold flex items-center gap-1" style={{ color: c }}>{cta} <ArrowRight size={14} /></Link>}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [me, setMe] = useState({ id: '', name: '', role: '' })
  const [err, setErr] = useState('')
  const [now, setNow] = useState(null)

  const load = useCallback(async () => {
    setErr('')
    try {
      const { data: s } = await supabase.auth.getSession()
      if (!s.session) return
      const uid = s.session.user.id
      const { data: p } = await supabase.from('profiles').select('full_name, role').eq('id', uid).single()
      setMe({ id: uid, name: (p?.full_name || '').split(' ')[0], role: p?.role || '' })
      if (p?.role === 'client') return // client ko AppShell portal par bhej deta hai

      const [light, open, types, run] = await Promise.all([
        fetchAll(() => supabase.from('filings').select('id, status, filed_on, filing_type_id').order('id')),
        fetchAll(() => supabase.from('filings')
          .select('id, due_date, status, period, clients(name), filing_types(name), filing_assignees(user_id, profiles(full_name))')
          .neq('status', 'filed').order('due_date').order('id')),
        supabase.from('filing_types').select('id, name'),
        p?.role === 'admin'
          ? supabase.from('cron_runs').select('*').order('ran_at', { ascending: false }).limit(1)
          : Promise.resolve({ data: [] }),
      ])
      setData({ light, open, types: types.data || [], run: run.data?.[0] || null })
    } catch (e) {
      setErr(e.message || 'Data load nahi ho paya')
    }
  }, [])

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 60000)
    load()
    return () => clearInterval(t)
  }, [load])

  const hour = now ? now.getHours() : 9
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4 pt-2">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{greet}{me.name ? `, ${me.name}` : ''}! 👋</h1>
        <p className="text-[var(--muted)] mt-1">Aaj ki compliance sthiti ek nazar me.</p>
      </div>
      {now && (
        <div className="card px-5 py-3 text-sm flex items-center gap-4">
          <span className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[var(--accent)]" />
            {now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <span>{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}
    </div>
  )

  if (err) {
    return (
      <div className="page space-y-6">
        {header}
        <div className="card p-10 text-center">
          <AlertTriangle size={32} className="mx-auto text-red-400" />
          <p className="mt-3 font-semibold">Dashboard load nahi ho paya</p>
          <p className="text-sm text-[var(--muted)] mt-1">{err}</p>
          <button onClick={load} className="btn btn-primary mt-5"><RefreshCw size={16} /> Dobara try karo</button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page space-y-6">
        {header}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Skeleton className="h-72 lg:col-span-5" />
          <Skeleton className="h-72 lg:col-span-4" />
          <Skeleton className="h-72 lg:col-span-3" />
        </div>
      </div>
    )
  }

  const { light, open, types, run } = data
  const isAdmin = me.role === 'admin'

  const overdue = open.filter((f) => daysLeft(f.due_date) < 0)
  const dueSoon = open.filter((f) => { const d = daysLeft(f.due_date); return d >= 0 && d <= 7 })
  const unassigned = open.filter((f) => f.filing_assignees.length === 0)
  const mine = open.filter((f) => f.filing_assignees.some((a) => a.user_id === me.id))
  const upcoming = open.filter((f) => daysLeft(f.due_date) >= 0).slice(0, 5)

  const monthKey = todayStr().slice(0, 7)
  const filedThisMonth = light.filter((f) => f.status === 'filed' && (f.filed_on || '').startsWith(monthKey)).length
  const total = light.length
  const score = total === 0 ? 100 : Math.round(((total - overdue.length) / total) * 100)
  const ringColor = score >= 80 ? 'var(--good)' : score >= 50 ? '#f59e0b' : '#ef4444'
  const C = 2 * Math.PI * 54
  const risk = overdue.length === 0 ? 'Low' : overdue.length < 3 ? 'Medium' : 'High'

  const stale = isAdmin && (!run || Date.now() - new Date(run.ran_at).getTime() > 36 * 3600 * 1000)

  const typeName = Object.fromEntries(types.map((t) => [t.id, t.name]))
  const byType = {}
  light.forEach((f) => {
    const n = typeName[f.filing_type_id] || 'Other'
    byType[n] = byType[n] || { total: 0, filed: 0 }
    byType[n].total++
    if (f.status === 'filed') byType[n].filed++
  })
  const progress = Object.entries(byType).sort((a, b) => b[1].total - a[1].total).slice(0, 5)

  const checks = [
    ['Koi filing overdue nahi', overdue.length === 0],
    ['Har filing me user assigned hai', unassigned.length === 0],
    ...(isAdmin ? [['Reminder engine chal raha hai', !stale]] : []),
  ]

  const actions = [
    ['Filing add karo', Plus, '/filings?new=1'],
    ['Recurring template', Repeat, '/recurring'],
    ['Bulk import', Upload, '/import'],
    ['Reports', ClipboardList, '/reports'],
    ['Clients', Users, '/clients'],
  ]

  return (
    <div className="page space-y-6">
      {header}

      {(unassigned.length > 0 || stale) && (
        <div className="space-y-2">
          {unassigned.length > 0 && (
            <Alert tone="amber" icon={UserX} href="/filings" cta="Filings dekho">
              <b>{unassigned.length}</b> filing me koi user assigned nahi hai, inpar <b>koi reminder nahi jayega</b>.
            </Alert>
          )}
          {stale && (
            <Alert tone="red" icon={Activity} href="/settings" cta="Settings kholo">
              Reminder engine <b>36 ghante se nahi chala</b>. Vercel ke cron aur logs check karo.
            </Alert>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat icon={FileText} value={open.length} label="Open filings" sub={`${total} me se`} color="#3b82f6" href="/filings" />
        <Stat icon={Clock} value={dueSoon.length} label="Is hafte due (7 din)" color="#f59e0b" href="/filings" />
        <Stat icon={AlertTriangle} value={overdue.length} label="Overdue" color="#ef4444" href="/filings?status=overdue" />
        <Stat icon={CheckCircle2} value={filedThisMonth} label="Is mahine filed" color="#22c55e" href="/filings?status=filed" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Upcoming */}
        <div className="card p-5 lg:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Bell size={18} className="text-[var(--accent)]" /> Agli due dates</h2>
            <Link href="/filings" className="text-sm text-[var(--accent)] flex items-center gap-1">Sab dekho <ArrowRight size={14} /></Link>
          </div>
          <div className="space-y-3">
            {upcoming.map((f) => <DeadlineRow key={f.id} f={f} />)}
            {upcoming.length === 0 && <p className="text-[var(--muted)] text-sm">Aane wali koi due date nahi hai. 🎉</p>}
          </div>
        </div>

        {/* Health */}
        <div className="card p-5 lg:col-span-4">
          <h2 className="font-semibold flex items-center gap-2 mb-4"><Heart size={18} className="text-[var(--accent)]" /> Compliance health</h2>
          <div className="flex items-center gap-5">
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border)" strokeWidth="9" />
                  <circle cx="60" cy="60" r="54" fill="none" stroke={ringColor} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">{score}%</div>
              </div>
              <div className="mt-2 text-sm font-semibold" style={{ color: ringColor }}>
                {score >= 80 ? '✔ Healthy' : score >= 50 ? '! Needs attention' : '✖ Critical'}
              </div>
              <div className="text-xs text-[var(--muted)]">Risk: {risk}</div>
            </div>
            <ul className="space-y-3 text-sm flex-1">
              {checks.map(([t, ok]) => (
                <li key={t} className="flex items-center justify-between gap-2">
                  <span className="text-[var(--muted)]">{t}</span>
                  <CheckCircle2 size={18} className={ok ? 'text-green-500' : 'text-red-500'} />
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-[var(--muted)] mt-4">Score = overdue na hone wali filings ka hissa.</p>
        </div>

        {/* System (admin) / Brand */}
        {isAdmin ? (
          <div className="card p-5 lg:col-span-3 flex flex-col">
            <h2 className="font-semibold flex items-center gap-2 mb-4"><Activity size={18} className="text-[var(--accent)]" /> Reminder engine</h2>
            {run ? (
              <div className="space-y-2 text-sm flex-1">
                <div className="text-[var(--muted)]">Aakhri run</div>
                <div className="font-semibold">{new Date(run.ran_at).toLocaleString('en-IN')}</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="badge badge-blue">{run.reminders_sent} reminder</span>
                  <span className="badge badge-yellow">{run.escalations_sent} escalation</span>
                  {run.errors > 0 ? <span className="badge badge-red">{run.errors} error</span> : <span className="badge badge-green">0 error</span>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)] flex-1">Abhi tak koi run nahi hua.</p>
            )}
            <Link href="/settings" className="btn btn-outline mt-4">Settings me dekho</Link>
          </div>
        ) : (
          <div className="card lg:col-span-3 p-5 flex flex-col items-center justify-center text-center"
            style={{ background: 'linear-gradient(160deg, var(--accent-soft), var(--bg))' }}>
            <ShieldCheck size={44} className="text-[var(--accent)] mb-2" />
            <div className="text-xl font-bold">Compliance<span className="text-[var(--accent)]">OS</span></div>
            <p className="text-sm text-[var(--muted)] mt-2">Stay Compliant. Always.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* My tasks */}
        <div className="card p-5 lg:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><ListTodo size={18} className="text-[var(--accent)]" /> Mere kaam</h2>
            <span className="badge badge-gray">{mine.length}</span>
          </div>
          <div className="space-y-3">
            {mine.slice(0, 5).map((f) => <DeadlineRow key={f.id} f={f} />)}
            {mine.length === 0 && <p className="text-[var(--muted)] text-sm">Aap par koi pending kaam nahi hai. 🎉</p>}
            {mine.length > 5 && <p className="text-xs text-[var(--muted)]">+ {mine.length - 5} aur kaam</p>}
          </div>
        </div>

        {/* Progress */}
        <div className="card p-5 lg:col-span-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><ClipboardList size={18} className="text-green-500" /> Filing progress</h2>
            <Link href="/analytics" className="text-sm text-green-500 flex items-center gap-1">Analytics <ArrowRight size={14} /></Link>
          </div>
          <div className="space-y-4">
            {progress.map(([n, v]) => {
              const pct = Math.round((v.filed / v.total) * 100)
              const c = pct >= 80 ? '#22c55e' : pct >= 50 ? '#facc15' : '#ef4444'
              return (
                <div key={n}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="truncate">{n}</span>
                    <span className="text-xs text-[var(--muted)]">{v.filed}/{v.total} · {pct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[var(--border)]">
                    <div className="h-2.5 rounded-full" style={{ width: pct + '%', background: c }} />
                  </div>
                </div>
              )
            })}
            {progress.length === 0 && <p className="text-[var(--muted)] text-sm">Filing add karte hi progress yahan dikhega.</p>}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card p-5 lg:col-span-3">
          <h2 className="font-semibold flex items-center gap-2 mb-4"><Zap size={18} className="text-yellow-400" /> Quick actions</h2>
          <div className="space-y-2">
            {actions.map(([t, Icon, href]) => (
              <Link key={t} href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition">
                <Icon size={18} className="text-[var(--accent)]" /> {t}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}