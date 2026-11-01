'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Send, Phone } from 'lucide-react'
import EscalationSettings from '@/components/EscalationSettings'

export default function Settings() {
  const [uid, setUid] = useState('')
  const [phone, setPhone] = useState('')
  const [tgId, setTgId] = useState(null)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data: s } = await supabase.auth.getSession()
    if (!s.session) return
    setUid(s.session.user.id)
    const { data: p } = await supabase.from('profiles')
      .select('phone, telegram_chat_id').eq('id', s.session.user.id).single()
    setPhone(p?.phone || '')
    setTgId(p?.telegram_chat_id || null)
  }
  useEffect(() => { load() }, [])

  async function savePhone() {
    const { error } = await supabase.from('profiles').update({ phone }).eq('id', uid)
    setMsg(error ? error.message : 'Phone save ho gaya ✅')
  }

  async function verifyTelegram() {
    setMsg('Check kar rahe hain...')
    const { data: s } = await supabase.auth.getSession()
    const res = await fetch('/api/telegram/link', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.session.access_token}` },
    })
    const json = await res.json()
    setMsg(json.ok ? 'Telegram connect ho gaya ✅' : json.error)
    load()
  }

  const botLink = `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=${uid}`

  return (
    <div className="px-8 pb-10 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Phone size={18} className="text-[var(--accent)]" /> Mera phone / WhatsApp number</h2>
        <input className="border p-2 rounded w-full" placeholder="91XXXXXXXXXX"
          value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button onClick={savePhone} className="bg-[var(--accent)] text-white px-4 py-2 rounded">Save</button>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Send size={18} className="text-sky-400" /> Telegram reminders</h2>
        <p className="text-sm text-[var(--muted)]">
          Status: {tgId ? '✅ Connected' : '❌ Connect nahi hai'}
        </p>
        <ol className="text-sm text-[var(--muted)] list-decimal ml-5 space-y-1">
          <li>Niche wale button se Telegram me bot kholo.</li>
          <li>Wahan <b>START</b> dabao.</li>
          <li>Yahan wapas aake <b>Verify</b> dabao.</li>
        </ol>
        <div className="flex gap-3">
          <a href={botLink} target="_blank" rel="noreferrer" className="bg-sky-600 text-white px-4 py-2 rounded">Telegram kholo</a>
          <button onClick={verifyTelegram} className="border border-[var(--accent)] text-[var(--accent)] px-4 py-2 rounded">Verify</button>
        </div>
      </div>
            <EscalationSettings />
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  )
}