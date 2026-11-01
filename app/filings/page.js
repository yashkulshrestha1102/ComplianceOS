'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Pencil, Trash2, Search } from 'lucide-react'

const today = () => new Date().toLocaleDateString('en-CA')
const CHANNELS = ['email', 'push', 'whatsapp', 'telegram']
const LABELS = { email: 'email', push: 'popup', whatsapp: 'whatsapp (button se)', telegram: 'telegram' }
const color = { pending: 'bg-yellow-100', in_progress: 'bg-blue-100', filed: 'bg-green-100', overdue: 'bg-red-100' }
const parseDays = (s) => s.split(',').map((x) => parseInt(x.trim())).filter((n) => !isNaN(n))

export default function Filings() {
  const [role, setRole] = useState('')
  const [clients, setClients] = useState([])
  const [types, setTypes] = useState([])
  const [people, setPeople] = useState([])
  const [filings, setFilings] = useState([])
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState({
    client_id: '', filing_type_id: '', period: '', due_date: '',
    reminderDays: '5,2,0', channels: ['email', 'push'], assignees: [],
  })

  async function load() {
    const { data: s } = await supabase.auth.getSession()
    if (s.session) {
      const { data: me } = await supabase.from('profiles').select('role').eq('id', s.session.user.id).single()
      setRole(me?.role || '')
    }
    const [c, t, p, f] = await Promise.all([
      supabase.from('clients').select('id,name').order('name'),
      supabase.from('filing_types').select('*').order('name'),
      supabase.from('profiles').select('id,full_name').neq('role', 'client'),
      supabase.from('filings')
        .select('*, clients(name, phone), filing_types(name), filing_assignees(user_id, profiles(full_name))')
        .order('due_date'),
    ])
    setClients(c.data || [])
    setTypes(t.data || [])
    setPeople(p.data || [])
    setFilings(f.data || [])
  }
  useEffect(() => { load() }, [])

    useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('q')
    if (fromUrl) setSearch(fromUrl)
    const onSearch = (e) => setSearch(e.detail || '')
    window.addEventListener('global-search', onSearch)
    return () => window.removeEventListener('global-search', onSearch)
  }, [])

  function pickType(id) {
    const t = types.find((x) => x.id === id)
    setForm({ ...form, filing_type_id: id, reminderDays: t ? t.default_reminder_days.join(',') : form.reminderDays })
  }

  function toggle(obj, setObj, key, value) {
    const list = obj[key]
    setObj({ ...obj, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }

  async function add(e) {
    e.preventDefault()
    setMsg('')
    const days = parseDays(form.reminderDays)
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

  function openEdit(f) {
    setEditing(f)
    setEdit({
      period: f.period || '',
      due_date: f.due_date,
      reminderDays: f.reminder_days.join(','),
      channels: f.channels,
      assignees: f.filing_assignees.map((a) => a.user_id),
      remarks: f.remarks || '',
      arn_number: f.arn_number || '',
    })
  }

  async function saveEdit(e) {
    e.preventDefault()
    const days = parseDays(edit.reminderDays)
    if (days.length === 0) return alert('Reminder days sahi daalo, jaise 5,2,0')

    const { data: s } = await supabase.auth.getSession()
    const { error } = await supabase.from('filings').update({
      period: edit.period,
      due_date: edit.due_date,
      reminder_days: days,
      channels: edit.channels,
      remarks: edit.remarks,
      arn_number: edit.arn_number,
    }).eq('id', editing.id)
    if (error) return alert(error.message)

    await supabase.from('filing_assignees').delete().eq('filing_id', editing.id)
    if (edit.assignees.length > 0) {
      await supabase.from('filing_assignees').insert(
        edit.assignees.map((uid) => ({ filing_id: editing.id, user_id: uid }))
      )
    }
    await supabase.from('filing_activity').insert({
      filing_id: editing.id, user_id: s.session.user.id, action: 'edited', note: 'Filing edit hui',
    })
    setEditing(null)
    load()
  }

  async function remove(f) {
    if (!confirm(`${f.filing_types?.name} (${f.clients?.name}) delete karein? Ye wapas nahi aayegi.`)) return
    const { error } = await supabase.from('filings').delete().eq('id', f.id)
    if (error) alert(error.message)
    load()
  }

  function shownStatus(f) {
    return f.status !== 'filed' && f.due_date < today() ? 'overdue' : f.status
  }

  const visible = filings.filter((f) => {
    const st = shownStatus(f)
    if (statusFilter !== 'all' && st !== statusFilter) return false
    const text = `${f.clients?.name} ${f.filing_types?.name} ${f.period}`.toLowerCase()
    return text.includes(search.toLowerCase())
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Filings</h1>

      {role !== 'client' && (
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
            <p className="text-xs text-gray-500">Jaise 6,3,1 = due date se 6, 3 aur 1 din pehle. 0 = due date wale din.</p>
          </div>

          <div>
            <label className="text-sm font-semibold">Reminder kahan bhejna hai?</label>
            <div className="flex gap-4 mt-1">
              {CHANNELS.map((ch) => (
                <label key={ch} className="flex items-center gap-1">
                  <input type="checkbox" checked={form.channels.includes(ch)}
                    onChange={() => toggle(form, setForm, 'channels', ch)} /> {LABELS[ch]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold">Kis-kis user ko assign karna hai?</label>
            <div className="flex flex-wrap gap-4 mt-1">
              {people.map((p) => (
                <label key={p.id} className="flex items-center gap-1">
                  <input type="checkbox" checked={form.assignees.includes(p.id)}
                    onChange={() => toggle(form, setForm, 'assignees', p.id)} />
                  {p.full_name || p.id.slice(0, 6)}
                </label>
              ))}
            </div>
          </div>

          <button className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700">Filing add karo</button>
          {msg && <p className="text-red-600 text-sm">{msg}</p>}
        </form>
      )}

      {/* Search aur filter */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 card flex items-center gap-2 px-3 py-2">
          <Search size={16} className="text-[var(--muted)]" />
          <input className="w-full text-sm outline-none" style={{ background: 'transparent' }}
            placeholder="Client, filing ya period se dhundo..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="border p-2 rounded text-sm" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Sab status</option>
          <option value="pending">pending</option>
          <option value="in_progress">in progress</option>
          <option value="filed">filed</option>
          <option value="overdue">overdue</option>
        </select>
      </div>

      <div className="space-y-2">
        {visible.map((f) => {
          const st = shownStatus(f)
          return (
            <div key={f.id} className={`border rounded p-3 flex items-center justify-between gap-3 ${color[st]}`}>
              <div className="min-w-0">
                <b>{f.filing_types?.name}</b> | {f.clients?.name} | {f.period || '-'}
                <div className="text-sm text-gray-600">
                  Due: {f.due_date} | Reminder: {f.reminder_days.join(', ')} din pehle | {f.channels.join(', ')}
                </div>
                <div className="text-sm text-gray-600">
                  Assigned: {f.filing_assignees.map((a) => a.profiles?.full_name).filter(Boolean).join(', ') || 'koi nahi'}
                  {f.arn_number ? ` | ARN: ${f.arn_number}` : ''}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-2 mb-1">
                  {f.clients?.phone && (
                    <a target="_blank" rel="noreferrer"
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded"
                      href={`https://wa.me/${f.clients.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `Namaste ${f.clients.name}, ${f.filing_types?.name} (${f.period || ''}) ki due date ${f.due_date} hai. Kripya documents jald bhej dein. - Businezexcellence`
                      )}`}>
                      WhatsApp
                    </a>
                  )}
                  {role !== 'client' && (
                    <button onClick={() => openEdit(f)} title="Edit"><Pencil size={16} /></button>
                  )}
                  {role === 'admin' && (
                    <button onClick={() => remove(f)} title="Delete"><Trash2 size={16} className="text-red-500" /></button>
                  )}
                </div>
                <div className="text-xs font-bold uppercase mb-1">{st}</div>
                {role !== 'client' && (
                  <select className="border rounded p-1 text-sm" value={f.status}
                    onChange={(e) => changeStatus(f, e.target.value)}>
                    <option value="pending">pending</option>
                    <option value="in_progress">in progress</option>
                    <option value="filed">filed</option>
                  </select>
                )}
              </div>
            </div>
          )
        })}
        {visible.length === 0 && <p className="text-gray-500">Koi filing nahi mili.</p>}
      </div>

      {/* Edit popup */}
      {editing && edit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={saveEdit} className="card p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--panel)' }}>
            <h2 className="text-lg font-bold">
              Edit: {editing.filing_types?.name} ({editing.clients?.name})
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <input className="border p-2 rounded" placeholder="Period" value={edit.period}
                onChange={(e) => setEdit({ ...edit, period: e.target.value })} />
              <input className="border p-2 rounded" type="date" required value={edit.due_date}
                onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} />
            </div>

            <div>
              <label className="text-sm font-semibold">Reminder days</label>
              <input className="border p-2 rounded w-full" value={edit.reminderDays}
                onChange={(e) => setEdit({ ...edit, reminderDays: e.target.value })} />
            </div>

            <div>
              <label className="text-sm font-semibold">Channels</label>
              <div className="flex flex-wrap gap-4 mt-1">
                {CHANNELS.map((ch) => (
                  <label key={ch} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={edit.channels.includes(ch)}
                      onChange={() => toggle(edit, setEdit, 'channels', ch)} /> {LABELS[ch]}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold">Assigned users</label>
              <div className="flex flex-wrap gap-4 mt-1">
                {people.map((p) => (
                  <label key={p.id} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={edit.assignees.includes(p.id)}
                      onChange={() => toggle(edit, setEdit, 'assignees', p.id)} />
                    {p.full_name || p.id.slice(0, 6)}
                  </label>
                ))}
              </div>
            </div>

            <input className="border p-2 rounded w-full" placeholder="ARN number (filing ke baad)" value={edit.arn_number}
              onChange={(e) => setEdit({ ...edit, arn_number: e.target.value })} />
            <textarea className="border p-2 rounded w-full" rows={2} placeholder="Remarks" value={edit.remarks}
              onChange={(e) => setEdit({ ...edit, remarks: e.target.value })}
              style={{ background: 'var(--panel)', color: 'var(--text)' }} />

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border border-[var(--border)] rounded">Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}