'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ShieldCheck, Plus, Trash2, Loader2, Lock } from 'lucide-react'
import { PageHeader, Skeleton, Modal } from '@/components/ui'
import { toast, confirmDialog } from '@/components/Feedback'

const MODULES = {
  clients: 'Clients', filings: 'Filings', recurring: 'Recurring', documents: 'Documents', reminders: 'Reminders',
  reports: 'Reports', config: 'Configuration', users: 'Users & Roles', audit: 'Audit', sensitive: 'Sensitive data',
}
const SCOPES = [
  ['all', 'All clients'],
  ['team', "Clients of the user's team"],
  ['assigned', 'Only clients assigned to the user'],
]
const isRecord = (code) => /^(clients|filings|documents|recurring)\./.test(code)
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export default function RolesPage() {
  const [roles, setRoles] = useState(null)
  const [perms, setPerms] = useState([])
  const [rp, setRp] = useState({})
  const [scopes, setScopes] = useState({})
  const [teams, setTeams] = useState([])
  const [people, setPeople] = useState([])
  const [selId, setSelId] = useState(null)
  const [draft, setDraft] = useState(new Set())
  const [scope, setScope] = useState('all')
  const [modal, setModal] = useState(null)
  const [teamName, setTeamName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    const [r, p, x, t, pe] = await Promise.all([
      supabase.from('roles').select('*').order('sort_order').order('name'),
      supabase.from('permissions').select('*').order('sort_order'),
      supabase.from('role_permissions').select('role_id, permission_code, scope'),
      supabase.from('teams').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, role_id, team_id').neq('role', 'client'),
    ])
    const bad = [r, p, x, t, pe].find((q) => q.error)
    if (bad) toast.error(bad.error.message)
    const map = {}
    const sc = {}
    ;(x.data || []).forEach((row) => {
      ;(map[row.role_id] ||= []).push(row.permission_code)
      if (isRecord(row.permission_code) && row.scope !== 'all') sc[row.role_id] = row.scope
    })
    const list = r.data || []
    setRoles(list); setPerms(p.data || []); setRp(map); setScopes(sc)
    setTeams(t.data || []); setPeople(pe.data || [])
    setSelId((cur) => (cur && list.some((q) => q.id === cur) ? cur : list[0]?.id || null))
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    setDraft(new Set(rp[selId] || []))
    setScope(scopes[selId] || 'all')
  }, [selId, rp, scopes])

  const sel = (roles || []).find((r) => r.id === selId)
  const locked = sel?.code === 'super_admin'
  const saved = useMemo(() => new Set(rp[selId] || []), [rp, selId])
  const changed =
    draft.size !== saved.size || [...draft].some((c) => !saved.has(c)) || scope !== (scopes[selId] || 'all')

  const grouped = useMemo(() => {
    const g = {}
    perms.forEach((p) => { (g[p.module] ||= []).push(p) })
    return Object.entries(g)
  }, [perms])

  const toggle = (code) => setDraft((d) => { const n = new Set(d); n.has(code) ? n.delete(code) : n.add(code); return n })
  const setModule = (items, on) =>
    setDraft((d) => { const n = new Set(d); items.forEach((p) => (on ? n.add(p.code) : n.delete(p.code))); return n })

  async function savePerms() {
    setSaving(true)
    const remove = [...saved].filter((c) => !draft.has(c))
    let error = null
    if (remove.length) {
      const res = await supabase.from('role_permissions').delete().eq('role_id', selId).in('permission_code', remove)
      error = res.error
    }
    if (!error && draft.size) {
      const res = await supabase.from('role_permissions').upsert(
        [...draft].map((c) => ({ role_id: selId, permission_code: c, scope: isRecord(c) ? scope : 'all' })),
        { onConflict: 'role_id,permission_code' }
      )
      error = res.error
    }
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(`Permissions saved for ${sel.name}`)
    load()
  }

  async function createRole(e) {
    e.preventDefault()
    setErr('')
    const name = modal.name.trim()
    const code = slug(name)
    if (!name || !code) return setErr('Enter a role name')
    setSaving(true)
    const { data, error } = await supabase.from('roles')
      .insert({ code, name, description: modal.description.trim() || null, legacy_role: 'staff', is_system: false })
      .select().single()
    if (error) {
      setSaving(false)
      return setErr(error.code === '23505' ? 'A role with this name already exists' : error.message)
    }
    const base = rp[modal.base] || []
    if (base.length) {
      const res = await supabase.from('role_permissions').insert(
        base.map((c) => ({ role_id: data.id, permission_code: c, scope: isRecord(c) ? scopes[modal.base] || 'all' : 'all' }))
      )
      if (res.error) toast.error(res.error.message)
    }
    setSaving(false)
    setModal(null)
    toast.success('Role created')
    await load()
    setSelId(data.id)
  }

  async function removeRole(r) {
    const ok = await confirmDialog({ title: `Delete the role "${r.name}"?`, confirmText: 'Delete', danger: true })
    if (!ok) return
    const { error } = await supabase.from('roles').delete().eq('id', r.id)
    if (error) return toast.error(error.code === '23503' ? 'This role is assigned to users. Change their role first.' : error.message)
    toast.success('Role deleted')
    load()
  }

  async function addTeam(e) {
    e.preventDefault()
    const name = teamName.trim()
    if (!name) return
    const { error } = await supabase.from('teams').insert({ name })
    if (error) return toast.error(error.code === '23505' ? 'A team with this name already exists' : error.message)
    setTeamName('')
    load()
  }
  async function patchTeam(t, patch) {
    const { error } = await supabase.from('teams').update(patch).eq('id', t.id)
    if (error) return toast.error(error.message)
    load()
  }
  async function removeTeam(t) {
    const ok = await confirmDialog({
      title: `Delete the team "${t.name}"?`,
      message: 'Members will be removed from the team. Users are not deleted.',
      confirmText: 'Delete', danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('teams').delete().eq('id', t.id)
    if (error) return toast.error(error.message)
    load()
  }

  const count = (rid) => people.filter((p) => p.role_id === rid).length

  return (
    <div className="page">
      <PageHeader icon={ShieldCheck} title="Roles & Permissions" subtitle="Control what each role can see and do">
        <button className="btn btn-primary"
          onClick={() => { setErr(''); setModal({ name: '', description: '', base: roles?.find((r) => r.code === 'viewer')?.id || '' }) }}>
          <Plus size={16} /> New role
        </button>
      </PageHeader>

      {roles === null ? <Skeleton className="h-72" /> : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-2">
            {roles.map((r) => (
              <button key={r.id} onClick={() => setSelId(r.id)} className="card p-4 w-full text-left transition"
                style={r.id === selId ? { borderColor: 'var(--accent)', boxShadow: '0 0 18px var(--glow)' } : {}}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{r.name}</div>
                  <span className="badge badge-gray">{count(r.id)} users</span>
                </div>
                {r.description && <div className="text-xs text-[var(--muted)] mt-1">{r.description}</div>}
                <div className="text-xs mt-2 text-[var(--muted)]">
                  {(rp[r.id] || []).length} permissions · {r.is_system ? 'System role' : 'Custom role'}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 card p-5">
            {sel && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="font-semibold text-lg">{sel.name}</h2>
                  <div className="flex gap-2">
                    {!sel.is_system && (
                      <button className="btn btn-danger" onClick={() => removeRole(sel)}><Trash2 size={16} /> Delete role</button>
                    )}
                    {!locked && (
                      <button className="btn btn-primary" disabled={!changed || saving} onClick={savePerms}>
                        {saving && <Loader2 size={16} className="animate-spin" />} Save changes
                      </button>
                    )}
                  </div>
                </div>

                {locked ? (
                  <p className="text-sm text-amber-400 mb-4 flex items-center gap-2">
                    <Lock size={14} /> The Super Admin always has every permission on all clients. This role cannot be changed.
                  </p>
                ) : (
                  <div className="card p-4 mb-5">
                    <label className="label">Which clients can this role see?</label>
                    <select className="w-full sm:w-96" value={scope} onChange={(e) => setScope(e.target.value)}>
                      {SCOPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <p className="text-xs text-[var(--muted)] mt-2">
                      Applies to Clients, Filings, Documents and Recurring. For "Only assigned", use the Access button on the
                      Clients page to choose who sees which client and which departments. Settings such as Reports and
                      Configuration do not depend on this.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {grouped.map(([mod, items]) => (
                    <div key={mod}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold">{MODULES[mod] || mod}</div>
                        {!locked && (
                          <div className="flex gap-3 text-xs text-[var(--accent)]">
                            <button onClick={() => setModule(items, true)}>Select all</button>
                            <button onClick={() => setModule(items, false)}>Clear</button>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {items.map((p) => (
                          <label key={p.code} className="flex items-center gap-2 card px-3 py-2 text-sm cursor-pointer">
                            <input type="checkbox" disabled={locked} checked={locked || draft.has(p.code)} onChange={() => toggle(p.code)} />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="card p-5 mt-5">
        <h2 className="font-semibold mb-4">Teams</h2>
        <div className="space-y-2">
          {teams.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium w-48">{t.name}</span>
              <select value={t.leader_id || ''} onChange={(e) => patchTeam(t, { leader_id: e.target.value || null })}>
                <option value="">Select team leader</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 6)}</option>)}
              </select>
              <span className="badge badge-gray">{people.filter((p) => p.team_id === t.id).length} members</span>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={t.active} onChange={(e) => patchTeam(t, { active: e.target.checked })} /> Active
              </label>
              <button className="icon-btn ml-auto" title="Delete team" onClick={() => removeTeam(t)}>
                <Trash2 size={16} className="text-red-400" />
              </button>
            </div>
          ))}
          {teams.length === 0 && <p className="text-sm text-[var(--muted)]">No teams yet.</p>}
        </div>
        <form onSubmit={addTeam} className="flex gap-2 mt-4 max-w-md">
          <input className="flex-1" placeholder="New team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          <button className="btn btn-outline"><Plus size={16} /> Add</button>
        </form>
        <p className="text-xs text-[var(--muted)] mt-2">Assign users to teams from the Team & Roles page.</p>
      </div>

      {modal && (
        <Modal title="New custom role" onClose={() => setModal(null)}>
          <form onSubmit={createRole} className="space-y-4">
            <div>
              <label className="label">Role name *</label>
              <input className="w-full" placeholder="e.g. GST Specialist" value={modal.name}
                onChange={(e) => setModal({ ...modal, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="w-full" value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Copy permissions from</label>
              <select className="w-full" value={modal.base} onChange={(e) => setModal({ ...modal, base: e.target.value })}>
                <option value="">Start empty (no permissions)</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {err && <p className="text-sm text-red-400">{err}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />} Create role
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}