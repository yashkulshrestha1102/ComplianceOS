'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserCog } from 'lucide-react'
import { PageHeader, EmptyState, Skeleton } from '@/components/ui'
import { toast } from '@/components/Feedback'

export default function Team() {
  const [me, setMe] = useState(null)
  const [people, setPeople] = useState(null)
  const [clients, setClients] = useState([])
  const [roles, setRoles] = useState([])
  const [teams, setTeams] = useState([])

  async function load() {
    const { data: s } = await supabase.auth.getSession()
    const uid = s.session?.user.id
    const [all, c, r, t] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, role_id, client_id, team_id, created_at').order('created_at'),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('roles').select('id, name').eq('active', true).order('sort_order'),
      supabase.from('teams').select('id, name').eq('active', true).order('name'),
    ])
    setPeople(all.data || [])
    setClients(c.data || [])
    setRoles(r.data || [])
    setTeams(t.data || [])
    setMe((all.data || []).find((p) => p.id === uid) || null)
  }
  useEffect(() => { load() }, [])

  async function update(id, patch) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    if (error) toast.error(error.message)
    else toast.success('Save ho gaya ✅')
    load()
  }

  const changeRole = (p, value) =>
    value === 'client' ? update(p.id, { role: 'client', role_id: null, team_id: null }) : update(p.id, { role_id: value })

  if (me && me.role !== 'admin') {
    return (
      <div className="page">
        <PageHeader icon={UserCog} title="Team & Roles" />
        <div className="card"><EmptyState title="Is page ka access sirf Super Admin ko hai" /></div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader icon={UserCog} title="Team & Roles" subtitle="Har user ko role, team aur (client ke liye) company do" />

      <div className="card p-5 mb-6 text-sm">
        <div className="font-semibold mb-2">Naya user kaise jodein?</div>
        <ol className="list-decimal ml-5 text-[var(--muted)] space-y-1">
          <li>Supabase me <b>Authentication → Users → Add user</b> (email, password, <b>Auto Confirm</b> tick).</li>
          <li>Wo user yahan dikhega, par <b>Role set nahi</b> hoga aur wo kuch nahi dekh payega.</li>
          <li>Yahan se uska <b>role</b> chuno. Client ke liye "Client (portal)" chuno aur <b>company</b> bhi.</li>
        </ol>
        <p className="mt-3 text-xs text-[var(--muted)]">Roles ki permissions "Roles & Permissions" page se badalti hain.</p>
      </div>

      <div className="card overflow-x-auto">
        {people === null ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>User</th><th>Role</th><th>Team</th><th>Company (client ke liye)</th><th>Joda gaya</th></tr></thead>
            <tbody>
              {people.map((p) => {
                const isClient = p.role === 'client'
                return (
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
                      <select value={isClient ? 'client' : p.role_id || ''} disabled={p.id === me?.id}
                        onChange={(e) => e.target.value && changeRole(p, e.target.value)}>
                        {!isClient && !p.role_id && <option value="">Role set nahi</option>}
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        <option value="client">Client (portal)</option>
                      </select>
                    </td>
                    <td>
                      {isClient ? <span className="text-[var(--muted)]">-</span> : (
                        <select value={p.team_id || ''} onChange={(e) => update(p.id, { team_id: e.target.value || null })}>
                          <option value="">Koi team nahi</option>
                          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td>
                      {isClient ? (
                        <select value={p.client_id || ''} onChange={(e) => update(p.id, { client_id: e.target.value || null })}>
                          <option value="">Company chuno</option>
                          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : <span className="text-[var(--muted)]">-</span>}
                    </td>
                    <td className="text-sm text-[var(--muted)]">{new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}