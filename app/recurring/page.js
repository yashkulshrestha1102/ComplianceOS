'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Repeat, Trash2 } from 'lucide-react'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const PRESETS = {
  'Har mahine': '1,2,3,4,5,6,7,8,9,10,11,12',
  'Quarterly (Jan, Apr, Jul, Oct)': '1,4,7,10',
  'Advance Tax (Mar, Jun, Sep, Dec)': '3,6,9,12',
  'Saalana (sirf ek mahina)': '9',
}
const CHANNELS = ['email', 'push', 'whatsapp', 'telegram']
const LABELS = { email: 'email', push: 'popup', whatsapp: 'whatsapp (button se)', telegram: 'telegram' }

export default function Recurring() {
  const [clients, setClients] = useState([])
  const [types, setTypes] = useState([])
  const [people, setPeople] = useState([])
  const [templates, setTemplates] = useState([])
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    client_ids: [], filing_type_id: '', months: PRESETS['Har mahine'], due_day: '20',
    period_label: '{prev_month}', reminderDays: '5,2,0', channels: ['email', 'push'], assignees: [],
  })

  async function load() {
    const [c, t, p, tp] = await Promise.all([
      supabase.from('clients').select('id,name').order('name'),
      supabase.from('filing_types').select('*').order('name'),
      supabase.from('profiles').select('id,full_name').neq('role', 'client'),
      supabase.from('recurring_templates').select('*, clients(name), filing_types(name)').order('created_at', { ascending: false }),
    ])
    setClients(c.data || [])
    setTypes(t.data || [])
    setPeople(p.data || [])
    setTemplates(tp.data || [])
  }
  useEffect(() => { load() }, [])

  function toggle(key, value) {
    const list = form[key]
    setForm({ ...form, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }

  function pickType(id) {
    const t = types.find((x) => x.id === id)
    setForm({ ...form, filing_type_id: id, reminderDays: t ? t.default_reminder_days.join(',') : form.reminderDays })
  }

  const nums = (s) => s.split(',').map((x) => parseInt(x.trim())).filter((n) => !isNaN(n))

  async function add(e) {
    e.preventDefault()
    setMsg('')
    const months = nums(form.months).filter((m) => m >= 1 && m <= 12)
    const days = nums(form.reminderDays)
    if (form.client_ids.length === 0) return setMsg('Kam se kam ek client chuno')
    if (months.length === 0) return setMsg('Months sahi daalo, jaise 1,4,7,10')
    if (days.length === 0) return setMsg('Reminder days sahi daalo, jaise 5,2,0')

    const rows = form.client_ids.map((cid) => ({
      client_id: cid,
      filing_type_id: form.filing_type_id,
      due_months: months,
      due_day: parseInt(form.due_day),
      period_label: form.period_label,
      reminder_days: days,
      channels: form.channels,
      assignee_ids: form.assignees,
    }))
    const { error } = await supabase.from('recurring_templates').insert(rows)
    if (error) return setMsg(error.message)
    setMsg(`${rows.length} template ban gaye ✅ Ab "Abhi filings generate karo" dabao.`)
    setForm({ ...form, client_ids: [] })
    load()
  }

  async function generateNow() {
    setMsg('Generate ho raha hai...')
    const { data: s } = await supabase.auth.getSession()
    const res = await fetch('/api/recurring/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.session.access_token}` },
    })
    const json = await res.json()
    setMsg(res.ok ? `${json.created} nayi filings ban gayi ✅ (Filings page dekho)` : json.error)
  }

  async function toggleActive(t) {
    await supabase.from('recurring_templates').update({ active: !t.active }).eq('id', t.id)
    load()
  }
  async function remove(t) {
    if (!confirm('Ye template delete karein? (Bani hui filings rahengi)')) return
    await supabase.from('recurring_templates').delete().eq('id', t.id)
    load()
  }

  const names = (ids) => ids.map((i) => people.find((p) => p.id === i)?.full_name).filter(Boolean).join(', ') || 'koi nahi'

  return (
    <div className="px-8 pb-10 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Repeat className="text-[var(--accent)]" /> Recurring Filings</h1>
        <button onClick={generateNow} className="bg-[var(--accent)] text-white px-4 py-2 rounded">Abhi filings generate karo</button>
      </div>

      <form onSubmit={add} className="card p-5 space-y-4 mb-8">
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Kin clients ke liye? (kitne bhi chuno)</label>
            <button type="button" className="text-xs text-[var(--accent)]"
              onClick={() => setForm({ ...form, client_ids: form.client_ids.length === clients.length ? [] : clients.map((c) => c.id) })}>
              Sab select / clear
            </button>
          </div>
          <div className="flex flex-wrap gap-4 mt-1">
            {clients.map((c) => (
              <label key={c.id} className="flex items-center gap-1">
                <input type="checkbox" checked={form.client_ids.includes(c.id)} onChange={() => toggle('client_ids', c.id)} /> {c.name}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <select className="border p-2 rounded" required value={form.filing_type_id} onChange={(e) => pickType(e.target.value)}>
            <option value="">Filing type chuno *</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input className="border p-2 rounded" type="number" min="1" max="31" required value={form.due_day}
            onChange={(e) => setForm({ ...form, due_day: e.target.value })} placeholder="Due date (mahine ka kaunsa din)" />
        </div>

        <div>
          <label className="text-sm font-semibold">Kitni baar? (kaun-kaun se mahine me due hai)</label>
          <select className="border p-2 rounded w-full mb-2" onChange={(e) => e.target.value && setForm({ ...form, months: PRESETS[e.target.value] })}>
            <option value="">Jaldi chuno...</option>
            {Object.keys(PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input className="border p-2 rounded w-full" value={form.months}
            onChange={(e) => setForm({ ...form, months: e.target.value })} />
          <p className="text-xs text-gray-500">Mahine ke number, comma se: 1=Jan ... 12=Dec. Abhi: {nums(form.months).map((m) => MONTH_NAMES[m - 1]).filter(Boolean).join(', ')}</p>
        </div>

        <div>
          <label className="text-sm font-semibold">Period ka naam</label>
          <input className="border p-2 rounded w-full" value={form.period_label}
            onChange={(e) => setForm({ ...form, period_label: e.target.value })} />
          <p className="text-xs text-gray-500">{'{prev_month}'} = pichla mahina (GST ke liye), {'{due_month}'} = due wala mahina, {'{year}'} = saal</p>
        </div>

        <div>
          <label className="text-sm font-semibold">Kitne din pehle reminder?</label>
          <input className="border p-2 rounded w-full" value={form.reminderDays}
            onChange={(e) => setForm({ ...form, reminderDays: e.target.value })} />
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
                <input type="checkbox" checked={form.assignees.includes(p.id)} onChange={() => toggle('assignees', p.id)} /> {p.full_name || p.id.slice(0, 6)}
              </label>
            ))}
          </div>
        </div>

        <button className="bg-[var(--accent)] text-white px-4 py-2 rounded">Template banao</button>
      </form>

      {msg && <p className="text-sm mb-4">{msg}</p>}

      <h2 className="font-semibold mb-3">Mere templates</h2>
      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="card p-3 flex items-center gap-3" style={t.active ? {} : { opacity: 0.5 }}>
            <div className="flex-1 min-w-0 text-sm">
              <b>{t.filing_types?.name}</b> | {t.clients?.name}
              <div className="text-[var(--muted)] text-xs">
                Har {t.due_day} tareekh | Mahine: {t.due_months.map((m) => MONTH_NAMES[m - 1]).join(', ')} | Reminder: {t.reminder_days.join(', ')} din pehle | {t.channels.join(', ')} | Assigned: {names(t.assignee_ids)}
              </div>
            </div>
            <button onClick={() => toggleActive(t)} className="text-xs border border-[var(--border)] rounded px-2 py-1">
              {t.active ? 'Pause' : 'Chalu karo'}
            </button>
            <button onClick={() => remove(t)}><Trash2 size={16} className="text-red-500" /></button>
          </div>
        ))}
        {templates.length === 0 && <p className="text-[var(--muted)] text-sm">Abhi koi template nahi hai.</p>}
      </div>
    </div>
  )
}