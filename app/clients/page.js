'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Plus, Pencil, Trash2, Search, Loader2 } from 'lucide-react'
import { PageHeader, EmptyState, Skeleton, Modal } from '@/components/ui'

const empty = { name: '', pan: '', gstin: '', email: '', phone: '' }
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/

export default function Clients() {
  const [clients, setClients] = useState(null)
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: s } = await supabase.auth.getSession()
    if (s.session) {
      const { data: me } = await supabase.from('profiles').select('role').eq('id', s.session.user.id).single()
      setRole(me?.role || '')
    }
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients(data || [])
  }
  useEffect(() => { load() }, [])

  async function save(e) {
    e.preventDefault()
    setErr('')
    const row = {
      name: modal.name.trim(),
      pan: modal.pan.trim().toUpperCase(),
      gstin: modal.gstin.trim().toUpperCase(),
      email: modal.email.trim(),
      phone: modal.phone.replace(/\D/g, ''),
    }
    if (row.phone.length === 10) row.phone = '91' + row.phone

    if (!row.name) return setErr('Naam zaroori hai')
    if (row.pan && !PAN_RE.test(row.pan)) return setErr('PAN galat hai (jaise ABCDE1234F)')
    if (row.gstin && !GSTIN_RE.test(row.gstin)) return setErr('GSTIN galat hai (15 characters)')
    if (row.email && !/^\S+@\S+\.\S+$/.test(row.email)) return setErr('Email galat hai')
    if (row.phone && (row.phone.length < 10 || row.phone.length > 13)) return setErr('Phone number galat hai')

    setSaving(true)
    const { error } = modal.id
      ? await supabase.from('clients').update(row).eq('id', modal.id)
      : await supabase.from('clients').insert(row)
    setSaving(false)
    if (error) return setErr(error.message)
    setModal(null)
    load()
  }

  async function remove(c) {
    if (!confirm(`"${c.name}" delete karein?\n\nIske saare filings aur templates bhi hat jayenge.`)) return
    const { error } = await supabase.from('clients').delete().eq('id', c.id)
    if (error) alert(error.message)
    load()
  }

  const shown = (clients || []).filter((c) =>
    `${c.name} ${c.pan || ''} ${c.gstin || ''} ${c.email || ''}`.toLowerCase().includes(q.toLowerCase())
  )

  const field = (key, label, placeholder, extra = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className="w-full" placeholder={placeholder} value={modal[key]} {...extra}
        onChange={(e) => setModal({ ...modal, [key]: e.target.value })} />
    </div>
  )

  return (
    <div className="page">
      <PageHeader icon={Users} title="Clients" subtitle="Aapke saare clients aur unki details">
        <button className="btn btn-primary" onClick={() => { setErr(''); setModal({ ...empty }) }}>
          <Plus size={16} /> Client add karo
        </button>
      </PageHeader>

      <div className="card flex items-center gap-3 px-4 py-2.5 mb-4 max-w-md">
        <Search size={16} className="text-[var(--muted)]" />
        <input className="bare w-full text-sm" placeholder="Naam, PAN, GSTIN ya email se dhundo..."
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        {clients === null ? (
          <div className="p-4 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState title={q ? 'Koi client nahi mila' : 'Abhi koi client nahi hai'}
            text={q ? 'Kuch aur likh ke dhundo.' : 'Pehla client add karke shuru karo.'}
            action={!q && <button className="btn btn-primary" onClick={() => { setErr(''); setModal({ ...empty }) }}><Plus size={16} /> Client add karo</button>} />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Client</th><th>PAN</th><th>GSTIN</th><th>Email</th><th>Phone</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.name}</td>
                  <td>{c.pan || '-'}</td>
                  <td>{c.gstin || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{c.phone || '-'}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="icon-btn" title="Edit" onClick={() => { setErr(''); setModal({ ...empty, ...c, pan: c.pan || '', gstin: c.gstin || '', email: c.email || '', phone: c.phone || '' }) }}>
                        <Pencil size={16} />
                      </button>
                      {role === 'admin' && (
                        <button className="icon-btn" title="Delete" onClick={() => remove(c)}>
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

      {modal && (
        <Modal title={modal.id ? 'Client edit karo' : 'Naya client'} onClose={() => setModal(null)}>
          <form onSubmit={save} className="space-y-4">
            {field('name', 'Client / Company ka naam *', 'ABC Pvt Ltd')}
            <div className="grid grid-cols-2 gap-3">
              {field('pan', 'PAN', 'ABCDE1234F', { maxLength: 10 })}
              {field('gstin', 'GSTIN', '22ABCDE1234F1Z5', { maxLength: 15 })}
            </div>
            {field('email', 'Email', 'accounts@abc.com')}
            {field('phone', 'Phone / WhatsApp', '9876543210')}

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