'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/fetchAll'
import { Users, Plus, Pencil, Trash2, Search, Loader2, FileText, ClipboardCheck,ShieldCheck } from 'lucide-react'
import { PageHeader, EmptyState, Skeleton, Modal } from '@/components/ui'
import { toast, confirmDialog } from '@/components/Feedback'
import ClientAccessModal from '@/components/ClientAccessModal'

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/
const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/
const LLPIN_RE = /^[A-Z]{3}-[0-9]{4}$/

const STATUS = [['active', 'Active', 'badge-green'], ['inactive', 'Inactive', 'badge-gray'], ['prospect', 'Prospect', 'badge-blue']]
const REG_TYPES = [['GSTIN', 'GSTIN'], ['PF', 'PF'], ['ESIC', 'ESIC'], ['PT', 'Professional Tax'], ['MSME', 'MSME / Udyam'], ['OTHER', 'Other']]

const empty = {
  name: '', legal_name: '', trade_name: '', entity_type: '', status: 'active',
  pan: '', tan: '', cin_llpin: '', email: '', phone: '',
  state: '', registered_address: '', business_address: '', business_activity: '', onboarding_date: '',
}
const n = (s) => String(s ?? '').trim() || null

function RegistrationsModal({ client, canEdit, onClose, onChanged }) {
  const [list, setList] = useState(null)
  const [f, setF] = useState({ reg_type: 'GSTIN', reg_number: '', state: '', is_branch: false, branch_name: '' })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('client_registrations').select('*')
      .eq('client_id', client.id).order('created_at')
    setList(data || [])
  }
  useEffect(() => { load() }, [client.id])

  async function add(e) {
    e.preventDefault()
    setErr('')
    const num = f.reg_number.trim().toUpperCase()
    if (!num) return setErr('Registration number is required')
    if (f.reg_type === 'GSTIN') {
      if (!GSTIN_RE.test(num)) return setErr('Invalid GSTIN (must be 15 characters)')
      if (client.pan && num.slice(2, 12) !== client.pan) {
        return setErr(`PAN inside the GSTIN (${num.slice(2, 12)}) doesn\'t match the client\'s PAN (${client.pan})`)
      }
    }
    if (f.is_branch && !f.branch_name.trim()) return setErr('Enter the branch name')

    setSaving(true)
    const { error } = await supabase.from('client_registrations').insert({
      client_id: client.id,
      reg_type: f.reg_type,
      reg_number: num,
      state: n(f.state),
      is_branch: f.is_branch,
      branch_name: f.is_branch ? n(f.branch_name) : null,
    })
    setSaving(false)
    if (error) return setErr(error.code === '23505' ? 'This registration is already linked' : error.message)
    setF({ ...f, reg_number: '', state: '', is_branch: false, branch_name: '' })
    toast.success('Registration added ✅')
    load()
    onChanged?.()
  }

  async function setStatus(r, status) {
    const { error } = await supabase.from('client_registrations').update({ status }).eq('id', r.id)
    if (error) return toast.error(error.message)
    load()
    onChanged?.()
  }

  async function remove(r) {
    const ok = await confirmDialog({
      title: 'Remove registration?', message: `${r.reg_type}: ${r.reg_number}`, confirmText: 'Remove', danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('client_registrations').delete().eq('id', r.id)
    if (error) return toast.error(error.message)
    load()
    onChanged?.()
  }

  return (
    <Modal wide title={`Registrations: ${client.name}`} onClose={onClose}>
      <div className="space-y-5">
        {list === null ? <div className="skeleton h-12" /> : list.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No registrations yet.</p>
        ) : (
          <div className="space-y-2">
            {list.map((r) => (
              <div key={r.id} className="card p-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="badge badge-blue">{r.reg_type}</span>
                <span className="font-semibold">{r.reg_number}</span>
                {r.is_branch && <span className="badge badge-gray">Branch: {r.branch_name}</span>}
                {r.state && <span className="text-[var(--muted)]">{r.state}</span>}
                <span className="flex-1" />
                {canEdit ? (
                  <>
                    <select value={r.status} onChange={(e) => setStatus(r, e.target.value)}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                    <button className="icon-btn" title="Hatao" onClick={() => remove(r)}>
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </>
                ) : <span className="badge badge-gray">{r.status}</span>}
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <form onSubmit={add} className="card p-4 space-y-3">
            <div className="text-sm font-semibold">New registration</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Type</label>
                <select className="w-full" value={f.reg_type} onChange={(e) => setF({ ...f, reg_type: e.target.value })}>
                  {REG_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Number *</label>
                <input className="w-full" value={f.reg_number} onChange={(e) => setF({ ...f, reg_number: e.target.value })} />
              </div>
              <div>
                <label className="label">State</label>
                <input className="w-full" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.is_branch} onChange={(e) => setF({ ...f, is_branch: e.target.checked })} />
              This is a branch registration
            </label>
            {f.is_branch && (
              <div>
                <label className="label">Branch name *</label>
                <input className="w-full" value={f.branch_name} onChange={(e) => setF({ ...f, branch_name: e.target.value })} />
              </div>
            )}
            {err && <p className="text-sm text-red-400">{err}</p>}
            <button className="btn btn-primary" disabled={saving}>
              {saving && <Loader2 size={16} className="animate-spin" />} Add
            </button>
          </form>
        )}
      </div>
    </Modal>
  )
}

export default function Clients() {
  const [clients, setClients] = useState(null)
  const [entityOpts, setEntityOpts] = useState([])
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [regClient, setRegClient] = useState(null)
  const [accessClient, setAccessClient] = useState(null)
  const [cfgClient, setCfgClient] = useState(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const canEdit = role === 'admin' || role === 'staff'
  const entityLabel = useMemo(() => Object.fromEntries(entityOpts.map((o) => [o.value, o.label])), [entityOpts])

  async function load() {
    const { data: s } = await supabase.auth.getSession()
    if (s.session) {
      const { data: me } = await supabase.from('profiles').select('role').eq('id', s.session.user.id).single()
      setRole(me?.role || '')
    }
    try {
      const [list, e] = await Promise.all([
        fetchAll(() => supabase.from('clients')
          .select('*, client_registrations(id, reg_type, reg_number, status)')
          .order('name').order('id')),
        supabase.from('dropdown_options').select('value, label').eq('group_key', 'entity_type')
          .eq('status', 'approved').order('sort_order'),
      ])
      setClients(list)
      setEntityOpts(e.data || [])
    } catch (ex) {
      toast.error(ex.message || 'Clients load nahi hue')
      setClients([])
    }
  }
  useEffect(() => { load() }, [])

  function openEdit(c) {
    setErr('')
    const row = { ...empty }
    Object.keys(empty).forEach((k) => { row[k] = c[k] ?? '' })
    setModal({ ...row, id: c.id })
  }

  async function save(e) {
    e.preventDefault()
    setErr('')
    const pan = modal.pan.trim().toUpperCase()
    const tan = modal.tan.trim().toUpperCase()
    const cin = modal.cin_llpin.trim().toUpperCase()
    let phone = modal.phone.replace(/\D/g, '')
    if (phone.length === 10) phone = '91' + phone
    const email = modal.email.trim()
    const name = modal.name.trim()

    if (!name) return setErr('Name is required')
    if (pan && !PAN_RE.test(pan)) return setErr('Invalid PAN (e.g., ABCDE1234F)')
    if (tan && !TAN_RE.test(tan)) return setErr('Invalid TAN (e.g., ABCD12345E)')
    if (cin && !CIN_RE.test(cin) && !LLPIN_RE.test(cin)) return setErr('Invalid CIN (21 characters) or LLPIN (e.g., AAB-1234)')
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return setErr('Invalid email')
    if (phone && (phone.length < 10 || phone.length > 13)) return setErr('Invalid phone number')

    const row = {
      name,
      legal_name: n(modal.legal_name) || name,
      trade_name: n(modal.trade_name),
      entity_type: n(modal.entity_type),
      status: modal.status,
      pan: pan || null,
      tan: tan || null,
      cin_llpin: cin || null,
      email: email || null,
      phone: phone || null,
      state: n(modal.state),
      registered_address: n(modal.registered_address),
      business_address: n(modal.business_address),
      business_activity: n(modal.business_activity),
      onboarding_date: modal.onboarding_date || null,
    }

    setSaving(true)
    const { error } = modal.id
      ? await supabase.from('clients').update(row).eq('id', modal.id)
      : await supabase.from('clients').insert(row)
    setSaving(false)
    if (error) return setErr(error.message)
    setModal(null)
    toast.success(modal.id ? 'Client updated ✅' : 'Client added ✅ (now add Registrations)')
    load()
  }

  async function remove(c) {
    const ok = await confirmDialog({
      title: `Delete "${c.name}"?`,
      message: 'All its filings, templates, and registrations will also be removed. Marking it "Inactive" is safer than deleting.',
      confirmText: 'Delete', danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('clients').delete().eq('id', c.id)
    if (error) return toast.error(error.message)
    toast.success('Client deleted')
    load()
  }

  const shown = useMemo(() => {
    const needle = q.toLowerCase()
    return (clients || []).filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      const regs = (c.client_registrations || []).map((r) => r.reg_number).join(' ')
      return `${c.name} ${c.legal_name || ''} ${c.trade_name || ''} ${c.pan || ''} ${c.email || ''} ${regs}`
        .toLowerCase().includes(needle)
    })
  }, [clients, q, statusFilter])

  const regSummary = (c) => {
    const count = {}
    ;(c.client_registrations || []).forEach((r) => { count[r.reg_type] = (count[r.reg_type] || 0) + 1 })
    return Object.entries(count)
  }

  const field = (key, label, placeholder, extra = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className="w-full" placeholder={placeholder} value={modal[key]} {...extra}
        onChange={(e) => setModal({ ...modal, [key]: e.target.value })} />
    </div>
  )

  return (
    <div className="page">
      <PageHeader icon={Users} title="Clients" subtitle="Client master: fill once, use everywhere">
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { setErr(''); setModal({ ...empty }) }}>
            <Plus size={16} /> Add client
          </button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="card flex items-center gap-3 px-4 py-2.5 flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="text-[var(--muted)]" />
          <input className="bare w-full text-sm" placeholder="Search by name, PAN, GSTIN, or email..."
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {[['all', 'All'], ...STATUS.map(([v, l]) => [v, l])].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`btn ${statusFilter === v ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '0.4rem 0.8rem' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        {clients === null ? (
          <div className="p-4 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState title={q || statusFilter !== 'all' ? 'No clients found' : 'No clients yet'}
            text={q || statusFilter !== 'all' ? 'Try changing the search or filters.' : 'Add your first client to get started.'}
            action={canEdit && !q && statusFilter === 'all' && (
              <button className="btn btn-primary" onClick={() => { setErr(''); setModal({ ...empty }) }}><Plus size={16} /> Add client</button>
            )} />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Client</th><th>Entity</th><th>PAN</th><th>Registrations</th><th>Contact</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const st = STATUS.find((s) => s[0] === c.status) || STATUS[0]
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="font-semibold">{c.name}</div>
                      {c.trade_name && <div className="text-xs text-[var(--muted)]">{c.trade_name}</div>}
                    </td>
                    <td>{entityLabel[c.entity_type] || c.entity_type || '-'}</td>
                    <td>{c.pan || '-'}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {regSummary(c).length === 0
                          ? <span className="text-[var(--muted)]">-</span>
                          : regSummary(c).map(([t, k]) => <span key={t} className="badge badge-blue">{t} ×{k}</span>)}
                      </div>
                    </td>
                    <td className="text-sm">
                      <div>{c.email || '-'}</div>
                      <div className="text-xs text-[var(--muted)]">{c.phone || ''}</div>
                    </td>
                    <td><span className={`badge ${st[2]}`}>{st[1]}</span></td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="icon-btn" title="Compliance config" onClick={() => setCfgClient(c)}>
                       <ClipboardCheck size={16} />
                      </button>   {canEdit && (
     <button className="icon-btn" title="Manage access" onClick={() => setAccessClient(c)}>
       <ShieldCheck size={16} />
     </button>
   )}
                        {canEdit && <button className="icon-btn" title="Edit" onClick={() => openEdit(c)}><Pencil size={16} /></button>}
                        {role === 'admin' && (
                          <button className="icon-btn" title="Delete" onClick={() => remove(c)}>
                            <Trash2 size={16} className="text-red-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
       {cfgClient && (
  <ComplianceConfigModal client={cfgClient} canEdit={canEdit} onClose={() => setCfgClient(null)} />
)}
   {accessClient && <ClientAccessModal client={accessClient} onClose={() => setAccessClient(null)} />}
      {regClient && (
        <RegistrationsModal client={regClient} canEdit={canEdit} onClose={() => setRegClient(null)} onChanged={load} />
      )}

      {modal && (
        <Modal wide title={modal.id ? 'Edit client' : 'New client'} onClose={() => setModal(null)}>
          <form onSubmit={save} className="space-y-5">
            <div>
              <div className="text-sm font-semibold mb-2">Basic</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {field('name', 'Client / Company ka naam *', 'ABC Pvt Ltd')}
                {field('legal_name', 'Legal name', 'Leave blank to use the name itself')}
                {field('trade_name', 'Trade name', '')}
                <div>
                  <label className="label">Entity type</label>
                  <select className="w-full" value={modal.entity_type} onChange={(e) => setModal({ ...modal, entity_type: e.target.value })}>
                    <option value="">Select</option>
                    {entityOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="w-full" value={modal.status} onChange={(e) => setModal({ ...modal, status: e.target.value })}>
                    {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {field('onboarding_date', 'Onboarding date', '', { type: 'date' })}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Identity</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {field('pan', 'PAN', 'ABCDE1234F', { maxLength: 10 })}
                {field('tan', 'TAN', 'ABCD12345E', { maxLength: 10 })}
                {field('cin_llpin', 'CIN / LLPIN', 'U12345MH2020PTC123456', { maxLength: 21 })}
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">Add GSTIN, PF, ESIC, etc. via "Registrations" after saving the client</p>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Contact</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {field('email', 'Email', 'accounts@abc.com')}
                {field('phone', 'Phone / WhatsApp', '9876543210')}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Address and business</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {field('state', 'State', 'Uttar Pradesh')}
                {field('business_activity', 'Business activity', '')}
                <div>
                  <label className="label">Registered address</label>
                  <textarea className="w-full" rows={2} value={modal.registered_address}
                    onChange={(e) => setModal({ ...modal, registered_address: e.target.value })} />
                </div>
                <div>
                  <label className="label">Business address</label>
                  <textarea className="w-full" rows={2} value={modal.business_address}
                    onChange={(e) => setModal({ ...modal, business_address: e.target.value })} />
                </div>
              </div>
            </div>

            {err && <p className="text-sm text-red-400">{err}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />} Save
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}