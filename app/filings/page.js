'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const today = () => new Date().toLocaleDateString('en-CA')
const CHANNELS = ['email', 'push', 'whatsapp', 'telegram']
const LABELS = {
  email: 'email',
  push: 'popup',
  whatsapp: 'whatsapp (button se)',
  telegram: 'telegram',
}

export default function Filings() {
  const [clients, setClients] = useState([])
  const [types, setTypes] = useState([])
  const [people, setPeople] = useState([])
  const [filings, setFilings] = useState([])
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    client_id: '', filing_type_id: '', period: '', due_date: '',
    reminderDays: '5,2,0', channels: ['email', 'push'], assignees: [],
  })

  async function load() {
    const [c, t, p, f] = await Promise.all([
      supabase.from('clients').select('id,name').order('name'),
      supabase.from('filing_types').select('*').order('name'),
      supabase.from('profiles').select('id,full_name'),
      supabase.from('filings')
.select('*, clients(name, phone), filing_types(name), filing_assignees(profiles(full_name))')
        .order('due_date'),
    ])
    setClients(c.data || [])
    setTypes(t.data || [])
    setPeople(p.data || [])
    setFilings(f.data || [])
  }
  useEffect(() => { load() }, [])

  function pickType(id) {
    const t = types.find((x) => x.id === id)
    setForm({ ...form, filing_type_id: id, reminderDays: t ? t.default_reminder_days.join(',') : form.reminderDays })
  }

  function toggle(key, value) {
    const list = form[key]
    setForm({ ...form, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }

  async function add(e) {
    e.preventDefault()
    setMsg('')
    const days = form.reminderDays.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n))
    if (days.length === 0) return setMsg('Reminder days sahi daalo, jaise 5,2,0')

    const { data: s } = await supabase.auth.getSession()
    const { data: filing, error } = await supabase.from('filings').insert({
      client_id: form.client_id,
      filing_type_id: form.filing_type_id,
      period: form.period,
      due_date: form.due_date,
      reminder_days: days,
      channels: form.channels,
    }).select().single()
    if (error) return setMsg(error.message)

    if (form.assignees.length > 0) {
      await supabase.from('filing_assignees').insert(
        form.assignees.map((uid) => ({ filing_id: filing.id, user_id: uid }))
      )
    }
    await supabase.from('filing_activity').insert({
      filing_id: filing.id, user_id: s.session.user.id, action: 'created', note: 'Filing add hui',
    })
    setForm({ ...form, period: '', due_date: '', assignees: [] })
    load()
  }

  async function changeStatus(f, status) {
    const { data: s } = await supabase.auth.getSession()
    await supabase.from('filings').update({
      status, filed_on: status === 'filed' ? today() : null,
    }).eq('id', f.id)
    await supabase.from('filing_activity').insert({
      filing_id: f.id, user_id: s.session.user.id, action: 'status_changed',
      note: `${f.status} se ${status}`,
    })
    load()
  }

  function shownStatus(f) {
    return f.status !== 'filed' && f.due_date < today() ? 'overdue' : f.status
  }
  const color = { pending: 'bg-yellow-100', in_progress: 'bg-blue-100', filed: 'bg-green-100', overdue: 'bg-red-100' }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Filings</h1>

      <form onSubmit={add} className="bg-white p-4 rounded-xl shadow space-y-3 mb-8">
        <div className="grid grid-cols-2 gap-3">
          <select className="border p-2 rounded" required value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
            <option value="">Client chuno *</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select className="border p-2 rounded" required value={form.filing_type_id}
            onChange={(e) => pickType(e.target.value)}>
            <option value="">Filing type chuno *</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <input className="border p-2 rounded" placeholder="Period (jaise Oct 2026)" value={form.period}
            onChange={(e) => setForm({ ...form, period: e.target.value })} />

          <input className="border p-2 rounded" type="date" required value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </div>

        <div>
          <label className="text-sm font-semibold">Kitne din pehle reminder? (comma se alag karo)</label>
          <input className="border p-2 rounded w-full" value={form.reminderDays}
            onChange={(e) => setForm({ ...form, reminderDays: e.target.value })} />
          <p className="text-xs text-gray-500">Jaise 6,3,1 = due date se 6 din, 3 din aur 1 din pehle. 0 = due date wale din.</p>
        </div>

        <div>
          <label className="text-sm font-semibold">Reminder kahan bhejna hai?</label>
          <div className="flex gap-4 mt-1">
            {CHANNELS.map((ch) => (
              <label key={ch} className="flex items-center gap-1">
                  <input type="checkbox" checked={form.channels.includes(ch)} onChange={() => toggle('channels', ch)} /> {LABELS[ch]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold">Kis-kis user ko assign karna hai?</label>
          <div className="flex flex-wrap gap-4 mt-1">
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-1">
                <input type="checkbox" checked={form.assignees.includes(p.id)} onChange={() => toggle('assignees', p.id)} />
                {p.full_name || p.id.slice(0, 6)}
              </label>
            ))}
          </div>
        </div>

        <button className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700">Filing add karo</button>
        {msg && <p className="text-red-600 text-sm">{msg}</p>}
      </form>

      <div className="space-y-2">
        {filings.map((f) => {
          const st = shownStatus(f)
          return (
            <div key={f.id} className={`border rounded p-3 flex items-center justify-between ${color[st]}`}>
              <div>
                <b>{f.filing_types?.name}</b> | {f.clients?.name} | {f.period || '-'}
                <div className="text-sm text-gray-600">
                  Due: {f.due_date} | Reminder: {f.reminder_days.join(', ')} din pehle | {f.channels.join(', ')}
                </div>
                <div className="text-sm text-gray-600">
                  Assigned: {f.filing_assignees.map((a) => a.profiles?.full_name).filter(Boolean).join(', ') || 'koi nahi'}
                </div>
              </div>
              <div className="text-right">
                {f.clients?.phone && (
  <a
    target="_blank" rel="noreferrer"
    className="inline-block mb-2 text-xs bg-green-600 text-white px-2 py-1 rounded"
    href={`https://wa.me/${f.clients.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
      `Namaste ${f.clients.name}, ${f.filing_types?.name} (${f.period || ''}) ki due date ${f.due_date} hai. Kripya documents jald bhej dein. - Businezexcellence`
    )}`}>
    WhatsApp
  </a>
)}
                <div className="text-xs font-bold uppercase mb-1">{st}</div>
                <select className="border rounded p-1 text-sm" value={f.status} onChange={(e) => changeStatus(f, e.target.value)}>
                  <option value="pending">pending</option>
                  <option value="in_progress">in progress</option>
                  <option value="filed">filed</option>
                </select>
              </div>
            </div>
          )
        })}
        {filings.length === 0 && <p className="text-gray-500">Abhi koi filing nahi hai.</p>}
      </div>
    </div>
  )
}