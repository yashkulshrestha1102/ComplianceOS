'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserCog } from 'lucide-react'
import { PageHeader, EmptyState, Skeleton } from '@/components/ui'

const ROLE_BADGE = { admin: 'badge-red', staff: 'badge-blue', client: 'badge-green' }

export default function Team() {
  const [me, setMe] = useState(null)
  const [people, setPeople] = useState(null)
  const [clients, setClients] = useState([])
  const [notice, setNotice] = useState('')
  const [err, setErr] = useState('')

  async function load() {
    const { data: s } = await supabase.auth.getSession()
    const uid = s.session?.user.id
    const { data: all } = await supabase.from('profiles')
      .select('id, full_name, email, role, client_id, created_at').order('created_at')
    const { data: c } = await supabase.from('clients').select('id, name').order('name')
    setPeople(all || [])
    setClients(c || [])
    setMe((all || []).find((p) => p.id === uid) || null)
  }
  useEffect(() => { load() }, [])

  async function update(id, patch) {
    setErr('')
    setNotice('')
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    if (error) setErr(error.message)
    else {
      setNotice('Save ho gaya ✅')
      setTimeout(() => setNotice(''), 3000)
    }
    load()
  }

  if (me && me.role !== 'admin') {
    return (
      <div className="page">
        <PageHeader icon={UserCog} title="Team & Roles" />
        <div className="card"><EmptyState title="Is page ka access sirf admin ko hai" /></div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader icon={UserCog} title="Team & Roles" subtitle="Kaun kya dekh aur kar sakta hai, yahan se tay karo" />

      <div className="card p-5 mb-6 text-sm">
        <div className="font-semibold mb-2">Naya user kaise jodein?</div>
        <ol className="list-decimal ml-5 text-[var(--muted)] space-y-1">
          <li>Supabase me <b>Authentication → Users → Add user</b> (email, password, <b>Auto Confirm</b> tick).</li>
          <li>Wo user yahan apne aap dikhega (shuru me role: <b>staff</b>).</li>
          <li>Client ke liye role <b>client</b> karo aur dropdown se uski <b>company</b> chuno.</li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
          <span><span className="badge badge-red">admin</span> sab kuch</span>
          <span><span className="badge badge-blue">staff</span> clients aur filings dekh/add/edit</span>
          <span><span className="badge badge-green">client</span> sirf apni company ka portal</span>
        </div>
      </div>

      {notice && <div className="badge badge-green mb-3 px-4 py-2 text-sm">{notice}</div>}
      {err && <p className="text-sm text-red-400 mb-3">{err}</p>}

      <div className="card overflow-x-auto">
        {people === null ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Role</th><th>Company (client ke liye)</th><th>Joda gaya</th></tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-white font-bold flex items-center justify-center shrink-0">
                        {(p.full_name || p.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{p.full_name || '-'} {p.id === me?.id && <span className="text-xs text-[var(--muted)]">(aap)</span>}</div>
                        <div className="text-xs text-[var(--muted)] truncate">{p.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${ROLE_BADGE[p.role] || 'badge-gray'}`}>{p.role}</span>
                      <select value={p.role} disabled={p.id === me?.id} onChange={(e) => update(p.id, { role: e.target.value })}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                        <option value="admin">admin</option>
                        <option value="staff">staff</option>
                        <option value="client">client</option>
                      </select>
                    </div>
                  </td>
                  <td>
                    {p.role === 'client' ? (
                      <select value={p.client_id || ''} onChange={(e) => update(p.id, { client_id: e.target.value || null })}>
                        <option value="">Company chuno</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : (
                      <span className="text-[var(--muted)]">-</span>
                    )}
                  </td>
                  <td className="text-sm text-[var(--muted)]">{new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}