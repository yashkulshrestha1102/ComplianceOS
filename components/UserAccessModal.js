'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui'
import { toast } from '@/components/Feedback'

const MODULES = {
  clients: 'Clients', filings: 'Filings', recurring: 'Recurring', documents: 'Documents', reminders: 'Reminders',
  reports: 'Reports', config: 'Configuration', users: 'Users & Roles', audit: 'Audit', sensitive: 'Sensitive data',
}
const SCOPE_LABEL = { all: 'All clients', team: 'Team clients', assigned: 'Assigned clients' }
const isRecord = (code) => /^(clients|filings|documents|recurring)\./.test(code)

export default function UserAccessModal({ person, onClose }) {
  const [perms, setPerms] = useState(null)
  const [base, setBase] = useState({})
  const [ov, setOv] = useState({})
  const [access, setAccess] = useState([])
  const [saving, setSaving] = useState(false)

  async function load() {
    const [p, rp, o, a] = await Promise.all([
      supabase.from('permissions').select('*').order('sort_order'),
      person.role_id
        ? supabase.from('role_permissions').select('permission_code, scope').eq('role_id', person.role_id)
        : Promise.resolve({ data: [] }),
      supabase.from('user_permission_overrides').select('permission_code, effect, scope').eq('user_id', person.id),
      supabase.from('client_access').select('id, access_level, clients(name), departments(name)').eq('user_id', person.id),
    ])
    const bad = [p, rp, o, a].find((x) => x.error)
    if (bad) toast.error(bad.error.message)
    const b = {}
    ;(rp.data || []).forEach((r) => { b[r.permission_code] = r.scope })
    const m = {}
    ;(o.data || []).forEach((r) => { m[r.permission_code] = { mode: r.effect, scope: r.scope } })
    setBase(b)
    setOv(m)
    setPerms(p.data || [])
    setAccess(a.data || [])
  }
  useEffect(() => { load() }, [person.id])

  const grouped = useMemo(() => {
    const g = {}
    ;(perms || []).forEach((p) => { (g[p.module] ||= []).push(p) })
    return Object.entries(g)
  }, [perms])

  const get = (code) => ov[code] || { mode: 'default', scope: 'all' }
  const set = (code, patch) => setOv((o) => ({ ...o, [code]: { ...get(code), ...patch } }))

  async function save() {
    setSaving(true)
    const entries = Object.entries(ov)
    const clear = entries.filter(([, v]) => v.mode === 'default').map(([c]) => c)
    const upserts = entries.filter(([, v]) => v.mode !== 'default').map(([code, v]) => ({
      user_id: person.id, permission_code: code, effect: v.mode,
      scope: v.mode === 'grant' && isRecord(code) ? v.scope : 'all',
    }))
    let error = null
    if (clear.length) {
      const res = await supabase.from('user_permission_overrides').delete().eq('user_id', person.id).in('permission_code', clear)
      error = res.error
    }
    if (!error && upserts.length) {
      const res = await supabase.from('user_permission_overrides').upsert(upserts, { onConflict: 'user_id,permission_code' })
      error = res.error
    }
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Special access saved')
    load()
  }

  async function removeAccess(row) {
    const { error } = await supabase.from('client_access').delete().eq('id', row.id)
    if (error) return toast.error(error.message)
    load()
  }

  const name = person.full_name || person.email

  return (
    <Modal wide title={`Special access: ${name}`} onClose={onClose}>
      <div className="space-y-6">
        <p className="text-xs text-[var(--muted)]">
          Each user starts with the permissions of their role. Here you can allow an extra permission or block one for this
          person only. Leave everything on "Follow role" for normal access.
        </p>

        {perms === null ? <div className="skeleton h-40" /> : grouped.map(([mod, items]) => (
          <div key={mod}>
            <div className="text-sm font-semibold mb-2">{MODULES[mod] || mod}</div>
            <div className="space-y-2">
              {items.map((p) => {
                const cur = get(p.code)
                const inRole = base[p.code]
                return (
                  <div key={p.code} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center text-sm">
                    <div className="md:col-span-5">{p.label}</div>
                    <div className="md:col-span-2">
                      {inRole
                        ? <span className="badge badge-green">Role: yes</span>
                        : <span className="badge badge-gray">Role: no</span>}
                    </div>
                    <select className="md:col-span-3" value={cur.mode} onChange={(e) => set(p.code, { mode: e.target.value })}>
                      <option value="default">Follow role</option>
                      <option value="grant">Allow (extra)</option>
                      <option value="deny">Block</option>
                    </select>
                    {cur.mode === 'grant' && isRecord(p.code) ? (
                      <select className="md:col-span-2" value={cur.scope} onChange={(e) => set(p.code, { scope: e.target.value })}>
                        {Object.entries(SCOPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    ) : <span className="md:col-span-2" />}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div className="flex justify-end">
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving && <Loader2 size={16} className="animate-spin" />} Save special access
          </button>
        </div>

        <div className="card p-4">
          <div className="text-sm font-semibold mb-3">Clients assigned directly to this user</div>
          {access.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              None. Assign clients from the Clients page using the Access button (team assignments are not listed here).
            </p>
          ) : (
            <div className="space-y-2">
              {access.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">{a.clients?.name}</span>
                  <span className="badge badge-blue">{a.departments?.name || 'All departments'}</span>
                  <span className="badge badge-gray">{a.access_level === 'edit' ? 'View and edit' : 'View only'}</span>
                  <button className="icon-btn ml-auto" title="Remove access" onClick={() => removeAccess(a)}>
                    <Trash2 size={15} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}