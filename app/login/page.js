'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'red')
    supabase.auth.getSession().then(({ data }) => { if (data.session) router.push('/') })
  }, [router])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMsg(error.message === 'Invalid login credentials' ? 'Email ya password galat hai.' : error.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <ShieldCheck size={56} className="text-[var(--accent)]" />
          <h1 className="text-3xl font-bold mt-3">Compliance<span className="text-[var(--accent)]">OS</span></h1>
          <p className="text-sm text-[var(--muted)] mt-1">Stay Compliant. Always.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-8 space-y-5">
          <div>
            <h2 className="text-xl font-semibold">Wapas swagat hai 👋</h2>
            <p className="text-sm text-[var(--muted)] mt-1">Apne account se login karo.</p>
          </div>

          <div>
            <label className="label">Email</label>
            <input className="w-full" type="email" required autoComplete="email" placeholder="aap@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input className="w-full pr-10" type={show ? 'text' : 'password'} required autoComplete="current-password"
                placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-label="Password dikhao">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {msg && <div className="text-sm rounded-lg px-3 py-2 badge-red" style={{ display: 'block', borderRadius: 10 }}>{msg}</div>}

          <button disabled={loading} className="btn btn-primary w-full py-3">
            {loading && <Loader2 size={16} className="animate-spin" />} {loading ? 'Ruko...' : 'Login'}
          </button>

          <p className="text-xs text-center text-[var(--muted)]">
            Account chahiye? Apne admin se sampark karo.
          </p>
        </form>
      </div>
    </div>
  )
}