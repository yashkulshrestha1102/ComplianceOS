'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserCog } from 'lucide-react'

export default function Team() {
  const [me, setMe] = useState(null)
  const [people, setPeople] = useState([])
  const [clients, setClients] = useState([])
  const [msg, setMsg] = useState('')

  async function load() {
    const { data: s } = await supabase.auth.getSession()
    const uid = s.session?.user.id
    const { data: all } = await supabase.from('profiles')
      .select('id, full_name, email, role, client_id').order('created_at')
    const { data: c } = await supabase.from('clients').select('id, name').order('name')
    setPeople(all || [])
    setClients(c || [])
    setMe((all || []).find((p) => p.id === uid) || null)
  }
  useEffect(() => { load() }, [])

  async function update(id, patch) {
    setMsg('')
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    setMsg(error ? error.message : 'Save ho gaya ✅')
    load()
  }

  if (me && me.role !== 'admin') {
    return <div className="px-8"><div className="card p-8">Is page ka access sirf admin ko hai.</div></div>
  }

  return (
    <div className="px-8 pb-10 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <UserCog className="text-[var(--accent)]" /> Team &amp; Roles
      </h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Naya user: Supabase → Authentication → Users → Add user. Wo yahan apne aap dikhega (default role: staff).
      </p>

      <div className="space-y-3">
        {people.map((p) => (
          <div key={p.id} className="card p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{p.full_name || '-'}</div>
              <div className="text-xs text-[var(--muted)]">{p.email}</div>
            </div>

            <select className="border p-2 rounded text-sm" value={p.role}
              disabled={p.id === me?.id}
              onChange={(e) => update(p.id, { role: e.target.value })}>
              <option value="admin">admin</option>
              <option value="staff">staff</option>
              <option value="client">client</option>
            </select>

            {p.role === 'client' && (
              <select className="border p-2 rounded text-sm" value={p.client_id || ''}
                onChange={(e) => update(p.id, { client_id: e.target.value || null })}>
                <option value="">Company chuno</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
      {msg && <p className="text-sm mt-4">{msg}</p>}
    </div>
  )
}