'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Repeat, Plus, Trash2, Loader2, Pause, Play, Zap } from 'lucide-react'
import { PageHeader, EmptyState, Skeleton, Modal } from '@/components/ui'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PRESETS = {
  'Monthly': '1,2,3,4,5,6,7,8,9,10,11,12',
  'Quarterly (Jan, Apr, Jul, Oct)': '1,4,7,10',
  'Advance Tax (Mar, Jun, Sep, Dec)': '3,6,9,12',
  'Annual (single month)': '9',
}
const CHANNELS = ['email', 'push', 'whatsapp', 'telegram']
const LABELS = { email: 'Email', push: 'Popup', whatsapp: 'WhatsApp (via button)', telegram: 'Telegram' }

const nums = (s) => s.split(',').map((x) => parseInt(x.trim())).filter((n) => !isNaN(n))
const monthsText = (arr) => (arr.length === 12 ? 'Every month' : arr.map((m) => MONTH_NAMES[m - 1]).join(', '))

function CheckGroup({ options, value, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([id, label]) => (
        <label key={id} className="flex items-center gap-2 card px-3 py-2 text-sm cursor-pointer">
          <input type="checkbox" checked={value.includes(id)} onChange={() => onToggle(id)} /> {label}
        </label>
      ))}
    </div>
  )
}

const emptyForm = {
  client_ids: [], filing_type_id: '', months: PRESETS['Har mahine'], due_day: '20',
  period_label: '{prev_month}', reminderDays: '5,2,0', channels: ['email', 'push'], assignees: [],
}

export default function Recurring() {
  const [clients, setClients] = useState([])
  const [types, setTypes] = useState([])
  const [people, setPeople] = useState([])
  const [templates, setTemplates] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    const [c, t, p, tp] = await Promise.all([
      supabase.from('clients').select('id,name').order('name'),
      supabase.from('filing_types').select('*').eq('active', true).order('name'),
      supabase.from('profiles').select('id,full_name').neq('role', 'client'),
      supabase.from('recurring_templates').select('*, clients(name), filing_types(name)').order('created_at', { ascending: false }),
    ])
    setClients(c.data || [])
    setTypes(t.data || [])
    setPeople(p.data || [])
    setTemplates(tp.data || [])
  }
  useEffect(() => { load() }, [])

  function flash(text) {
    setNotice(text)
    setTimeout(() => setNotice(''), 5000)
  }

  const toggleIn = (key) => (value) => {
    const list = form[key]
    setForm({ ...form, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }

  function pickType(id) {
    const t = types.find((x) => x.id === id)
    setForm({ ...form, filing_type_id: id, reminderDays: t ? t.default_reminder_days.join(',') : form.reminderDays })
  }

  async function add(e) {
    e.preventDefault()
    setErr('')
    const months = nums(form.months).filter((m) => m >= 1 && m <= 12)
    const days = nums(form.reminderDays)
    if (form.client_ids.length === 0) return setErr('Select at least one client')
    if (months.length === 0) return setErr('Enter valid months, e.g., 1,4,7,10')
    if (days.length === 0) return setErr('Enter valid reminder days, e.g., 5,2,0')

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
    setSaving(true)
    const { error } = await supabase.from('recurring_templates').insert(rows)
    setSaving(false)
    if (error) return setErr(error.message)
    setShowForm(false)
    setForm({ ...emptyForm, client_ids: [] })
    flash(`${rows.length} template(s) created ✅ Now click "Generate now".`)
    load()
  }

  async function generateNow() {
    setGenerating(true)
    const { data: s } = await supabase.auth.getSession()
    const res = await fetch('/api/recurring/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.session.access_token}` },
    })
    const json = await res.json()
    setGenerating(false)
    flash(res.ok ? `${json.created} new filings created ✅ (see the Filings page)` : json.error)
  }

  async function toggleActive(t) {
    await supabase.from('recurring_templates').update({ active: !t.active }).eq('id', t.id)
    load()
  }

  async function remove(t) {
    if (!confirm('Delete this template? (Existing filings will remain)')) return
    await supabase.from('recurring_templates').delete().eq('id', t.id)
    load()
  }

  const names = (ids) =>
    (ids || []).map((i) => people.find((p) => p.id === i)?.full_name).filter(Boolean).join(', ') || '-'

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  return (
    <div className="page">
      <PageHeader icon={Repeat} title="Recurring Filings"
        subtitle="Create a template once; filings are generated automatically every month">
        <button className="btn btn-outline" onClick={generateNow} disabled={generating}>
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} Generate now
        </button>
        <button className="btn btn-primary" onClick={() => { setErr(''); setShowForm(true) }}>
          <Plus size={16} /> New template
        </button>
      </PageHeader>

      {notice && <div className="badge badge-green mb-4 px-4 py-2 text-sm">{notice}</div>}

      <div className="card overflow-x-auto">
        {templates === null ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : templates.length === 0 ? (
          <EmptyState title="Abhi koi template nahi hai"
            text="e.g., GSTR-3B on the 20th of every month. Create once; the system will generate filings for upcoming due dates daily."
            action={<button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> New template</button>} />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Filing</th><th>Client</th><th>Schedule</th><th>Reminder</th><th>Assigned</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} style={t.active ? {} : { opacity: 0.55 }}>
                  <td>
                    <div className="font-semibold">{t.filing_types?.name}</div>
                    <div className="text-xs text-[var(--muted)]">Period: {t.period_label}</div>
                  </td>
                  <td>{t.clients?.name}</td>
                  <td>
                    <div>On the {t.due_day}th of each month</div>
                    <div className="text-xs text-[var(--muted)]">{monthsText(t.due_months)}</div>
                  </td>
                  <td className="text-sm">{t.reminder_days.join(', ')} days before<div className="text-xs text-[var(--muted)]">{t.channels.join(', ')}</div></td>
                  <td className="text-xs">{names(t.assignee_ids)}</td>
                  <td>{t.active ? <span className="badge badge-green">Active</span> : <span className="badge badge-gray">Paused</span>}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="icon-btn" title={t.active ? 'Pause' : 'Resume'} onClick={() => toggleActive(t)}>
                        {t.active ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button className="icon-btn" title="Delete" onClick={() => remove(t)}>
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <Modal wide title="New recurring template" onClose={() => setShowForm(false)}>
          <form onSubmit={add} className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="label">For which clients? (choose any number)</label>
                <button type="button" className="text-xs text-[var(--accent)]"
                  onClick={() => setForm({ ...form, client_ids: form.client_ids.length === clients.length ? [] : clients.map((c) => c.id) })}>
                  Select all / clear
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto">
                <CheckGroup options={clients.map((c) => [c.id, c.name])} value={form.client_ids} onToggle={toggleIn('client_ids')} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Filing type *</label>
                <select className="w-full" required value={form.filing_type_id} onChange={(e) => pickType(e.target.value)}>
                  <option value="">Select filing type</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Due date (which day of the month) *</label>
                <input className="w-full" type="number" min="1" max="31" required value={form.due_day} onChange={set('due_day')} />
              </div>
            </div>

            <div>
              <label className="label">In which months is it due?</label>
              <select className="w-full mb-2" value=""
                onChange={(e) => e.target.value && setForm({ ...form, months: PRESETS[e.target.value] })}>
                <option value="">Quick presets...</option>
                {Object.keys(PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <input className="w-full" value={form.months} onChange={set('months')} />
              <p className="text-xs text-[var(--muted)] mt-1">
                Month numbers comma-separated (1=Jan ... 12=Dec). Current:{nums(form.months).map((m) => MONTH_NAMES[m - 1]).filter(Boolean).join(', ') || '-'}
              </p>
            </div>

            <div>
              <label className="label">Period label</label>
              <input className="w-full" value={form.period_label} onChange={set('period_label')} />
              <p className="text-xs text-[var(--muted)] mt-1">
                {'{prev_month}'} = previous month (for GST), {'{due_month}'} = due month, {'{year}'} = year
              </p>
            </div>

            <div>
              <label className="label">How many days before should reminders be sent?</label>
              <input className="w-full" value={form.reminderDays} onChange={set('reminderDays')} />
            </div>

            <div>
              <label className="label">Where should reminders be sent?</label>
              <CheckGroup options={CHANNELS.map((c) => [c, LABELS[c]])} value={form.channels} onToggle={toggleIn('channels')} />
            </div>

            <div>
              <label className="label">Who should the filing be assigned to?</label>
              <CheckGroup options={people.map((p) => [p.id, p.full_name || p.id.slice(0, 6)])} value={form.assignees} onToggle={toggleIn('assignees')} />
            </div>

            {err && <p className="text-sm text-red-400">{err}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />} Create template
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}