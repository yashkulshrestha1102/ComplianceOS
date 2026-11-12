'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ListChecks, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { PageHeader, EmptyState, Skeleton, Modal } from '@/components/ui'
import { toast, confirmDialog } from '@/components/Feedback'

const FREQ = [
  ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['half_yearly', 'Half yearly'],
  ['annual', 'Annual'], ['event_based', 'Event based'], ['one_time', 'One time'],
]
const freqLabel = Object.fromEntries(FREQ)

const parseDays = (s) =>
  [...new Set(String(s).split(',').map((x) => parseInt(x.trim())).filter((n) => !isNaN(n) && n >= 0))]
    .sort((a, b) => b - a)

const emptyForm = {
  name: '', code: '', department_id: '', frequency: '', days: '5,2,0',
  entities: [], rule_source: '', rule_version: '', rule_note: '', due_rule: null, active: true,
}

export default function FilingTypes() {
  const [types, setTypes] = useState(null)
  const [depts, setDepts] = useState([])
  const [entityOpts, setEntityOpts] = useState([])
  const [deptFilter, setDeptFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const [t, d, e] = await Promise.all([
      supabase.from('filing_types').select('*, departments(name)').order('name'),
      supabase.from('departments').select('id, code, name, sort_order').eq('active', true).order('sort_order'),
      supabase.from('dropdown_options').select('value, label').eq('group_key', 'entity_type')
        .eq('status', 'approved').order('sort_order'),
    ])
    if (t.error) toast.error(t.error.message)
    setTypes(t.data || [])
    setDepts(d.data || [])
    setEntityOpts(e.data || [])
  }
  useEffect(() => { load() }, [])

  const rows = useMemo(() => {
    const order = Object.fromEntries(depts.map((d, i) => [d.id, i]))
    return (types || [])
      .filter((t) => deptFilter === 'all' || (deptFilter === 'none' ? !t.department_id : t.department_id === deptFilter))
      .sort((a, b) => (order[a.department_id] ?? 99) - (order[b.department_id] ?? 99) || a.name.localeCompare(b.name))
  }, [types, depts, deptFilter])

  function openNew() {
    setErr('')
    setModal({ ...emptyForm, department_id: deptFilter !== 'all' && deptFilter !== 'none' ? deptFilter : '' })
  }

  function openEdit(t) {
    setErr('')
    setModal({
      id: t.id,
      name: t.name,
      code: t.code || '',
      department_id: t.department_id || '',
      frequency: t.frequency || '',
      days: (t.default_reminder_days || []).join(','),
      entities: t.applicable_entity_types || [],
      rule_source: t.rule_source || '',
      rule_version: t.rule_version ?? '',
      rule_note: t.due_rule?.note || '',
      due_rule: t.due_rule || null,
      active: t.active,
    })
  }

  const toggleEntity = (v) =>
    setModal((m) => ({ ...m, entities: m.entities.includes(v) ? m.entities.filter((x) => x !== v) : [...m.entities, v] }))

  async function save(e) {
    e.preventDefault()
    setErr('')
    const name = modal.name.trim()
    const days = parseDays(modal.days)
    if (!name) return setErr('Naam zaroori hai')
    if (days.length === 0) return setErr('Reminder days sahi daalo, jaise 5,2,0')

    const rule = { ...(modal.due_rule || {}) }
    if (modal.rule_note.trim()) rule.note = modal.rule_note.trim()
    else delete rule.note

    const ver = String(modal.rule_version).trim()
    const row = {
      name,
      code: modal.code.trim().toUpperCase() || null,
      department_id: modal.department_id || null,
      frequency: modal.frequency || null,
      default_reminder_days: days,
      applicable_entity_types: modal.entities,
      rule_source: modal.rule_source.trim() || null,
      rule_version: ver === '' || isNaN(parseInt(ver)) ? null : parseInt(ver),
      due_rule: Object.keys(rule).length ? rule : null,
      active: modal.active,
    }

    setSaving(true)
    const { error } = modal.id
      ? await supabase.from('filing_types').update(row).eq('id', modal.id)
      : await supabase.from('filing_types').insert(row)
    setSaving(false)

    if (error) {
      if (error.code === '23505') {
        return setErr(/code/i.test(error.message) ? 'Ye code pehle se kisi aur filing type ka hai' : 'Is naam ka filing type pehle se hai')
      }
      return setErr(error.message)
    }
    setModal(null)
    toast.success(modal.id ? 'Filing type update ho gaya ✅' : 'Filing type add ho gaya ✅')
    load()
  }

  async function toggleActive(t) {
    const { error } = await supabase.from('filing_types').update({ active: !t.active }).eq('id', t.id)
    if (error) return toast.error(error.message)
    load()
  }

  async function remove(t) {
    const ok = await confirmDialog({
      title: `"${t.name}" delete karein?`,
      message: 'Agar is type ki koi filing ya recurring template hai to delete nahi hoga. Delete ki jagah "Inactive" bhi kar sakte ho.',
      confirmText: 'Delete', danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('filing_types').delete().eq('id', t.id)
    if (error) {
      return toast.error(
        error.code === '23503' ? 'Is type ki filings ya templates maujood hain. Pehle unhe hatao, ya Inactive kar do.' : error.message
      )
    }
    toast.success('Filing type delete ho gaya')
    load()
  }

  const set = (k) => (e) => setModal({ ...modal, [k]: e.target.value })

  return (
    <div className="page">
      <PageHeader icon={ListChecks} title="Filing Types" subtitle="Departments ke hisaab se saari compliances, frequency aur rules">
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Naya filing type</button>
      </PageHeader>

      <div className="flex flex-wrap gap-2 mb-4">
        {[['all', 'Sab'], ...depts.map((d) => [d.id, d.name]), ['none', 'Department nahi']].map(([id, label]) => (
          <button key={id} onClick={() => setDeptFilter(id)}
            className={`btn ${deptFilter === id ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '0.35rem 0.8rem' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {types === null ? (
          <div className="p-4 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState title="Koi filing type nahi mila" text="Naya add karo ya upar ka department filter badlo."
            action={<button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Naya filing type</button>} />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Filing</th><th>Department</th><th>Frequency</th><th>Reminder (din pehle)</th><th>Rule</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} style={t.active ? {} : { opacity: 0.55 }}>
                  <td>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-[var(--muted)]">{t.code || '-'}</div>
                  </td>
                  <td>{t.departments?.name || <span className="badge badge-yellow">Set nahi</span>}</td>
                  <td>{freqLabel[t.frequency] || <span className="text-[var(--muted)]">-</span>}</td>
                  <td className="text-sm">{(t.default_reminder_days || []).join(', ')}</td>
                  <td className="text-xs text-[var(--muted)]">
                    {t.rule_source ? `${t.rule_source}${t.rule_version ? ` · v${t.rule_version}` : ''}` : 'Review baaki'}
                  </td>
                  <td>
                    <button onClick={() => toggleActive(t)} title="Active / Inactive badlo">
                      {t.active ? <span className="badge badge-green">Active</span> : <span className="badge badge-gray">Inactive</span>}
                    </button>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="icon-btn" title="Edit" onClick={() => openEdit(t)}><Pencil size={16} /></button>
                      <button className="icon-btn" title="Delete" onClick={() => remove(t)}>
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal wide title={modal.id ? 'Filing type edit karo' : 'Naya filing type'} onClose={() => setModal(null)}>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Naam *</label>
                <input className="w-full" placeholder="GSTR-3B" value={modal.name} onChange={set('name')} />
              </div>
              <div>
                <label className="label">Code</label>
                <input className="w-full" placeholder="GSTR-3B" value={modal.code} onChange={set('code')} />
              </div>
              <div>
                <label className="label">Department</label>
                <select className="w-full" value={modal.department_id} onChange={set('department_id')}>
                  <option value="">Chuno</option>
                  {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Frequency</label>
                <select className="w-full" value={modal.frequency} onChange={set('frequency')}>
                  <option value="">Abhi tay nahi</option>
                  {FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Default reminder days (comma se alag)</label>
              <input className="w-full" value={modal.days} onChange={set('days')} />
              <p className="text-xs text-[var(--muted)] mt-1">Jaise 5,2,0 = due date se 5 din, 2 din pehle aur due date wale din.</p>
            </div>

            <div>
              <label className="label">Kin entity types par lagu? (kuch na chuno = abhi tay nahi)</label>
              <div className="flex flex-wrap gap-2">
                {entityOpts.map((o) => (
                  <label key={o.value} className="flex items-center gap-2 card px-3 py-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={modal.entities.includes(o.value)} onChange={() => toggleEntity(o.value)} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <div className="text-sm font-semibold">Due date rule (review ke baad bharo)</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="label">Source (act / notification / circular)</label>
                  <input className="w-full" value={modal.rule_source} onChange={set('rule_source')} />
                </div>
                <div>
                  <label className="label">Version</label>
                  <input className="w-full" type="number" min="1" value={modal.rule_version} onChange={set('rule_version')} />
                </div>
              </div>
              <div>
                <label className="label">Rule ka note</label>
                <textarea className="w-full" rows={2} value={modal.rule_note} onChange={set('rule_note')} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={modal.active} onChange={(e) => setModal({ ...modal, active: e.target.checked })} />
              Active (Inactive hone par naye filings me nahi dikhega)
            </label>

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