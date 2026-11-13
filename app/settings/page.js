'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Settings as SettingsIcon, User, Send, Loader2, KeyRound } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { toast, confirmDialog } from '@/components/Feedback'
import EscalationSettings from '@/components/EscalationSettings'
import SystemStatus from '@/components/SystemStatus'

export default function Settings() {
  const [uid, setUid] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tgId, setTgId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [linking, setLinking] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [pw, setPw] = useState({ a: '', b: '' })
  const [pwSaving, setPwSaving] = useState(false)

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

  // Telegram link ke baad connect hone ka intezaar (har 3 second check)
  useEffect(() => {
    if (!waiting) return
    let n = 0
    const t = setInterval(async () => {
      n++
      const { data: p } = await supabase.from('profiles').select('telegram_chat_id').eq('id', uid).single()
      if (p?.telegram_chat_id) {
        setTgId(p.telegram_chat_id)
        setWaiting(false)
        toast.success('Telegram connected ✅')
      } else if (n > 40) {
        setWaiting(false)
      }
    }, 3000)
    return () => clearInterval(t)
  }, [waiting, uid])

  async function saveProfile(e) {
    e.preventDefault()
    let digits = phone.replace(/\D/g, '')
    if (digits.length === 10) digits = '91' + digits
    if (digits && (digits.length < 10 || digits.length > 13)) return toast.error('Invalid phone number')

    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: digits }).eq('id', uid)
    setSaving(false)
    if (error) return toast.error(error.message)
    setPhone(digits)
    toast.success('Profile saved ✅')
  }

  async function changePassword(e) {
    e.preventDefault()
    if (pw.a.length < 8) return toast.error('Password must be at least 8 characters')
    if (pw.a !== pw.b) return toast.error('Passwords do not match')
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw.a })
    setPwSaving(false)
    if (error) return toast.error(error.message)
    setPw({ a: '', b: '' })
    toast.success('Password updated ✅')
  }

  async function connectTelegram() {
    setLinking(true)
    const w = window.open('', '_blank') // popup block se bachne ke liye pehle khol lo
    const { data: s } = await supabase.auth.getSession()
    const res = await fetch('/api/telegram/link', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.session.access_token}` },
    })
    const json = await res.json().catch(() => ({}))
    setLinking(false)
    if (!res.ok || !json.link) {
      w?.close()
      return toast.error(json.error || 'Could not create link')
    }
    if (w) w.location.href = json.link
    else window.location.href = json.link
    setWaiting(true)
  }

  async function disconnectTelegram() {
    const ok = await confirmDialog({
      title: 'Disconnect Telegram?',
      message: 'Reminders on Telegram will stop.',
      confirmText: 'Disconnect', danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('profiles').update({ telegram_chat_id: null }).eq('id', uid)
    if (error) return toast.error(error.message)
    setTgId(null)
    toast.success('Telegram disconnected')
  }

  return (
    <div className="page">
      <PageHeader icon={SettingsIcon} title="Settings" subtitle="Your profile, password, Telegram, and alert rules" />

      <div className="max-w-2xl space-y-5">
        <form onSubmit={saveProfile} className="card p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><User size={18} className="text-[var(--accent)]" /> My profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Full naam</label>
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
            {saving && <Loader2 size={16} className="animate-spin" />} Save
          </button>
        </form>

        <form onSubmit={changePassword} className="card p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><KeyRound size={18} className="text-[var(--accent)]" /> Change password</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">New password</label>
              <input className="w-full" type="password" autoComplete="new-password" minLength={8}
                value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input className="w-full" type="password" autoComplete="new-password" minLength={8}
                value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" disabled={pwSaving || !pw.a}>
            {pwSaving && <Loader2 size={16} className="animate-spin" />} Change password
          </button>
        </form>

        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Send size={18} className="text-sky-400" /> Telegram reminders</h2>
            {tgId ? <span className="badge badge-green">Connected</span> : <span className="badge badge-gray">Not connected</span>}
          </div>
          {tgId ? (
            <button onClick={disconnectTelegram} className="btn btn-danger">Disconnect</button>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)]">
                Tap the button to open the bot in Telegram. Press <b>START</b> there. Once connected, it will show up here automatically.
              </p>
              <button onClick={connectTelegram} disabled={linking || waiting} className="btn btn-primary">
                {(linking || waiting) && <Loader2 size={16} className="animate-spin" />}
                {waiting ? 'Waiting for connection...' : 'Connect Telegram'}
              </button>
            </>
          )}
        </div>

        <EscalationSettings />
        <SystemStatus />
      </div>
    </div>
  )
}