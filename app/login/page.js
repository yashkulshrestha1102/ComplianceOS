'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ShieldCheck, Eye, EyeOff, Loader2, ArrowLeft, MailCheck, AlertCircle } from 'lucide-react'

// ?next=/filings jaise path par hi wapas bhejo, bahari link par kabhi nahi
function safeNext() {
  const n = new URLSearchParams(window.location.search).get('next') || '/'
  return n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/login') ? n : '/'
}

function friendlyError(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email ya password galat hai.'
  if (m.includes('email not confirmed')) return 'Ye account abhi confirm nahi hua. Apne admin se kaho.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Bahut zyada koshish ho gayi. Thodi der baad dobara try karo.'
  if (m.includes('fetch')) return 'Internet ya server ki dikkat hai. Dobara try karo.'
  return msg || 'Kuch gadbad ho gayi. Dobara try karo.'
}

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // login | forgot | sent
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let saved = localStorage.getItem('theme') || 'teal'
if (saved === 'red') saved = 'teal'
document.documentElement.setAttribute('data-theme', saved)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(safeNext())
    })
  }, [router])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setMsg(friendlyError(error.message))
      setLoading(false)
      return
    }
    router.replace(safeNext())
  }

  async function handleForgot(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    // Rate limit ke alawa har haal me wahi message, taaki koi pata na laga sake ki email exist karti hai ya nahi
    if (error && /rate|too many/i.test(error.message)) {
      setMsg(friendlyError(error.message))
      return
    }
    setMode('sent')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <ShieldCheck size={56} className="text-[var(--accent)]" />
          <h1 className="text-3xl font-bold mt-3">Compliance<span className="text-[var(--accent)]">OS</span></h1>
          <p className="text-sm text-[var(--muted)] mt-1">Stay Compliant. Always.</p>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="card p-8 space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Wapas swagat hai 👋</h2>
              <p className="text-sm text-[var(--muted)] mt-1">Apne account se login karo.</p>
            </div>

            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="w-full" type="email" required autoFocus autoComplete="email"
                placeholder="aap@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="password">Password</label>
                <button type="button" className="text-xs text-[var(--accent)] mb-1.5"
                  onClick={() => { setMsg(''); setMode('forgot') }}>
                  Password bhool gaye?
                </button>
              </div>
              <div className="relative">
                <input id="password" className="w-full pr-10" type={show ? 'text' : 'password'} required
                  autoComplete="current-password" placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock') || false)} />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                  aria-label={show ? 'Password chhupao' : 'Password dikhao'}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {caps && <p className="text-xs text-amber-400 mt-1.5">Caps Lock on hai.</p>}
            </div>

            {msg && (
              <div className="flex items-start gap-2 text-sm rounded-lg px-3 py-2 badge-red" style={{ borderRadius: 10 }} role="alert">
                <AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{msg}</span>
              </div>
            )}

            <button disabled={loading} className="btn btn-primary w-full py-3">
              {loading && <Loader2 size={16} className="animate-spin" />} {loading ? 'Ruko...' : 'Login'}
            </button>

            <p className="text-xs text-center text-[var(--muted)]">
              Account chahiye? Apne admin se sampark karo.
            </p>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="card p-8 space-y-5">
            <button type="button" className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-white"
              onClick={() => { setMsg(''); setMode('login') }}>
              <ArrowLeft size={14} /> Wapas login par
            </button>
            <div>
              <h2 className="text-xl font-semibold">Password reset karo</h2>
              <p className="text-sm text-[var(--muted)] mt-1">Apni email likho, hum reset link bhejenge.</p>
            </div>

            <div>
              <label className="label" htmlFor="femail">Email</label>
              <input id="femail" className="w-full" type="email" required autoFocus autoComplete="email"
                placeholder="aap@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            {msg && (
              <div className="flex items-start gap-2 text-sm rounded-lg px-3 py-2 badge-red" style={{ borderRadius: 10 }} role="alert">
                <AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{msg}</span>
              </div>
            )}

            <button disabled={loading} className="btn btn-primary w-full py-3">
              {loading && <Loader2 size={16} className="animate-spin" />} Reset link bhejo
            </button>
          </form>
        )}

        {mode === 'sent' && (
          <div className="card p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
              <MailCheck size={28} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-semibold">Email check karo</h2>
            <p className="text-sm text-[var(--muted)]">
              Agar <b>{email}</b> se account juda hai to reset link abhi aa jayega. Spam folder bhi dekh lena.
            </p>
            <button className="btn btn-outline w-full" onClick={() => { setMode('login'); setMsg('') }}>Wapas login par</button>
          </div>
        )}
      </div>
    </div>
  )
}