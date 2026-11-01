'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui'
import {
  CalendarDays, AlertTriangle, CheckCircle2, Users, Mail, MessageCircle, Bell,
  Heart, Plus, Zap, ShieldCheck, ArrowRight, ClipboardList,
} from 'lucide-react'

const todayStr = () => new Date().toLocaleDateString('en-CA')
const daysLeft = (d) => Math.round((new Date(d) - new Date(todayStr())) / 86400000)

function Spark({ color }) {
  return (
    <svg viewBox="0 0 100 30" className="w-20 h-8 hidden sm:block">
      <path d="M0 25 C15 10,25 28,40 15 S65 5,75 14 S92 4,100 6" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  )
}

function Stat({ icon: Icon, value, label, color }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '26' }}>
        <Icon size={28} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-sm text-[var(--muted)]">{label}</div>
      </div>
      <Spark color={color} />
    </div>
  )
}

const prio = (d) => (d <= 5 ? 'High' : d <= 7 ? 'Medium' : 'Low')
const prioStyle = {
  High: { background: '#7f1d1d', color: '#fecaca' },
  Medium: { background: '#9a4a0a', color: '#fed7aa' },
  Low: { background: '#1d4ed8', color: '#dbeafe' },
}
const dateBoxColor = { High: '#b91c1c', Medium: '#c2410c', Low: '#374151' }

export default function Dashboard() {
  const [filings, setFilings] = useState(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [now, setNow] = useState(null)

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 60000)

    async function load() {
      const { data: s } = await supabase.auth.getSession()
      if (s.session) {
        const { data: p } = await supabase.from('profiles').select('full_name, role').eq('id', s.session.user.id).single()
        setName((p?.full_name || '').split(' ')[0])
        setRole(p?.role || '')
      }
      const { data } = await supabase.from('filings')
        .select('*, clients(name), filing_types(name), filing_assignees(user_id, profiles(full_name))')
        .order('due_date')
      setFilings(data || [])
    }
    load()
    return () => clearInterval(t)
  }, [])

  const hour = now ? now.getHours() : 9
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4 pt-2">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{greet}{name ? `, ${name}` : ''}! 👋</h1>
        <p className="text-[var(--muted)] mt-1">Here&apos;s your compliance overview for today.</p>
      </div>
      {now && (
        <div className="card px-5 py-3 text-sm flex items-center gap-4">
          <span className="flex items-center gap-2"><CalendarDays size={16} className="text-[var(--accent)]" />
            {now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <span>{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}
    </div>
  )

  if (filings === null) {
    return (
      <div className="page space-y-6">
        {header}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Skeleton className="h-64 lg:col-span-5" />
          <Skeleton className="h-64 lg:col-span-4" />
          <Skeleton className="h-64 lg:col-span-3" />
        </div>
      </div>
    )
  }

  const open = filings.filter((f) => f.status !== 'filed')
  const overdue = open.filter((f) => daysLeft(f.due_date) < 0)
  const dueSoon = open.filter((f) => daysLeft(f.due_date) >= 0 && daysLeft(f.due_date) <= 5)
  const total = filings.length
  const score = total === 0 ? 100 : Math.round(((total - overdue.length) / total) * 100)
  const users = new Set(filings.flatMap((f) => f.filing_assignees.map((a) => a.user_id))).size
  const canEdit = role === 'admin' || role === 'staff'

  const ringColor = score >= 80 ? 'var(--good)' : score >= 50 ? '#f59e0b' : '#ef4444'
  const C = 2 * Math.PI * 54

  const byType = {}
  filings.forEach((f) => {
    const n = f.filing_types?.name || 'Other'
    byType[n] = byType[n] || { total: 0, filed: 0 }
    byType[n].total++
    if (f.status === 'filed') byType[n].filed++
  })
  const progress = Object.entries(byType).slice(0, 4)
  const upcoming = open.slice(0, 4)

  const actions = [
    ['Add Filing', Plus, '/filings', canEdit],
    ['Set Reminder', Bell, '/recurring', canEdit],
    ['View Reports', ClipboardList, '/reports', true],
    ['Manage Clients', Users, '/clients', canEdit],
  ].filter((a) => a[3])

  return (
    <div className="page space-y-6">
      {header}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat icon={CalendarDays} value={total} label="Total Filings" color="#3b82f6" />
        <Stat icon={AlertTriangle} value={dueSoon.length} label="Due Soon (within 5 days)" color="#ef4444" />
        <Stat icon={CheckCircle2} value={`${score}%`} label="Compliance Score" color="#22c55e" />
        <Stat icon={Users} value={users} label="Assigned Users" color="#3b82f6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Upcoming reminders */}
        <div className="card p-5 lg:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Bell size={18} className="text-[var(--accent)]" /> Upcoming Reminders</h2>
            <Link href="/filings" className="text-sm text-[var(--accent)] flex items-center gap-1">View All <ArrowRight size={14} /></Link>
          </div>
          <div className="space-y-3">
            {upcoming.map((f) => {
              const d = daysLeft(f.due_date)
              const p = d < 0 ? 'High' : prio(d)
              const dt = new Date(f.due_date)
              const who = f.filing_assignees.map((a) => a.profiles?.full_name).filter(Boolean).join(', ') || 'Unassigned'
              return (
                <div key={f.id} className="flex items-center gap-3">
                  <div className="w-12 h-14 rounded-lg flex flex-col items-center justify-center text-white shrink-0"
                    style={{ background: dateBoxColor[p] }}>
                    <span className="text-lg font-bold leading-none">{dt.getUTCDate()}</span>
                    <span className="text-xs">{dt.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{f.filing_types?.name} <span className="text-[var(--muted)] font-normal text-sm">· {f.clients?.name}</span></div>
                    <div className="text-xs text-[var(--muted)] truncate">
                      {d < 0 ? `Overdue by ${-d} days` : d === 0 ? 'Due today' : `Due in ${d} days`} · {who}
                    </div>
                  </div>
                  <div className="hidden sm:flex gap-2">
                    {f.channels.includes('email') && <Mail size={16} className="text-sky-400" />}
                    {f.channels.includes('whatsapp') && <MessageCircle size={16} className="text-green-500" />}
                    {f.channels.includes('push') && <Bell size={16} className="text-orange-400" />}
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={prioStyle[p]}>{p}</span>
                </div>
              )
            })}
            {upcoming.length === 0 && <p className="text-[var(--muted)] text-sm">Koi pending filing nahi hai. 🎉</p>}
          </div>
        </div>

        {/* Compliance health */}
        <div className="card p-5 lg:col-span-4">
          <h2 className="font-semibold flex items-center gap-2 mb-4"><Heart size={18} className="text-[var(--accent)]" /> Compliance Health</h2>
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
                {score >= 80 ? '✔ Healthy' : score >= 50 ? '! Needs Attention' : '✖ Critical'}
              </div>
            </div>
            <ul className="space-y-3 text-sm flex-1">
              {[
                ['Timely Filings', score >= 80],
                ['No Overdue Dues', overdue.length === 0],
                ['All Clients Active', true],
                ['Risk Level: ' + (overdue.length === 0 ? 'Low' : overdue.length < 3 ? 'Medium' : 'High'), overdue.length === 0],
              ].map(([t, ok]) => (
                <li key={t} className="flex items-center justify-between gap-2">
                  <span className="text-[var(--muted)]">{t}</span>
                  <CheckCircle2 size={18} className={ok ? 'text-green-500' : 'text-red-500'} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Banner */}
        <div className="card lg:col-span-3 p-5 flex flex-col items-center justify-center text-center"
          style={{ background: 'linear-gradient(160deg, var(--accent-soft), var(--bg))' }}>
          <ShieldCheck size={44} className="text-[var(--accent)] mb-2" />
          <div className="text-xl font-bold">Compliance<span className="text-[var(--accent)]">OS</span></div>
          <p className="text-sm text-[var(--muted)] mt-2">Your Complete Compliance Management Partner</p>
          {canEdit && (
            <Link href="/filings" className="btn btn-primary mt-4">Add Filing <ArrowRight size={14} /></Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="card p-5 lg:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><ClipboardList size={18} className="text-green-500" /> Filing Progress</h2>
            <Link href="/filings" className="text-sm text-green-500 flex items-center gap-1">View Details <ArrowRight size={14} /></Link>
          </div>
          <div className="space-y-4">
            {progress.map(([n, v]) => {
              const pct = Math.round((v.filed / v.total) * 100)
              const c = pct >= 80 ? '#22c55e' : pct >= 50 ? '#facc15' : '#ef4444'
              return (
                <div key={n} className="flex items-center gap-3 text-sm">
                  <span className="w-24 sm:w-28 truncate">{n}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-[var(--border)]">
                    <div className="h-2.5 rounded-full" style={{ width: pct + '%', background: c }} />
                  </div>
                  <span className="w-10 text-right">{pct}%</span>
                </div>
              )
            })}
            {progress.length === 0 && <p className="text-[var(--muted)] text-sm">Filing add karte hi progress yahan dikhega.</p>}
          </div>
        </div>

        <div className="card p-5 lg:col-span-7">
          <h2 className="font-semibold flex items-center gap-2 mb-4"><Zap size={18} className="text-yellow-400" /> Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {actions.map(([t, Icon, href]) => (
              <Link key={t} href={href}
                className="card p-4 flex flex-col items-center gap-2 text-sm hover:border-[var(--accent)] transition">
                <Icon size={26} className="text-[var(--accent)]" />
                {t}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}