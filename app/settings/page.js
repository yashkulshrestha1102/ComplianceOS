'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Settings as SettingsIcon, User, Send, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import EscalationSettings from '@/components/EscalationSettings'

export default function Settings() {
  const [uid, setUid] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tgId, setTgId] = useState(null)
  const [notice, setNotice] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)

  async function load() {
    const { data: s } = await supabase.auth.getSession()
    if (!s.session) return
    setUid(s.session.user.id)
    setEmail(s.session.user.email)
    const { data: p } = await supabase.from('profiles')
      .select('full_name, phone, telegram_chat_id').eq('id', s.session.user.id).single()
    setName(p?.full_name || '')
    setPhone(p?.phone || '')
    setTgId(p?.telegram_chat_id || null)
  }
  useEffect(() => { load() }, [])

  function flash(text) {
    setNotice(text)
    setTimeout(() => setNotice(''), 4000)
  }

  async function saveProfile(e) {
    e.preventDefault()
    setErr('')
    let digits = phone.replace(/\D/g, '')
    if (digits.length === 10) digits = '91' + digits
    if (digits && (digits.length < 10 || digits.length > 13)) return setErr('Phone number galat hai')

    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: digits }).eq('id', uid)
    setSaving(false)
    if (error) return setErr(error.message)
    setPhone(digits)
    flash('Profile save ho gaya ✅')
  }

  async function verifyTelegram() {
    setErr('')
    setVerifying(true)
    const { data: s } = await supabase.auth.getSession()
    const res = await fetch('/api/telegram/link', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.session.access_token}` },
    })
    const json = await res.json()
    setVerifying(false)
    if (json.ok) flash('Telegram connect ho gaya ✅')
    else setErr(json.error)
    load()
  }

  const botLink = `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=${uid}`

  return (
    <div className="page">
      <PageHeader icon={SettingsIcon} title="Settings" subtitle="Apna profile, Telegram aur alert rules" />

      <div className="max-w-2xl space-y-5">
        {notice && <div className="badge badge-green px-4 py-2 text-sm">{notice}</div>}
        {err && <p className="text-sm text-red-400">{err}</p>}

        <form onSubmit={saveProfile} className="card p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><User size={18} className="text-[var(--accent)]" /> Mera profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Poora naam</label>
              <input className="w-full" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="w-full" value={email} disabled style={{ opacity: 0.6 }} />
            </div>
          </div>
          <div>
            <label className="label">Phone / WhatsApp</label>
            <input className="w-full" placeholder="9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />} Save karo
          </button>
        </form>

        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Send size={18} className="text-sky-400" /> Telegram reminders</h2>
            {tgId ? <span className="badge badge-green">Connected</span> : <span className="badge badge-gray">Connect nahi hai</span>}
          </div>
          <ol className="text-sm text-[var(--muted)] list-decimal ml-5 space-y-1">
            <li>Neeche wale button se Telegram me bot kholo.</li>
            <li>Wahan <b>START</b> dabao.</li>
            <li>Yahan wapas aake <b>Verify</b> dabao.</li>
          </ol>
          <div className="flex flex-wrap gap-3">
            <a href={botLink} target="_blank" rel="noreferrer" className="btn btn-primary">Telegram kholo</a>
            <button onClick={verifyTelegram} disabled={verifying} className="btn btn-outline">
              {verifying && <Loader2 size={16} className="animate-spin" />} Verify
            </button>
          </div>
        </div>

        <EscalationSettings />
      </div>
    </div>
  )
}