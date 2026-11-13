'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Paperclip, Plus, Trash2, Loader2, CheckSquare, MessageSquare, History, AlarmClock } from 'lucide-react'
import { Skeleton, EmptyState } from '@/components/ui'
import DocumentsModal from '@/components/DocumentsModal'
import { toast, confirmDialog } from '@/components/Feedback'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const todayStr = () => new Date().toLocaleDateString('en-CA')
const fmt = (d) => { if (!d) return '-'; const [y, m, dd] = d.split('-'); return `${+dd} ${MONTHS[+m - 1]} ${y}` }
const daysLeft = (d) => Math.round((new Date(d) - new Date(todayStr())) / 86400000)
const when = (t) => new Date(t).toLocaleString('en-IN')
const n = (s) => String(s ?? '').trim() || null

const WORK = [
  ['not_started', 'Not Started'], ['data_awaited', 'Data Awaited'], ['data_received', 'Data Received'],
  ['under_preparation', 'Under Preparation'], ['under_review', 'Under Review'], ['changes_required', 'Changes Required'],
  ['awaiting_client_approval', 'Awaiting Client Approval'], ['ready_to_file', 'Ready to File'],
  ['on_hold', 'On Hold'], ['completed', 'Completed'], ['not_applicable', 'Not Applicable'],
]
const DATA = [
  ['not_requested', 'Not Requested'], ['requested', 'Requested'], ['partially_received', 'Partially Received'],
  ['fully_received', 'Fully Received'], ['verified', 'Verified'], ['rejected', 'Rejected'],
]
const RESULT = [
  ['not_filed', 'Not Filed'], ['filed_successfully', 'Filed Successfully'], ['failed', 'Failed'],
  ['pending_confirmation', 'Pending Confirmation'], ['revised_rectified', 'Revised / Rectified'],
]
const DECISION = [
  ['comment', 'Sirf comment'], ['changes_required', 'Changes required'], ['approved', 'Approve'], ['rejected', 'Reject'],
]
const label = (list, v) => list.find(([k]) => k === v)?.[1] || v
const RESULT_TONE = { filed_successfully: 'badge-green', failed: 'badge-red', pending_confirmation: 'badge-yellow', revised_rectified: 'badge-blue' }

function Section({ icon: Icon, title, right, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2">
          {Icon && <Icon size={18} className="text-[var(--accent)]" />} {title}
        </h2>
        {right}
      </div>
      {children}
    </div>
  )
}

function Row({ k, children }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm py-1.5">
      <span className="text-[var(--muted)]">{k}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

export default function FilingDetails() {
  const { id } = useParams()
  const [f, setF] = useState(null)
  const [missing, setMissing] = useState(false)
  const [people, setPeople] = useState([])
  const [regs, setRegs] = useState([])
  const [items, setItems] = useState([])
  const [reviews, setReviews] = useState([])
  const [activity, setActivity] = useState([])
  const [log, setLog] = useState([])
  const [form, setForm] = useState(null)
  const [newItem, setNewItem] = useState('')
  const [review, setReview] = useState({ decision: 'comment', comment: '' })
  const [busy, setBusy] = useState(false)
  const [docs, setDocs] = useState(false)

  const who = (uid) => people.find((p) => p.id === uid)?.full_name || '-'

  async function uid() {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id || null
  }

  async function load() {
    const { data: row, error } = await supabase.from('filings')
      .select('*, clients(name, pan, phone), filing_types(name, code, departments(name)), filing_assignees(user_id, profiles(full_name))')
      .eq('id', id).maybeSingle()
    if (error) toast.error(error.message)
    if (!row) { setMissing(true); return }

    const [p, r, c, rv, a, l] = await Promise.all([
      supabase.from('profiles').select('id, full_name').neq('role', 'client'),
      supabase.from('client_registrations').select('id, reg_type, reg_number, is_branch, branch_name').eq('client_id', row.client_id),
      supabase.from('filing_checklist_items').select('*').eq('filing_id', id).order('sort_order').order('created_at'),
      supabase.from('filing_reviews').select('*').eq('filing_id', id).order('created_at', { ascending: false }),
      supabase.from('filing_activity').select('*').eq('filing_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('reminder_log').select('channel, days_before, sent_at, profiles(full_name)').eq('filing_id', id)
        .order('sent_at', { ascending: false }).limit(8),
    ])
    setF(row)
    setPeople(p.data || [])
    setRegs(r.data || [])
    setItems(c.data || [])
    setReviews(rv.data || [])
    setActivity(a.data || [])
    setLog(l.data || [])
    setForm({
      financial_year: row.financial_year || '',
      registration_id: row.registration_id || '',
      reviewer_id: row.reviewer_id || '',
      arn_number: row.arn_number || '',
      filed_on: row.filed_on || '',
      remarks: row.remarks || '',
    })
  }
  useEffect(() => { load() }, [id])

  async function logActivity(action, note) {
    await supabase.from('filing_activity').insert({ filing_id: id, user_id: await uid(), action, note })
  }

  async function setStatus(field, value, title, labels) {
    if (field === 'filing_result' && ['filed_successfully', 'revised_rectified'].includes(value)) {
      const ok = await confirmDialog({
        title: 'Filing submit mark karein?',
        message: `Ye sach me government portal par ${value === 'filed_successfully' ? 'file ho chuki' : 'revise/rectify ho chuki'} hai?\n\nSirf tabhi mark karo jab acknowledgement mil gaya ho.`,
        confirmText: 'Haan, mark karo',
      })
      if (!ok) return
    }
    setBusy(true)
    const { error } = await supabase.from('filings').update({ [field]: value }).eq('id', id)
    setBusy(false)
    if (error) return toast.error(error.message)
    await logActivity('status_changed', `${title}: ${label(labels, f[field])} → ${label(labels, value)}`)
    load()
  }

  async function saveDetails(e) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.from('filings').update({
      financial_year: n(form.financial_year),
      registration_id: form.registration_id || null,
      reviewer_id: form.reviewer_id || null,
      arn_number: n(form.arn_number),
      filed_on: form.filed_on || null,
      remarks: n(form.remarks),
    }).eq('id', id)
    setBusy(false)
    if (error) return toast.error(error.message)
    await logActivity('edited', 'Filing details update hui')
    toast.success('Save ho gaya ✅')
    load()
  }

  async function addItem(e) {
    e.preventDefault()
    const title = newItem.trim()
    if (!title) return
    const { error } = await supabase.from('filing_checklist_items').insert({ filing_id: id, title, sort_order: items.length })
    if (error) return toast.error(error.message)
    setNewItem('')
    load()
  }

  async function toggleItem(it) {
    const done = !it.done
    const { error } = await supabase.from('filing_checklist_items').update({
      done, done_by: done ? await uid() : null, done_at: done ? new Date().toISOString() : null,
    }).eq('id', it.id)
    if (error) return toast.error(error.message)
    await logActivity('checklist', `${done ? 'Poora' : 'Wapas khola'}: ${it.title}`)
    load()
  }

  async function removeItem(it) {
    const { error } = await supabase.from('filing_checklist_items').delete().eq('id', it.id)
    if (error) return toast.error(error.message)
    load()
  }

  async function addReview(e) {
    e.preventDefault()
    if (review.decision !== 'approved' && !review.comment.trim()) return toast.error('Comment likho')
    setBusy(true)
    const round = 1 + reviews.filter((r) => r.decision === 'changes_required').length
    const { error } = await supabase.from('filing_reviews').insert({
      filing_id: id, reviewer_id: await uid(), round, decision: review.decision, comment: n(review.comment),
    })
    if (error) { setBusy(false); return toast.error(error.message) }

    const next = { changes_required: 'changes_required', approved: 'ready_to_file' }[review.decision]
    if (next) await supabase.from('filings').update({ work_status: next }).eq('id', id)
    await logActivity('review', `${label(DECISION, review.decision)} (round ${round})`)
    setBusy(false)
    setReview({ decision: 'comment', comment: '' })
    load()
  }

  const done = items.filter((i) => i.done).length
  const regLabel = (r) => `${r.reg_type} ${r.reg_number}${r.is_branch ? ` (${r.branch_name})` : ''}`
  const reg = useMemo(() => regs.find((r) => r.id === f?.registration_id), [regs, f])

  if (missing) {
    return (
      <div className="page">
        <div className="card mt-6"><EmptyState title="Ye filing nahi mili" text="Link galat hai ya filing delete ho chuki hai."
          action={<Link href="/filings" className="btn btn-primary">Filings par jao</Link>} /></div>
      </div>
    )
  }
  if (!f || !form) {
    return (
      <div className="page space-y-4 pt-4">
        <Skeleton className="h-16" />
        <div className="grid lg:grid-cols-3 gap-4"><Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-64" /></div>
      </div>
    )
  }

  const open = f.status !== 'filed'
  const left = daysLeft(f.due_date)
  const dueText = !open ? `Filed${f.filed_on ? ` on ${fmt(f.filed_on)}` : ''}`
    : left < 0 ? `${-left} din overdue` : left === 0 ? 'Aaj due hai' : `${left} din baaki`
  const dueTone = !open ? 'text-green-400' : left < 0 ? 'text-red-400' : left <= 7 ? 'text-amber-400' : 'text-[var(--muted)]'
  const assignees = f.filing_assignees.map((a) => a.profiles?.full_name).filter(Boolean)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="page">
      <div className="pt-2 mb-5">
        <Link href="/filings" className="text-sm text-[var(--muted)] flex items-center gap-1 mb-2">
          <ArrowLeft size={14} /> Filings
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{f.filing_types?.name} <span className="text-[var(--muted)] font-normal">· {f.clients?.name}</span></h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              {f.filing_types?.departments?.name || 'Department set nahi'}
              {f.period ? ` · ${f.period}` : ''}{f.financial_year ? ` · FY ${f.financial_year}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-semibold">{fmt(f.due_date)}</div>
              <div className={`text-xs font-medium ${dueTone}`}>{dueText}</div>
            </div>
            <button className="btn btn-outline" onClick={() => setDocs(true)}><Paperclip size={16} /> Documents</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* STATUS */}
          <Section title="Status"
            right={f.filing_result !== 'not_filed' && <span className={`badge ${RESULT_TONE[f.filing_result] || 'badge-gray'}`}>{label(RESULT, f.filing_result)}</span>}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Work status</label>
                <select className="w-full" disabled={busy} value={f.work_status}
                  onChange={(e) => setStatus('work_status', e.target.value, 'Work', WORK)}>
                  {WORK.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Data status</label>
                <select className="w-full" disabled={busy} value={f.data_status}
                  onChange={(e) => setStatus('data_status', e.target.value, 'Data', DATA)}>
                  {DATA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Filing result</label>
                <select className="w-full" disabled={busy} value={f.filing_result}
                  onChange={(e) => setStatus('filing_result', e.target.value, 'Result', RESULT)}>
                  {RESULT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs text-[var(--muted)] mt-3">
              "Completed" ka matlab hamara kaam poora hua; asli government filing sirf "Filing result" se mark hoti hai.
            </p>
            {['filed_successfully', 'revised_rectified'].includes(f.filing_result) && !f.arn_number && (
              <p className="text-xs text-amber-400 mt-2">Filing mark ho chuki hai par ARN / acknowledgement abhi nahi bhara.</p>
            )}
          </Section>

          {/* DATA + SUBMISSION */}
          <Section title="Filing data aur submission">
            <form onSubmit={saveDetails} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Financial year</label>
                  <input className="w-full" placeholder="2026-27" value={form.financial_year} onChange={set('financial_year')} />
                </div>
                <div>
                  <label className="label">Registration (GSTIN / TAN...)</label>
                  <select className="w-full" value={form.registration_id} onChange={set('registration_id')}>
                    <option value="">Koi nahi / sab</option>
                    {regs.map((r) => <option key={r.id} value={r.id}>{regLabel(r)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Reviewer</label>
                  <select className="w-full" value={form.reviewer_id} onChange={set('reviewer_id')}>
                    <option value="">Koi nahi</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 6)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">ARN / acknowledgement number</label>
                  <input className="w-full" value={form.arn_number} onChange={set('arn_number')} />
                </div>
                <div>
                  <label className="label">Filing date</label>
                  <input className="w-full" type="date" value={form.filed_on} onChange={set('filed_on')} />
                </div>
              </div>
              <div>
                <label className="label">Remarks</label>
                <textarea className="w-full" rows={2} value={form.remarks} onChange={set('remarks')} />
              </div>
              <button className="btn btn-primary" disabled={busy}>
                {busy && <Loader2 size={16} className="animate-spin" />} Save karo
              </button>
            </form>
          </Section>

          {/* CHECKLIST */}
          <Section icon={CheckSquare} title="Checklist" right={<span className="badge badge-gray">{done}/{items.length}</span>}>
            {items.length > 0 && (
              <div className="h-2 rounded-full bg-[var(--border)] mb-4">
                <div className="h-2 rounded-full" style={{ width: `${(done / items.length) * 100}%`, background: 'var(--good)' }} />
              </div>
            )}
            <div className="space-y-1">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 text-sm py-1">
                  <input type="checkbox" checked={it.done} onChange={() => toggleItem(it)} />
                  <span className={`flex-1 ${it.done ? 'line-through text-[var(--muted)]' : ''}`}>{it.title}</span>
                  {it.done && it.done_by && <span className="text-xs text-[var(--muted)]">{who(it.done_by)}</span>}
                  <button className="icon-btn" title="Hatao" onClick={() => removeItem(it)}><Trash2 size={14} className="text-red-400" /></button>
                </div>
              ))}
              {items.length === 0 && <p className="text-sm text-[var(--muted)]">Abhi koi step nahi hai.</p>}
            </div>
            <form onSubmit={addItem} className="flex gap-2 mt-4">
              <input className="flex-1" placeholder="Naya step, jaise: Sales register match kiya" value={newItem}
                onChange={(e) => setNewItem(e.target.value)} />
              <button className="btn btn-outline"><Plus size={16} /> Add</button>
            </form>
          </Section>

          {/* REVIEW */}
          <Section icon={MessageSquare} title="Review">
            <form onSubmit={addReview} className="space-y-3 mb-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select value={review.decision} onChange={(e) => setReview({ ...review, decision: e.target.value })}>
                  {DECISION.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input className="sm:col-span-2" placeholder="Reviewer ka comment" value={review.comment}
                  onChange={(e) => setReview({ ...review, comment: e.target.value })} />
              </div>
              <button className="btn btn-outline" disabled={busy}>Review jodo</button>
              <p className="text-xs text-[var(--muted)]">
                "Changes required" par Work status apne aap "Changes Required" ho jata hai, aur "Approve" par "Ready to File".
              </p>
            </form>
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="text-sm border-l-2 pl-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-gray">Round {r.round}</span>
                    <span className={`badge ${r.decision === 'approved' ? 'badge-green' : r.decision === 'comment' ? 'badge-blue' : 'badge-red'}`}>
                      {label(DECISION, r.decision)}
                    </span>
                    <span className="text-xs text-[var(--muted)]">{who(r.reviewer_id)} · {when(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="mt-1">{r.comment}</p>}
                </div>
              ))}
              {reviews.length === 0 && <p className="text-sm text-[var(--muted)]">Abhi koi review nahi hua.</p>}
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Overview">
            <Row k="Client">{f.clients?.name}</Row>
            <Row k="PAN">{f.clients?.pan || '-'}</Row>
            <Row k="Department">{f.filing_types?.departments?.name || '-'}</Row>
            <Row k="Period">{f.period || '-'}</Row>
            <Row k="Registration">{reg ? regLabel(reg) : '-'}</Row>
            <Row k="Assigned">{assignees.join(', ') || 'Koi nahi'}</Row>
            <Row k="Reviewer">{f.reviewer_id ? who(f.reviewer_id) : '-'}</Row>
          </Section>

          <Section icon={AlarmClock} title="Reminders">
            {f.work_status === 'not_applicable' ? (
              <p className="text-sm text-[var(--muted)]">Not Applicable hone se reminders band hain.</p>
            ) : (
              <div className="text-sm space-y-1">
                <Row k="Din pehle">{(f.reminder_days || []).join(', ') || '-'}</Row>
                <Row k="Channels">{(f.channels || []).join(', ') || '-'}</Row>
                {assignees.length === 0 && open && <p className="text-xs text-amber-400">Kisi ko assign nahi, to koi reminder nahi jayega.</p>}
              </div>
            )}
            <div className="mt-3 space-y-1.5">
              {log.map((l, i) => (
                <div key={i} className="text-xs text-[var(--muted)]">
                  {when(l.sent_at)} · {l.profiles?.full_name || '-'} · {l.channel.startsWith('esc_') ? 'Escalation ' : ''}{l.channel.replace('esc_', '')}
                </div>
              ))}
              {log.length === 0 && <p className="text-xs text-[var(--muted)]">Abhi tak koi reminder nahi bheja gaya.</p>}
            </div>
          </Section>

          <Section icon={History} title="Activity">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activity.map((a) => (
                <div key={a.id} className="text-sm">
                  <div>{a.note || a.action}</div>
                  <div className="text-xs text-[var(--muted)]">{who(a.user_id)} · {when(a.created_at)}</div>
                </div>
              ))}
              {activity.length === 0 && <p className="text-sm text-[var(--muted)]">Abhi koi activity nahi.</p>}
            </div>
          </Section>
        </div>
      </div>

      {docs && <DocumentsModal filing={f} canEdit={true} onClose={() => setDocs(false)} onChanged={load} />}
    </div>
  )
}