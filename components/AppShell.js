'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import NotificationBell from './NotificationBell'
import {
  LayoutDashboard, FileText, AlarmClock, Users, Bell, ClipboardList, BarChart3,
  Settings, HelpCircle, ShieldCheck, Search, Leaf, LogOut, Crown, ChevronDown, UserCog,Repeat ,Upload
} from 'lucide-react'

const items = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/filings', label: 'My Filings', icon: FileText },
  { href: '/reminders', label: 'Reminders', icon: AlarmClock },
  { href: '/clients', label: 'Clients', icon: Users, roles: ['admin', 'staff'] },
  { href: '/notifications', label: 'Notifications', icon: Bell, badge: true },
  { href: '/reports', label: 'Reports', icon: ClipboardList },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/team', label: 'Team & Roles', icon: UserCog, roles: ['admin'] },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help & Support', icon: HelpCircle },
  { href: '/recurring', label: 'Recurring', icon: Repeat, roles: ['admin', 'staff'] },
  { href: '/import', label: 'Bulk Import', icon: Upload, roles: ['admin', 'staff'] },
]

const roleLabel = { admin: 'Super Admin', staff: 'Staff', client: 'Client' }

export default function AppShell({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [theme, setTheme] = useState('red')
  const [profile, setProfile] = useState({ name: '', email: '', role: '' })
  const [dueCount, setDueCount] = useState(0)

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'red'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  useEffect(() => {
    if (pathname === '/login') return
    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return router.push('/login')
      const u = data.session.user
      const { data: p } = await supabase.from('profiles').select('full_name, role').eq('id', u.id).single()
      setProfile({ name: p?.full_name || u.email, email: u.email, role: p?.role || 'staff' })

      const { data: f } = await supabase.from('filings').select('due_date,status').neq('status', 'filed')
      const today = new Date().toLocaleDateString('en-CA')
      const limit = new Date(Date.now() + 5 * 86400000).toLocaleDateString('en-CA')
      setDueCount((f || []).filter((x) => x.due_date >= today && x.due_date <= limit).length)
    }
    init()
  }, [pathname, router])

  function toggleTheme() {
    const next = theme === 'red' ? 'jungle' : 'red'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (pathname === '/login') return children

  const visible = items.filter((i) => !i.roles || i.roles.includes(profile.role))

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 p-4 flex flex-col border-r border-[var(--border)] bg-[var(--panel)]">
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
          <ShieldCheck size={40} className="text-[var(--accent)]" />
          <div>
            <div className="text-xl font-bold leading-none">Compliance<span className="text-[var(--accent)]">OS</span></div>
            <div className="text-xs text-[var(--muted)] mt-1">Stay Compliant. Always.</div>
          </div>
        </div>

        <nav className="space-y-1">
          {visible.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  active ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-white'
                }`}
                style={active ? { boxShadow: '0 0 18px var(--glow)' } : {}}>
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {badge && dueCount > 0 && (
                  <span className="bg-[var(--accent)] text-white text-xs rounded-full px-2 py-0.5">{dueCount}</span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto space-y-3 pt-6">
          <div className="card p-4" style={{ borderColor: 'var(--accent)' }}>
            <div className="flex items-center gap-2">
              <Crown className="text-yellow-400" size={26} />
              <div>
                <div className="text-sm font-semibold text-yellow-400">Pro Plan</div>
                <div className="text-xs text-[var(--muted)]">Active Forever (Free)</div>
              </div>
            </div>
          </div>

          <div className="card p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center font-bold">
              {(profile.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{profile.name}</div>
              <div className="text-xs text-[var(--muted)]">{roleLabel[profile.role] || ''}</div>
            </div>
            <ChevronDown size={16} className="text-[var(--muted)]" />
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="flex items-center gap-4 px-8 py-4">
          <div className="flex-1 card flex items-center gap-3 px-4 py-2.5 rounded-full">
            <Search size={18} className="text-[var(--muted)]" />
            <input className="bg-transparent outline-none w-full text-sm"
              style={{ background: 'transparent' }}
              placeholder="Search filings, clients, or features..." />
          </div>

          <button onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-soft)]">
            <Leaf size={16} /> {theme === 'red' ? 'Switch to Jungle Theme' : 'Switch to Classic Theme'}
          </button>

          <NotificationBell />

          <button onClick={logout} className="p-2.5 card rounded-full" title="Logout"><LogOut size={20} /></button>
        </header>

        <main>{children}</main>
      </div>
    </div>
  )
}