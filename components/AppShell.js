'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import NotificationBell from './NotificationBell'
import {
  LayoutDashboard, FileText, AlarmClock, Users, Bell, ClipboardList, BarChart3, Settings,
  HelpCircle, ShieldCheck, Search, Leaf, LogOut, UserCog, Repeat, Upload, Menu, Briefcase,
  ListChecks, Loader2,
} from 'lucide-react'

const groups = [
  { label: 'Overview', items: [
    { href: '/portal', label: 'My Portal', icon: Briefcase, roles: ['client'] },
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'staff'] },
    { href: '/filings', label: 'My Filings', icon: FileText, roles: ['admin', 'staff'] },
    { href: '/reminders', label: 'Reminders', icon: AlarmClock, roles: ['admin', 'staff'] },
    { href: '/notifications', label: 'Notifications', icon: Bell },
  ] },
  { label: 'Manage', items: [
    { href: '/recurring', label: 'Recurring', icon: Repeat, roles: ['admin', 'staff'] },
    { href: '/clients', label: 'Clients', icon: Users, roles: ['admin', 'staff'] },
    { href: '/filing-types', label: 'Filing Types', icon: ListChecks, roles: ['admin'] },
    { href: '/import', label: 'Bulk Import', icon: Upload, roles: ['admin', 'staff'] },
  ] },
  { label: 'Insights', items: [
    { href: '/reports', label: 'Reports', icon: ClipboardList, roles: ['admin', 'staff'] },
    { href: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['admin', 'staff'] },
  ] },
  { label: 'Account', items: [
    { href: '/team', label: 'Team & Roles', icon: UserCog, roles: ['admin'] },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/help', label: 'Help & Support', icon: HelpCircle },
  ] },
]

const roleLabel = { admin: 'Super Admin', staff: 'Staff', client: 'Client' }
const CLIENT_PATHS = ['/portal', '/notifications', '/settings', '/help']
const ADMIN_PATHS = ['/team', '/filing-types']
const PUBLIC_PATHS = ['/login', '/reset-password']

function canAccess(path, role) {
  if (role === 'client') return CLIENT_PATHS.includes(path)
  if (role === 'admin') return true
  return !ADMIN_PATHS.includes(path)
}

export default function AppShell({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [theme, setTheme] = useState('red')
  const [profile, setProfile] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'red'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  // Login check: sirf ek baar, aur login/logout par
  useEffect(() => {
    let active = true

    async function loadProfile(session) {
      if (!session) {
        if (active) { setProfile(null); setAuthChecked(true) }
        return
      }
      const { data: p } = await supabase.from('profiles')
        .select('full_name, role').eq('id', session.user.id).single()
      if (!active) return
      setProfile({ name: p?.full_name || session.user.email, email: session.user.email, role: p?.role || 'staff' })
      setAuthChecked(true)
    }

    supabase.auth.getSession().then(({ data }) => loadProfile(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') router.replace('/reset-password')
      if (event === 'SIGNED_OUT') { setProfile(null); setAuthChecked(true) }
      if (event === 'SIGNED_IN') {
        setAuthChecked(false)
        setTimeout(() => loadProfile(session), 0)
      }
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  // Page ka access check (network nahi lagta)
  useEffect(() => {
    setOpen(false)
    
       if (!authChecked || PUBLIC_PATHS.includes(pathname)) return
    if (!profile) {
      router.replace(pathname === '/' ? '/login' : `/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    if (!canAccess(pathname, profile.role)) router.replace(profile.role === 'client' ? '/portal' : '/')
  }, [authChecked, profile, pathname, router])

  function toggleTheme() {
    const next = theme === 'red' ? 'jungle' : 'red'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function onSearch(e) {
    e.preventDefault()
    const text = q.trim()
    router.push(text ? `/filings?q=${encodeURIComponent(text)}` : '/filings')
    window.dispatchEvent(new CustomEvent('global-search', { detail: text }))
  }

    if (PUBLIC_PATHS.includes(pathname)) return children

  if (!authChecked || !profile || !canAccess(pathname, profile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
      </div>
    )
  }

  const sidebar = (
    <div className="flex flex-col min-h-full p-4">
      <div className="flex items-center gap-3 px-2 py-3 mb-2">
        <ShieldCheck size={38} className="text-[var(--accent)]" />
        <div>
          <div className="text-xl font-bold leading-none">Compliance<span className="text-[var(--accent)]">OS</span></div>
          <div className="text-xs text-[var(--muted)] mt-1">Stay Compliant. Always.</div>
        </div>
      </div>

      <nav className="flex-1">
        {groups.map((g) => {
          const visible = g.items.filter((i) => !i.roles || i.roles.includes(profile.role))
          if (visible.length === 0) return null
          return (
            <div key={g.label} className="mt-4">
              <div className="px-3 mb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--muted)] opacity-70">{g.label}</div>
              <div className="space-y-0.5">
                {visible.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href
                  return (
                    <Link key={href} href={href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                        active ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-white'
                      }`}
                      style={active ? { boxShadow: '0 0 18px var(--glow)' } : {}}>
                      <Icon size={18} />
                      <span className="flex-1">{label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <Link href="/settings" className="card p-3 mt-6 flex items-center gap-3 hover:border-[var(--accent)] transition">
        <div className="w-10 h-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold">
          {(profile.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{profile.name}</div>
          <div className="text-xs text-[var(--muted)]">{roleLabel[profile.role] || ''}</div>
        </div>
      </Link>
    </div>
  )

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:block w-64 shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-[var(--border)] bg-[var(--panel)]">
        {sidebar}
      </aside>

      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-72 max-w-[85vw] h-full overflow-y-auto bg-[var(--panel)] border-r border-[var(--border)]">{sidebar}</div>
          <div className="flex-1 bg-black/60" onClick={() => setOpen(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-8 py-4 backdrop-blur"
          style={{ background: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}>
          <button className="md:hidden card p-2.5 rounded-xl" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu size={20} />
          </button>

          {profile.role !== 'client' ? (
            <form onSubmit={onSearch} className="flex-1 card flex items-center gap-3 px-4 py-2.5 rounded-full">
              <Search size={18} className="text-[var(--muted)] shrink-0" />
              <input className="bare w-full text-sm outline-none" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Filing, client ya period dhundo... (Enter)" />
            </form>
          ) : <div className="flex-1" />}

          <button onClick={toggleTheme}
            className="flex items-center gap-2 px-3 lg:px-4 py-2.5 rounded-full text-sm border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            title="Theme badlo">
            <Leaf size={16} />
            <span className="hidden lg:inline">{theme === 'red' ? 'Switch to Jungle Theme' : 'Switch to Classic Theme'}</span>
          </button>

          <NotificationBell />

          <button onClick={logout} className="p-2.5 card rounded-full" title="Logout"><LogOut size={20} /></button>
        </header>

        <main>{children}</main>
      </div>
    </div>
  )
}