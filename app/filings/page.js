'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FileText, Plus, Pencil, Trash2, Search, MessageCircle, Loader2 ,Paperclip } from 'lucide-react'
import { PageHeader, EmptyState, Skeleton, StatusBadge, Modal } from '@/components/ui'
import DocumentsModal from '@/components/DocumentsModal'
import { fetchAll } from '@/lib/fetchAll'
import Link from 'next/link'


const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const todayStr = () => new Date().toLocaleDateString('en-CA')
const fmt = (d) => { const [y, m, dd] = d.split('-'); return `${+dd} ${MONTHS[+m - 1]} ${y}` }
const daysLeft = (d) => Math.round((new Date(d) - new Date(todayStr())) / 86400000)
const shownStatus = (f) => (f.status !== 'filed' && f.due_date < todayStr() ? 'overdue' : f.status)
const parseDays = (s) => s.split(',').map((x) => parseInt(x.trim())).filter((n) => !isNaN(n))

const CHANNELS = ['email', 'push', 'whatsapp', 'telegram']
const LABELS = { email: 'Email', push: 'Popup', whatsapp: 'WhatsApp (button se)', telegram: 'Telegram' }
const FILTERS = [
  ['all', 'Sab'], ['pending', 'Pending'], ['in_progress', 'In progress'], ['filed', 'Filed'], ['overdue', 'Overdue'],
]

function DueCell({ f }) {
  if (f.status === 'filed') {
    return (
      <div>
        <div>{fmt(f.due_date)}</div>
        <div className="text-xs text-green-400">Filed{f.filed_on ? ` on ${fmt(f.filed_on)}` : ''}</div>
      </div>
    )
  }
  const d = daysLeft(f.due_date)
  const cls = d < 0 ? 'text-red-400' : d <= 5 ? 'text-amber-400' : 'text-[var(--muted)]'
  const text = d < 0 ? `${-d} days overdue` : d === 0 ? 'Due today' : `${d} days left`
  return (
    <div>
      <div>{fmt(f.due_date)}</div>
      <div className={`text-xs font-medium ${cls}`}>{text}</div>
    </div>
  )
}

function Avatars({ list }) {
  const names = list.map((a) => a.profiles?.full_name).filter(Boolean)
  if (names.length === 0) return <span className="text-xs text-[var(--muted)]">Unassigned</span>
  return (
    <div className="flex -space-x-2" title={names.join(', ')}>
      {names.slice(0, 3).map((n, i) => (
        <div key={i} className="w-7 h-7 rounded-full bg-[var(--accent)] text-white text-xs font-bold flex items-center justify-center border-2 border-[var(--card)]">
          {n.charAt(0).toUpperCase()}
        </div>
      ))}
      {names.length > 3 && (
        <div className="w-7 h-7 rounded-full bg-[var(--border)] text-xs flex items-center justify-center border-2 border-[var(--card)]">
          +{names.length - 3}
        </div>
      )}
    </div>
  )
}

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

export default function Filings() {
  const [role, setRole] = useState('')
  const [clients, setClients] = useState([])
  const [types, setTypes] = useState([])
  const [people, setPeople] = useState([])
  const [filings, setFilings] = useState(null)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [limit, setLimit] = useState(50)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [docFiling, setDocFiling] = useState(null)
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    client_id: '', filing_type_id: '', period: '', due_date: '',
    reminderDays: '5,2,0', channels: ['email', 'push'], assignees: [],
  })

  const canEdit = role === 'admin' || role === 'staff'

  async function load() {
    const { data: s } = await supabase.auth.getSession()
    if (s.session) {
      const { data: me } = await supabase.from('profiles').select('role').eq('id', s.session.user.id).single()
      setRole(me?.role || '')
    }
    const [c, t, p, f] = await Promise.all([
  supabase.from('clients').select('id,name').order('name'),
  supabase.from('filing_types').select('*').eq('active', true).order('name'),
  supabase.from('profiles').select('id,full_name').neq('role', 'client'),
  fetchAll(() => supabase.from('filings')
    .select('*, clients(name, phone), filing_types(name), filing_assignees(user_id, profiles(full_name)), filing_documents(count)')
    .order('due_date').order('id')),
])
setClients(c.data || [])
setTypes(t.data || [])
setPeople(p.data || [])
setFilings(f || [])
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('q')
    if (fromUrl) setSearch(fromUrl)
    const onSearch = (e) => setSearch(e.detail || '')
    window.addEventListener('global-search', onSearch)
    return () => window.removeEventListener('global-search', onSearch)
  }, [])

  function flash(text) {
    setNotice(text)
    setTimeout(() => setNotice(''), 4000)
  }

  const toggleIn = (obj, setObj, key) => (value) => {
    const list = obj[key]
    setObj({ ...obj, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }

  function pickType(id) {
    const t = types.find((x) => x.id === id)
    setForm({ ...form, filing_type_id: id, reminderDays: t ? t.default_reminder_days.join(',') : form.reminderDays })
  }

  async function add(e) {
    e.preventDefault()
    setErr('')
    const days = parseDays(form.reminderDays)
    if (days.length === 0) return setErr('Enter valid reminder days, e.g., 5,2,0')

    setSaving(true)
    const { data: s } = await supabase.auth.getSession()
    const { data: filing, error } = await supabase.from('filings').insert({
      client_id: form.client_id,
      filing_type_id: form.filing_type_id,
      period: form.period,
      due_date: form.due_date,
      reminder_days: days,
      channels: form.channels,
    }).select().single()
    if (error) { setSaving(false); return setErr(error.message) }

    if (form.assignees.length > 0) {
      await supabase.from('filing_assignees').insert(
        form.assignees.map((uid) => ({ filing_id: filing.id, user_id: uid }))
      )
    }
    await supabase.from('filing_activity').insert({
      filing_id: filing.id, user_id: s.session.user.id, action: 'created', note: 'Filing add hui',
    })
    setSaving(false)
    setShowAdd(false)
    setForm({ ...form, period: '', due_date: '', assignees: [] })
    flash('Filing added ✅')
    load()
  }

  async function changeStatus(f, status) {
    const { data: s } = await supabase.auth.getSession()
    await supabase.from('filings').update({
      status, filed_on: status === 'filed' ? todayStr() : null,
    }).eq('id', f.id)
    await supabase.from('filing_activity').insert({
      filing_id: f.id, user_id: s.session.user.id, action: 'status_changed', note: `from ${f.status} to ${status}`,
    })
    load()
        if (status === 'filed') setDocFiling(f)
  }

  function openEdit(f) {
    setErr('')
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
    setErr('')
    const days = parseDays(edit.reminderDays)
    if (days.length === 0) return setErr('Enter valid reminder days, e.g., 5,2,0')

    setSaving(true)
    const { data: s } = await supabase.auth.getSession()
    const { error } = await supabase.from('filings').update({
      period: edit.period, due_date: edit.due_date, reminder_days: days,
      channels: edit.channels, remarks: edit.remarks, arn_number: edit.arn_number,
    }).eq('id', editing.id)
    if (error) { setSaving(false); return setErr(error.message) }

    await supabase.from('filing_assignees').delete().eq('filing_id', editing.id)
    if (edit.assignees.length > 0) {
      await supabase.from('filing_assignees').insert(
        edit.assignees.map((uid) => ({ filing_id: editing.id, user_id: uid }))
      )
    }
    await supabase.from('filing_activity').insert({
      filing_id: editing.id, user_id: s.session.user.id, action: 'edited', note: 'Filing edited',
    })
    setSaving(false)
    setEditing(null)
    flash('Changes saved ✅')
    load()
  }

  async function remove(f) {
    if (!confirm(`Delete ${f.filing_types?.name} (${f.clients?.name})? This cannot be undone.`)) return
        const { data: docs } = await supabase.from('filing_documents').select('file_path').eq('filing_id', f.id)
    if (docs?.length) await supabase.storage.from('filing-proofs').remove(docs.map((d) => d.file_path))
    const { error } = await supabase.from('filings').delete().eq('id', f.id)
    if (error) return alert(error.message)
    flash('Filing deleted')
    load()
  }

  const all = filings || []
  const counts = { all: all.length }
  all.forEach((f) => { const s = shownStatus(f); counts[s] = (counts[s] || 0) + 1 })

  const filtered = all.filter((f) => {
    if (statusFilter !== 'all' && shownStatus(f) !== statusFilter) return false
    const text = `${f.clients?.name} ${f.filing_types?.name} ${f.period}`.toLowerCase()
    return text.includes(search.toLowerCase())
  })
  const shown = filtered.slice(0, limit)

  const peopleOptions = people.map((p) => [p.id, p.full_name || p.id.slice(0, 6)])
  const channelOptions = CHANNELS.map((c) => [c, LABELS[c]])

  return (
    <div className="page">
      <PageHeader icon={FileText} title="Filings" subtitle="All due dates, statuses, and assigned users in one place">
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { setErr(''); setShowAdd(true) }}>
            <Plus size={16} /> Add filing
          </button>
        )}
      </PageHeader>

      {notice && <div className="badge badge-green mb-4 px-4 py-2 text-sm">{notice}</div>}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="card flex items-center gap-3 px-4 py-2.5 flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="text-[var(--muted)]" />
          <input className="bare w-full text-sm" placeholder="Search by client, filing, or period..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([id, label]) => (
            <button key={id} onClick={() => { setStatusFilter(id); setLimit(50) }}
              className={`btn ${statusFilter === id ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '0.4rem 0.8rem' }}>
              {label} <span className="opacity-70">{counts[id] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {filings === null ? (
          <div className="p-4 space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState
            title={all.length === 0 ? 'No filings yet' : 'No filings found'}
            text={all.length === 0 ? '.Add your first filing, or use Bulk Import to add many at once.' : 'Try changing the search or filters.'}
            action={canEdit && all.length === 0 && (
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add filing</button>
            )} />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Filing</th><th>Client</th><th>Due date</th><th>Assigned</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/filings/${f.id}`} className="font-semibold hover:text-[var(--accent)]">{f.filing_types?.name}</Link>
                    <div className="text-xs text-[var(--muted)]">{f.period || '-'}{f.arn_number ? ` · ARN ${f.arn_number}` : ''}</div>
                  </td>
                  <td>{f.clients?.name}</td>
                  <td><DueCell f={f} /></td>
                  <td><Avatars list={f.filing_assignees} /></td>
                  <td>
                    <div className="flex flex-col items-start gap-1.5">
                      <StatusBadge status={shownStatus(f)} />
                      {canEdit && (
                        <select value={f.status} onChange={(e) => changeStatus(f, e.target.value)}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                          <option value="pending">pending</option>
                          <option value="in_progress">in progress</option>
                          <option value="filed">filed</option>
                        </select>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                                              <button className="icon-btn relative" title="Documents / ARN proof" onClick={() => setDocFiling(f)}>
                        <Paperclip size={16} />
                        {(f.filing_documents?.[0]?.count || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 bg-[var(--accent)] text-white rounded-full text-[10px] px-1">
                            {f.filing_documents[0].count}
                          </span>
                        )}
                      </button>
                      {f.clients?.phone && (
                        <a className="icon-btn" title="Send WhatsApp to client" target="_blank" rel="noreferrer"
                          href={`https://wa.me/${f.clients.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Hello ${f.clients.name}, the due date for ${f.filing_types?.name} (${f.period || ''}) is ${fmt(f.due_date)}. Please send the documents soon. - Businezexcellence`
                          )}`}>
                          <MessageCircle size={16} className="text-green-500" />
                        </a>
                      )}
                      {canEdit && (
                        <button className="icon-btn" title="Edit" onClick={() => openEdit(f)}><Pencil size={16} /></button>
                      )}
                      {role === 'admin' && (
                        <button className="icon-btn" title="Delete" onClick={() => remove(f)}>
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > limit && (
        <div className="text-center mt-4">
          <button className="btn btn-outline" onClick={() => setLimit(limit + 50)}>
            Show more (${filtered.length - limit} remaining)
          </button>
        </div>
      )}

      {/* Add popup */}
      {showAdd && (
        <Modal title="New filing" wide onClose={() => setShowAdd(false)}>
          <form onSubmit={add} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Client *</label>
                <select className="w-full" required value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                  <option value="">Select client</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Filing type *</label>
                <select className="w-full" required value={form.filing_type_id} onChange={(e) => pickType(e.target.value)}>
                  <option value="">Select filing type</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Period</label>
                <input className="w-full" placeholder="Oct 2026" value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })} />
              </div>
              <div>
                <label className="label">Due date *</label>
                <input className="w-full" type="date" required value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="label">How many days before should reminders be sent? (comma-separated)</label>
              <input className="w-full" value={form.reminderDays}
                onChange={(e) => setForm({ ...form, reminderDays: e.target.value })} />
              <p className="text-xs text-[var(--muted)] mt-1">e.g., 6,3,1 = 6, 3, and 1 day before the due date. 0 = on the due date.</p>
            </div>

            <div>
              <label className="label">Where should reminders be sent?</label>
              <CheckGroup options={channelOptions} value={form.channels} onToggle={toggleIn(form, setForm, 'channels')} />
            </div>

            <div>
              <label className="label">Who should this filing be assigned to?</label>
              <CheckGroup options={peopleOptions} value={form.assignees} onToggle={toggleIn(form, setForm, 'assignees')} />
              {form.assignees.length === 0 && (
                <p className="text-xs text-amber-400 mt-1">If you don\'t assign anyone, no reminders will be sent.</p>
              )}
            </div>

            {err && <p className="text-sm text-red-400">{err}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />} Add filing
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit popup */}
      {editing && edit && (
        <Modal title={`Edit: ${editing.filing_types?.name} (${editing.clients?.name})`} wide onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Period</label>
                <input className="w-full" value={edit.period} onChange={(e) => setEdit({ ...edit, period: e.target.value })} />
              </div>
              <div>
                <label className="label">Due date *</label>
                <input className="w-full" type="date" required value={edit.due_date}
                  onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="label">Reminder days</label>
              <input className="w-full" value={edit.reminderDays} onChange={(e) => setEdit({ ...edit, reminderDays: e.target.value })} />
            </div>

            <div>
              <label className="label">Channels</label>
              <CheckGroup options={channelOptions} value={edit.channels} onToggle={toggleIn(edit, setEdit, 'channels')} />
            </div>

            <div>
              <label className="label">Assigned users</label>
              <CheckGroup options={peopleOptions} value={edit.assignees} onToggle={toggleIn(edit, setEdit, 'assignees')} />
            </div>

            <div>
              <label className="label">ARN number (after filing)</label>
              <input className="w-full" value={edit.arn_number} onChange={(e) => setEdit({ ...edit, arn_number: e.target.value })} />
            </div>
            <div>
              <label className="label">Remarks</label>
              <textarea className="w-full" rows={2} value={edit.remarks} onChange={(e) => setEdit({ ...edit, remarks: e.target.value })} />
            </div>

            {err && <p className="text-sm text-red-400">{err}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />} Save
              </button>
            </div>
          </form>
        </Modal>
      )}

            {docFiling && (
        <DocumentsModal filing={docFiling} canEdit={canEdit} onClose={() => setDocFiling(null)} onChanged={load} />
      )}
    </div>
  )
}