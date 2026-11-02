'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ShieldCheck, Loader2, KeyRound, AlertCircle } from 'lucide-react'
import { toast } from '@/components/Feedback'

export default function ResetPassword() {
  const router = useRouter()
  const [state, setState] = useState('waiting') // waiting | ready | invalid
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'red')

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setState('ready')
    })
    supabase.auth.getSession().then(({ data }) => { if (data.session) setState('ready') })

    // Link se session na bane to 3 second baad "invalid" dikhao
    const t = setTimeout(() => setState((s) => (s === 'waiting' ? 'invalid' : s)), 3000)
    return () => { clearTimeout(t); sub.subscription.unsubscribe() }
  }, [])

  async function submit(e) {
    e.preventDefault()
    setMsg('')
    if (a.length < 8) return setMsg('Password kam se kam 8 characters ka rakho.')
    if (a !== b) return setMsg('Dono password match nahi karte.')
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: a })
    setSaving(false)
    if (error) return setMsg(error.message)
    toast.success('Password badal gaya ✅')
    router.replace('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <ShieldCheck size={56} className="text-[var(--accent)]" />
          <h1 className="text-3xl font-bold mt-3">Compliance<span className="text-[var(--accent)]">OS</span></h1>
        </div>

        {state === 'waiting' && (
          <div className="card p-8 flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
            <p className="text-sm text-[var(--muted)]">Link check ho raha hai...</p>
          </div>
        )}

        {state === 'invalid' && (
          <div className="card p-8 text-center space-y-4">
            <AlertCircle size={36} className="mx-auto text-red-400" />
            <h2 className="text-xl font-semibold">Link kaam nahi kar raha</h2>
            <p className="text-sm text-[var(--muted)]">Ye link purana ho gaya hai ya pehle hi use ho chuka hai. Naya reset link mangwao.</p>
            <button className="btn btn-primary w-full" onClick={() => router.replace('/login')}>Login page par jao</button>
          </div>
        )}

        {state === 'ready' && (
          <form onSubmit={submit} className="card p-8 space-y-5">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2"><KeyRound size={20} className="text-[var(--accent)]" /> Naya password</h2>
              <p className="text-sm text-[var(--muted)] mt-1">Kam se kam 8 characters ka password rakho.</p>
            </div>

            <div>
              <label className="label">Naya password</label>
              <input className="w-full" type="password" required autoFocus minLength={8} autoComplete="new-password"
                value={a} onChange={(e) => setA(e.target.value)} />
            </div>
            <div>
              <label className="label">Dobara likho</label>
              <input className="w-full" type="password" required minLength={8} autoComplete="new-password"
                value={b} onChange={(e) => setB(e.target.value)} />
            </div>

            {msg && (
              <div className="flex items-start gap-2 text-sm rounded-lg px-3 py-2 badge-red" style={{ borderRadius: 10 }} role="alert">
                <AlertCircle size={16} className="shrink-0 mt-0.5" /> <span>{msg}</span>
              </div>
            )}

            <button disabled={saving} className="btn btn-primary w-full py-3">
              {saving && <Loader2 size={16} className="animate-spin" />} Password save karo
            </button>
          </form>
        )}
      </div>
    </div>
  )
}