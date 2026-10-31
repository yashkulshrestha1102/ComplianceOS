'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) setMsg(error.message)
      else {
        setMsg('Account ban gaya! Ab login karo.')
        setMode('login')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg(error.message)
      else router.push('/')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center">Compliance Tracker</h1>
        <p className="text-center text-gray-500">{mode === 'login' ? 'Login karo' : 'Naya account banao'}</p>

        {mode === 'signup' && (
          <input className="w-full border p-2 rounded" placeholder="Poora naam"
            value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        )}
        <input className="w-full border p-2 rounded" type="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full border p-2 rounded" type="password" placeholder="Password (min 6 characters)"
          value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

        <button disabled={loading} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          {loading ? 'Ruko...' : mode === 'login' ? 'Login' : 'Sign up'}
        </button>

        {msg && <p className="text-sm text-center text-red-600">{msg}</p>}

        <p className="text-sm text-center text-gray-600 cursor-pointer"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Account nahi hai? Sign up' : 'Account hai? Login'}
        </p>
      </form>
    </div>
  )
}