'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/fetchAll'
import { ClipboardList, Download, Printer } from 'lucide-react'
import { PageHeader, EmptyState, Skeleton, StatusBadge } from '@/components/ui'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayStr = () => ymd(new Date())
const fmt = (d) => { if (!d) return '-'; const [y, m, dd] = d.split('-'); return `${+dd} ${MONTHS[+m - 1]} ${y}` }
const shownStatus = (f) => (f.status !== 'filed' && f.due_date < todayStr() ? 'overdue' : f.status)

function monthRange(offset) {
  const t = new Date()
  return [ymd(new Date(t.getFullYear(), t.getMonth() + offset, 1)), ymd(new Date(t.getFullYear(), t.getMonth() + offset + 1, 0))]
}
function next30() {
  const t = new Date()
  return [ymd(t), ymd(new Date(t.getTime() + 30 * 86400000))]
}
function fyRange() {
  const t = new Date()
  const y = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1
  return [`${y}-04-01`, `${y + 1}-03-31`]
}

// CSV me Excel formula injection se bachne ke liye
const cell = (v) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return `"${s.replace(/"/g, '""')}"`
}

const empty = { from: '', to: '', client: '', type: '', status: 'all', person: '' }

export default function Reports() {
  const [filings, setFilings] = useState(null)
  const [clients, setClients] = useState([])
  const [types, setTypes] = useState([])
  const [people, setPeople] = useState([])
  const [flt, setFlt] = useState(empty)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [c, t, p, f] = await Promise.all([
          supabase.from('clients').select('id,name').order('name'),
          supabase.from('filing_types').select('id,name').order('name'),
          supabase.from('profiles').select('id,full_name').neq('role', 'client'),
          fetchAll(() => supabase.from('filings')
            .select('*, clients(name), filing_types(name), filing_assignees(user_id, profiles(full_name))')
            .order('due_date').order('id')),
        ])
        setClients(c.data || [])
        setTypes(t.data || [])
        setPeople(p.data || [])
        setFilings(f)
      } catch (e) {
        setError(e.message || 'Data load nahi hua')
        setFilings([])
      }
    }
    load()
  }, [])

  const rows = useMemo(() => (filings || []).filter((f) => {
    if (flt.from && f.due_date < flt.from) return false
    if (flt.to && f.due_date > flt.to) return false
    if (flt.client && f.client_id !== flt.client) return false
    if (flt.type && f.filing_type_id !== flt.type) return false
    if (flt.status !== 'all' && shownStatus(f) !== flt.status) return false
    if (flt.person && !f.filing_assignees.some((a) => a.user_id === flt.person)) return false
    return true
  }), [filings, flt])

  const overdue = rows.filter((f) => shownStatus(f) === 'overdue').length
  const filed = rows.filter((f) => f.status === 'filed').length
  const names = (f) => f.filing_assignees.map((a) => a.profiles?.full_name).filter(Boolean).join(', ')

  function exportCsv() {
    const head = ['Client', 'Filing', 'Period', 'Due date', 'Status', 'Filed on', 'ARN', 'Assigned']
    const body = rows.map((f) => [
      f.clients?.name, f.filing_types?.name, f.period, f.due_date, shownStatus(f), f.filed_on || '', f.arn_number || '', names(f),
    ])
    const csv = [head, ...body].map((r) => r.map(cell).join(',')).join('\r\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `compliance-report-${todayStr()}.csv`
    a.click()
  }

  const preset = (range) => setFlt({ ...flt, from: range[0], to: range[1] })
  const set = (key) => (e) => setFlt({ ...flt, [key]: e.target.value })

  return (
    <div className="page">
      <PageHeader icon={ClipboardList} title="Reports" subtitle="Filings ki report banao, Excel ya PDF me nikalo">
        <div className="flex gap-2 print:hidden">
          <button className="btn btn-outline" disabled={rows.length === 0} onClick={exportCsv}>
            <Download size={16} /> Excel (CSV)
          </button>
          <button className="btn btn-primary" disabled={rows.length === 0} onClick={() => window.print()}>
            <Printer size={16} /> PDF / Print
          </button>
        </div>
      </PageHeader>

      {/* Sirf print me dikhega */}
      <div className="hidden print:block mb-4 text-sm">
        Generated: {fmt(todayStr())} · {rows.length} filings
        {flt.from || flt.to ? ` · Due date: ${fmt(flt.from)} se ${fmt(flt.to)}` : ''}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 space-y-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-outline" style={{ padding: '0.35rem 0.8rem' }} onClick={() => preset(monthRange(0))}>Is mahine</button>
          <button className="btn btn-outline" style={{ padding: '0.35rem 0.8rem' }} onClick={() => preset(monthRange(-1))}>Pichhla mahina</button>
          <button className="btn btn-outline" style={{ padding: '0.35rem 0.8rem' }} onClick={() => preset(next30())}>Agle 30 din</button>
          <button className="btn btn-outline" style={{ padding: '0.35rem 0.8rem' }} onClick={() => preset(fyRange())}>Is saal (FY)</button>
          <button className="btn btn-outline" style={{ padding: '0.35rem 0.8rem' }} onClick={() => setFlt(empty)}>Filter hatao</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div><label className="label">Due date se</label><input className="w-full" type="date" value={flt.from} onChange={set('from')} /></div>
          <div><label className="label">Due date tak</label><input className="w-full" type="date" value={flt.to} onChange={set('to')} /></div>
          <div>
            <label className="label">Client</label>
            <select className="w-full" value={flt.client} onChange={set('client')}>
              <option value="">Sab</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Filing type</label>
            <select className="w-full" value={flt.type} onChange={set('type')}>
              <option value="">Sab</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="w-full" value={flt.status} onChange={set('status')}>
              <option value="all">Sab</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="filed">Filed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className="label">Assigned user</label>
            <select className="w-full" value={flt.person} onChange={set('person')}>
              <option value="">Sab</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 6)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      <div className="flex flex-wrap gap-4 text-sm mb-3">
        <span>Total: <b>{rows.length}</b></span>
        <span className="text-green-400">Filed: <b>{filed}</b></span>
        <span className="text-red-400">Overdue: <b>{overdue}</b></span>
        <span className="text-[var(--muted)]">Baaki: <b>{rows.length - filed - overdue}</b></span>
      </div>

      <div className="card overflow-x-auto">
        {filings === null ? (
          <div className="p-4 space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState title="Is filter me koi filing nahi" text="Date range ya filters badal ke dekho." />
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Client</th><th>Filing</th><th>Period</th><th>Due date</th><th>Status</th><th>Filed on</th><th>ARN</th><th>Assigned</th></tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <td className="font-semibold">{f.clients?.name}</td>
                  <td>{f.filing_types?.name}</td>
                  <td>{f.period || '-'}</td>
                  <td>{fmt(f.due_date)}</td>
                  <td><StatusBadge status={shownStatus(f)} /></td>
                  <td>{fmt(f.filed_on)}</td>
                  <td>{f.arn_number || '-'}</td>
                  <td className="text-xs">{names(f) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}