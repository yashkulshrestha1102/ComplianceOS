'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui'
import { toast } from '@/components/Feedback'

export default function ClientAccessModal({ client, onClose }) {
  const [rows, setRows] = useState(null)
  const [people, setPeople] = useState([])
  const [teams, setTeams] = useState([])
  const [depts, setDepts] = useState([])
  const [form, setForm] = useState({ who: '', allDepts: true, deptIds: [], level: 'view' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const [a, p, t, d] = await Promise.all([
      supabase.from('client_access').select('id, user_id, team_id, department_id, access_level').eq('client_id', client.id),
      supabase.from('profiles').select('id, full_name, email, roles(name)')
        .neq('role', 'client').not('role_id', 'is', null).order('full_name'),
      supabase.from('teams').select('id, name').eq('active', true).order('name'),
      supabase.from('departments').select('id, name').eq('active', true).order('sort_order'),
    ])
    const bad = [a, p, t, d].find((x) => x.error)
    if (bad) toast.error(bad.error.message)
    setRows(a.data || [])
    setPeople(p.data || [])
    setTeams(t.data || [])
    setDepts(d.data || [])
  }
  useEffect(() => { load() }, [client.id])

  const deptName = (id) => depts.find((d) => d.id === id)?.name || 'Unknown'

  const groups = useMemo(() => {
    const g = {}
    ;(rows || []).forEach((r) => {
      const key = r.user_id ? `u:${r.user_id}` : `t:${r.team_id}`
      ;(g[key] ||= { key, user_id: r.user_id, team_id: r.team_id, rows: [] }).rows.push(r)
    })
    return Object.values(g)
  }, [rows])

  function describe(g) {
    if (g.user_id) {
      const p = people.find((x) => x.id === g.user_id)
      return { name: p?.full_name || p?.email || 'User', sub: p?.roles?.name || '' }
    }
    return { name: teams.find((t) => t.id === g.team_id)?.name || 'Team', sub: 'Team' }
  }

  const toggleDept = (id) =>
    setForm((f) => ({ ...f, deptIds: f.deptIds.includes(id) ? f.deptIds.filter((x) => x !== id) : [...f.deptIds, id] }))

  async function add(e) {
    e.preventDefault()
    if (!form.who) return toast.error('Select a user or a team')
    if (!form.allDepts && form.deptIds.length === 0) return toast.error('Select at least one department')
    const [kind, id] = form.who.split(':')
    const { data: s } = await supabase.auth.getSession()
    const base = {
      client_id: client.id,
      access_level: form.level,
      created_by: s.session?.user.id || null,
      user_id: kind === 'u' ? id : null,
      team_id: kind === 't' ? id : null,
    }
    const payload = form.allDepts
      ? [{ ...base, department_id: null }]
      : form.deptIds.map((d) => ({ ...base, department_id: d }))

    setSaving(true)
    const { error } = await supabase.from('client_access').insert(payload)
    setSaving(false)
    if (error) return toast.error(error.code === '23505' ? 'This access already exists' : error.message)
    toast.success('Access added')
    setForm({ who: '', allDepts: true, deptIds: [], level: 'view' })
    load()
  }

  async function setLevel(row, access_level) {
    const { error } = await supabase.from('client_access').update({ access_level }).eq('id', row.id)
    if (error) return toast.error(error.message)
    load()
  }

  async function remove(row) {
    const { error } = await supabase.from('client_access').delete().eq('id', row.id)
    if (error) return toast.error(error.message)
    load()
  }

  return (
    <Modal wide title={`Access: ${client.name}`} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-xs text-[var(--muted)]">
          Users whose role can see all clients already see this client. The assignments below matter for roles that are
          limited to a team or to assigned clients. "Edit" on all departments also lets the user change the client's master data.
        </p>

        {rows === null ? <div className="skeleton h-24" /> : groups.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No one is assigned to this client yet.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => {
              const d = describe(g)
              return (
                <div key={g.key} className="card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">{d.name}</span>
                    {d.sub && <span className="badge badge-gray">{d.sub}</span>}
                  </div>
                  <div className="space-y-1.5">
                    {g.rows.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="badge badge-blue">{r.department_id ? deptName(r.department_id) : 'All departments'}</span>
                        <select value={r.access_level} onChange={(e) => setLevel(r, e.target.value)}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                          <option value="view">View only</option>
                          <option value="edit">View and edit</option>
                        </select>
                        <button className="icon-btn ml-auto" title="Remove access" onClick={() => remove(r)}>
                          <Trash2 size={15} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <form onSubmit={add} className="card p-4 space-y-3">
          <div className="text-sm font-semibold">Add access</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">User or team</label>
              <select className="w-full" value={form.who} onChange={(e) => setForm({ ...form, who: e.target.value })}>
                <option value="">Select</option>
                <optgroup label="Users">
                  {people.map((p) => (
                    <option key={p.id} value={`u:${p.id}`}>{p.full_name || p.email}{p.roles?.name ? ` (${p.roles.name})` : ''}</option>
                  ))}
                </optgroup>
                <optgroup label="Teams">
                  {teams.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.name}</option>)}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="label">Access level</label>
              <select className="w-full" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                <option value="view">View only</option>
                <option value="edit">View and edit</option>
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm mb-2">
              <input type="checkbox" checked={form.allDepts} onChange={(e) => setForm({ ...form, allDepts: e.target.checked })} />
              All departments
            </label>
            {!form.allDepts && (
              <div className="flex flex-wrap gap-2">
                {depts.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 card px-3 py-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.deptIds.includes(d.id)} onChange={() => toggleDept(d.id)} /> {d.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <button className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />} Add access
          </button>
        </form>
      </div>
    </Modal>
  )
}