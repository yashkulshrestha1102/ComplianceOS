'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui'
import { toast } from '@/components/Feedback'

const APPLIC = [
  ['applicable', 'Applicable'],
  ['not_applicable', 'Not applicable'],
  ['unknown', 'Unknown'],
]
const SERVICE = [
  ['handled', 'Handled (by us)'],
  ['not_handled', 'Not handled'],
  ['not_applicable', 'Not applicable'],
  ['pending_confirmation', 'Pending confirmation'],
  ['suspended', 'Suspended'],
]
const DEFAULT = { applicability: 'unknown', service_status: 'pending_confirmation', notes: '' }

// Dono dropdowns ek-dusre ke saath mel me rahein
function merge(prev, patch) {
  const next = { ...prev, ...patch }
  if (patch.service_status === 'not_applicable') next.applicability = 'not_applicable'
  if (patch.applicability === 'not_applicable') next.service_status = 'not_applicable'
  if (patch.service_status === 'handled') next.applicability = 'applicable'
  if (['not_handled', 'suspended'].includes(patch.service_status) && next.applicability === 'not_applicable') {
    next.applicability = 'applicable'
  }
  if (patch.applicability && patch.applicability !== 'not_applicable' && prev.service_status === 'not_applicable'
      && !('service_status' in patch)) {
    next.service_status = 'pending_confirmation'
  }
  return { ...next, dirty: true }
}

export default function ComplianceConfigModal({ client, canEdit, onClose }) {
  const [types, setTypes] = useState(null)
  const [rows, setRows] = useState({})
  const [saving, setSaving] = useState(false)

  async function load() {
    const [t, c] = await Promise.all([
      supabase.from('filing_types')
        .select('id, name, code, department_id, departments(name, sort_order)')
        .eq('active', true).order('name'),
      supabase.from('client_compliance_config').select('*')
        .eq('client_id', client.id).is('registration_id', null),
    ])
    if (t.error) toast.error(t.error.message)
    if (c.error) toast.error(c.error.message)
    const map = {}
    ;(c.data || []).forEach((r) => {
      map[r.filing_type_id] = {
        id: r.id, applicability: r.applicability, service_status: r.service_status, notes: r.notes || '', dirty: false,
      }
    })
    setRows(map)
    setTypes(t.data || [])
  }
  useEffect(() => { load() }, [client.id])

  const groups = useMemo(() => {
    const g = {}
    ;(types || []).forEach((t) => {
      const key = t.department_id || 'none'
      g[key] = g[key] || {
        key, name: t.departments?.name || 'Department set nahi',
        order: t.departments?.sort_order ?? 999, items: [],
      }
      g[key].items.push(t)
    })
    return Object.values(g).sort((a, b) => a.order - b.order)
  }, [types])

  const get = (id) => rows[id] || DEFAULT
  const edit = (id, patch) => setRows((r) => ({ ...r, [id]: merge(r[id] || DEFAULT, patch) }))
  const setGroup = (g, service_status) => g.items.forEach((t) => edit(t.id, { service_status }))

  const summary = useMemo(() => {
    const s = { handled: 0, not_handled: 0, not_applicable: 0, pending_confirmation: 0, suspended: 0 }
    ;(types || []).forEach((t) => { s[get(t.id).service_status]++ })
    return s
  }, [types, rows])

  const dirtyCount = Object.values(rows).filter((r) => r.dirty).length

  async function save() {
    setSaving(true)
    const { data: s } = await supabase.auth.getSession()
    const uid = s.session?.user.id || null
    const dirty = Object.entries(rows).filter(([, r]) => r.dirty)
    const payload = (ftId, r) => ({
      client_id: client.id, filing_type_id: ftId,
      applicability: r.applicability, service_status: r.service_status,
      notes: r.notes.trim() || null, updated_by: uid,
    })

    const inserts = dirty.filter(([, r]) => !r.id).map(([ftId, r]) => payload(ftId, r))
    const updates = dirty.filter(([, r]) => r.id)

    let failed = null
    if (inserts.length) {
      const { error } = await supabase.from('client_compliance_config').insert(inserts)
      if (error) failed = error
    }
    const results = await Promise.all(updates.map(([ftId, r]) =>
      supabase.from('client_compliance_config').update(payload(ftId, r)).eq('id', r.id)))
    const bad = results.find((x) => x.error)
    if (bad) failed = bad.error

    setSaving(false)
    if (failed) return toast.error(failed.message)
    toast.success(`${dirty.length} compliance(s) saved ✅`)
    load()
  }

  return (
    <Modal wide title={`Compliance config: ${client.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge badge-green">Handled {summary.handled}</span>
          <span className="badge badge-yellow">Pending {summary.pending_confirmation}</span>
          <span className="badge badge-blue">Not handled {summary.not_handled}</span>
          <span className="badge badge-gray">Not applicable {summary.not_applicable}</span>
          <span className="badge badge-red">Suspended {summary.suspended}</span>
        </div>

        {types === null ? (
          <div className="skeleton h-40" />
        ) : groups.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Add filing types on the Filing Types page first.</p>
        ) : groups.map((g) => (
          <div key={g.key} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="font-semibold">{g.name}</div>
              {canEdit && (
                <div className="flex gap-2">
                  <button type="button" className="btn btn-outline" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => setGroup(g, 'handled')}>all Handled</button>
                  <button type="button" className="btn btn-outline" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => setGroup(g, 'not_applicable')}>all N/A</button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {g.items.map((t) => {
                const r = get(t.id)
                return (
                  <div key={t.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center text-sm">
                    <div className="md:col-span-3 font-medium">
                      {t.name} {r.dirty && <span className="text-amber-400">•</span>}
                    </div>
                    <select className="md:col-span-3" disabled={!canEdit} value={r.applicability}
                      onChange={(e) => edit(t.id, { applicability: e.target.value })}>
                      {APPLIC.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select className="md:col-span-3" disabled={!canEdit} value={r.service_status}
                      onChange={(e) => edit(t.id, { service_status: e.target.value })}>
                      {SERVICE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input className="md:col-span-3" placeholder="Note" disabled={!canEdit} value={r.notes}
                      onChange={(e) => edit(t.id, { notes: e.target.value })} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <p className="text-xs text-[var(--muted)]">
          "Applicable" and "Handled" are different: a compliance may apply to the client but we may not handle it. "Pending" means it isn\'t confirmed yet. Per-GSTIN configs for GST will be added later.
        </p>

        {canEdit && (
          <div className="flex justify-end gap-3 pt-1">
            <button className="btn btn-outline" onClick={onClose}>Close</button>
            <button className="btn btn-primary" disabled={saving || dirtyCount === 0} onClick={save}>
              {saving && <Loader2 size={16} className="animate-spin" />} Save ({dirtyCount})
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}