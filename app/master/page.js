'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/fetchAll'
import { Table as TableIcon, Search, Download, ChevronRight, ChevronDown, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { PageHeader, EmptyState, Skeleton } from '@/components/ui'
import { toast } from '@/components/Feedback'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const todayStr = () => new Date().toLocaleDateString('en-CA')
const fmt = (d) => { const [y, m, dd] = d.split('-'); return `${+dd} ${MONTHS[+m - 1]} ${y}` }
const daysLeft = (d) => Math.round((new Date(d) - new Date(todayStr())) / 86400000)

const SERVICE = {
  handled: ['badge-green', 'Handled'],
  not_handled: ['badge-blue', 'Not handled'],
  not_applicable: ['badge-gray', 'N/A'],
  pending_confirmation: ['badge-yellow', 'Pending'],
  suspended: ['badge-red', 'Suspended'],
}
const APPLIC = { applicable: 'Applicable', not_applicable: 'Not applicable', unknown: 'Pata nahi' }
const SORTS = [['name', 'Naam (A-Z)'], ['overdue', 'Most overdue'], ['pending', 'Most pending']]

const csvCell = (v) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return `"${s.replace(/"/g, '""')}"`
}

const stickyTh = { position: 'sticky', top: 0, background: 'var(--panel)', zIndex: 2 }
const stickyCol = { position: 'sticky', left: 0, background: 'var(--card)', zIndex: 1 }
const stickyColTh = { position: 'sticky', left: 0, top: 0, background: 'var(--panel)', zIndex: 3 }

function Detail({ clientId, clientName, depts, openKey, model }) {
  const shown = openKey === 'all' ? depts : depts.filter((d) => d.key === openKey)
  return (
    <div className="space-y-4 p-4" style={{ background: 'var(--panel)' }}>
      {shown.map((d) => (
        <div key={d.key}>
          <div className="text-sm font-semibold mb-2">{d.name}</div>
          {d.types.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No filing types in this department yet. Add them on the Filing Types page.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Form</th><th>Applicable</th><th>Service</th><th>Next due date</th><th>Open</th><th>Overdue</th><th></th></tr>
              </thead>
              <tbody>
                {d.types.map((t) => {
                  const cfg = model.cfgMap[clientId + '|' + t.id]
                  const st = SERVICE[cfg?.service_status || 'pending_confirmation']
                  const f = model.fMap[clientId + '|' + t.id]
                  const next = f?.open[0]
                  const left = next ? daysLeft(next.due_date) : null
                  return (
                    <tr key={t.id}>
                      <td className="font-medium">{t.name}</td>
                      <td className="text-sm">{APPLIC[cfg?.applicability || 'unknown']}</td>
                      <td><span className={`badge ${st[0]}`}>{st[1]}</span></td>
                      <td className="text-sm">
                        {next ? (
                          <>
                            <div>{fmt(next.due_date)}{next.period ? ` · ${next.period}` : ''}</div>
                            <div className={`text-xs ${left < 0 ? 'text-red-400' : left <= 7 ? 'text-amber-400' : 'text-[var(--muted)]'}`}>
                              {left < 0 ? `${-left} days  overdue` : left === 0 ? 'Due today' : `${left} days left`}
                            </div>
                          </>
                        ) : '-'}
                      </td>
                      <td>{f?.open.length || 0}</td>
                      <td className={f?.overdue ? 'text-red-400 font-semibold' : ''}>{f?.overdue || 0}</td>
                      <td>
                        <Link className="text-xs text-[var(--accent)]" href={`/filings?q=${encodeURIComponent(clientName)}`}>View filings</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}

export default function MasterSheet() {
  const [data, setData] = useState(null)
  const [view, setView] = useState('matrix')
  const [q, setQ] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [sortBy, setSortBy] = useState('name')
  const [hidden, setHidden] = useState(() => new Set())
  const [showCols, setShowCols] = useState(false)
  const [open, setOpen] = useState({})
  const [limit, setLimit] = useState(50)

  async function load() {
    setData(null)
    try {
      const [clients, cfg, filings, types, depts, ent] = await Promise.all([
        fetchAll(() => supabase.from('clients').select('id, name, trade_name, pan, entity_type, status').order('name').order('id')),
        fetchAll(() => supabase.from('client_compliance_config').select('id, client_id, filing_type_id, applicability, service_status').order('id')),
        fetchAll(() => supabase.from('filings').select('id, client_id, filing_type_id, period, due_date, status').order('id')),
        supabase.from('filing_types').select('id, name, code, department_id, active').order('name'),
        supabase.from('departments').select('id, code, name, sort_order').eq('active', true).order('sort_order'),
        supabase.from('dropdown_options').select('value, label').eq('group_key', 'entity_type').eq('status', 'approved').order('sort_order'),
      ])
      if (types.error) throw types.error
      if (depts.error) throw depts.error
      setData({ clients, cfg, filings, types: types.data || [], depts: depts.data || [], entities: ent.data || [] })
    } catch (e) {
      toast.error(e.message || 'Master sheet could not load')
      setData({ clients: [], cfg: [], filings: [], types: [], depts: [], entities: [] })
    }
  }
  useEffect(() => { load() }, [])

  const model = useMemo(() => {
    if (!data) return null
    const today = todayStr()

    const deptMap = {}
    data.depts.forEach((d) => { deptMap[d.id] = { key: d.id, name: d.name, order: d.sort_order, types: [] } })
    const typeDept = {}
    data.types.forEach((t) => {
      const k = t.department_id && deptMap[t.department_id] ? t.department_id : 'none'
      typeDept[t.id] = k
      if (!t.active) return
      if (k === 'none') deptMap.none = deptMap.none || { key: 'none', name: 'Other', order: 999, types: [] }
      deptMap[k].types.push(t)
    })
    const depts = Object.values(deptMap).sort((a, b) => a.order - b.order)

    const cfgMap = {}
    data.cfg.forEach((r) => { cfgMap[r.client_id + '|' + r.filing_type_id] = r })

    const fMap = {}
    const cStats = {}
    data.filings.forEach((f) => {
      const e = (fMap[f.client_id + '|' + f.filing_type_id] ||= { open: [], overdue: 0, filed: 0 })
      const s = (cStats[f.client_id] ||= { pending: 0, overdue: 0, completed: 0, dept: {} })
      const ds = (s.dept[typeDept[f.filing_type_id] || 'none'] ||= { overdue: 0, pending: 0 })
      if (f.status === 'filed') { e.filed++; s.completed++ }
      else {
        e.open.push(f)
        if (f.due_date < today) { e.overdue++; s.overdue++; ds.overdue++ } else { s.pending++; ds.pending++ }
      }
    })
    Object.values(fMap).forEach((e) => e.open.sort((a, b) => a.due_date.localeCompare(b.due_date)))

    const deptSummary = (clientId, d) => {
      let handled = 0
      d.types.forEach((t) => { if (cfgMap[clientId + '|' + t.id]?.service_status === 'handled') handled++ })
      const ds = cStats[clientId]?.dept[d.key] || { overdue: 0, pending: 0 }
      return { handled, total: d.types.length, overdue: ds.overdue, pending: ds.pending }
    }
    return { depts, cfgMap, fMap, cStats, deptSummary }
  }, [data])

  const entityLabel = useMemo(
    () => Object.fromEntries((data?.entities || []).map((o) => [o.value, o.label])), [data])

  const rows = useMemo(() => {
    if (!model) return []
    const needle = q.trim().toLowerCase()
    const list = data.clients
      .filter((c) => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false
        if (entityFilter !== 'all' && c.entity_type !== entityFilter) return false
        if (needle && !`${c.name} ${c.trade_name || ''} ${c.pan || ''}`.toLowerCase().includes(needle)) return false
        if (onlyOverdue && !(model.cStats[c.id]?.overdue > 0)) return false
        return true
      })
      .map((c) => ({ c, s: model.cStats[c.id] || { pending: 0, overdue: 0, completed: 0 } }))
    if (sortBy === 'overdue') list.sort((a, b) => b.s.overdue - a.s.overdue || a.c.name.localeCompare(b.c.name))
    if (sortBy === 'pending') list.sort((a, b) => b.s.pending - a.s.pending || a.c.name.localeCompare(b.c.name))
    return list
  }, [data, model, q, statusFilter, entityFilter, onlyOverdue, sortBy])

  const visibleDepts = (model?.depts || []).filter((d) => !hidden.has(d.key))
  const shown = rows.slice(0, limit)
  const totals = rows.reduce((a, r) => ({
    pending: a.pending + r.s.pending, overdue: a.overdue + r.s.overdue, completed: a.completed + r.s.completed,
  }), { pending: 0, overdue: 0, completed: 0 })

  const toggleDept = (key) => setHidden((h) => { const n = new Set(h); n.has(key) ? n.delete(key) : n.add(key); return n })
  const toggleRow = (id, key) => setOpen((o) => ({ ...o, [id]: o[id] === key ? undefined : key }))
  const expandAll = () => setOpen(Object.fromEntries(shown.map((r) => [r.c.id, 'all'])))

  function exportCsv() {
    const head = ['Client', 'Entity', 'Status', ...visibleDepts.map((d) => `${d.name} (handled)`), 'Pending', 'Overdue', 'Completed']
    const body = rows.map(({ c, s }) => [
      c.name, entityLabel[c.entity_type] || c.entity_type || '', c.status,
      ...visibleDepts.map((d) => model.deptSummary(c.id, d).handled),
      s.pending, s.overdue, s.completed,
    ])
    const csv = [head, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `master-sheet-${todayStr()}.csv`
    a.click()
  }

  const colSpan = view === 'matrix' ? 5 + visibleDepts.length : 6

  return (
    <div className="page">
      <PageHeader icon={TableIcon} title="Master Sheet" subtitle="All clients and their compliances at a glance">
        <button className="btn btn-outline" onClick={load}><RefreshCw size={16} /> Refresh</button>
        <button className="btn btn-primary" disabled={rows.length === 0} onClick={exportCsv}><Download size={16} /> Excel (CSV)</button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex gap-2">
          <button className={`btn ${view === 'matrix' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('matrix')}>Matrix view</button>
          <button className={`btn ${view === 'nested' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setView('nested'); setOpen({}) }}>Nested view</button>
        </div>
        <div className="card flex items-center gap-3 px-4 py-2.5 flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="text-[var(--muted)]" />
          <input className="bare w-full text-sm" placeholder="Client name or PAN..." value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(50) }} />
        </div>
        <select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setLimit(50) }}>
          <option value="all">All entity types</option>
          {(data?.entities || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setLimit(50) }}>
          <option value="active">Active clients</option>
          <option value="inactive">Inactive</option>
          <option value="prospect">Prospect</option>
          <option value="all">All</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyOverdue} onChange={(e) => { setOnlyOverdue(e.target.checked); setLimit(50) }} />
          Only overdue
        </label>
        {view === 'matrix' && (
          <div className="relative">
            <button className="btn btn-outline" onClick={() => setShowCols(!showCols)}><SlidersHorizontal size={16} /> Columns</button>
            {showCols && (
              <div className="card p-3 absolute z-40 mt-2 w-56 space-y-2" style={{ background: 'var(--panel)' }}>
                {(model?.depts || []).map((d) => (
                  <label key={d.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!hidden.has(d.key)} onChange={() => toggleDept(d.key)} /> {d.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {view === 'nested' && shown.length > 0 && (
          <div className="flex gap-2">
            <button className="btn btn-outline" onClick={expandAll}>Expand all</button>
            <button className="btn btn-outline" onClick={() => setOpen({})}>Collapse all</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-sm mb-3">
        <span>Clients: <b>{rows.length}</b></span>
        <span className="text-amber-400">Pending: <b>{totals.pending}</b></span>
        <span className="text-red-400">Overdue: <b>{totals.overdue}</b></span>
        <span className="text-green-400">Completed: <b>{totals.completed}</b></span>
      </div>

      <div className="card overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        {!data ? (
          <div className="p-4 space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState title="No clients found" text="Try changing the search or filters." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={stickyColTh}>Client</th>
                <th style={stickyTh}>Entity</th>
                {view === 'matrix' && visibleDepts.map((d) => <th key={d.key} style={stickyTh}>{d.name}</th>)}
                {view === 'nested' && <th style={stickyTh}>Handled forms</th>}
                <th style={stickyTh}>Pending</th>
                <th style={stickyTh}>Overdue</th>
                <th style={stickyTh}>Completed</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ c, s }) => {
                const o = open[c.id]
                const handledTotal = model.depts.reduce((a, d) => a + model.deptSummary(c.id, d).handled, 0)
                return (
                  <Fragment key={c.id}>
                    <tr>
                      <td style={stickyCol}>
                        <button className="flex items-center gap-2 text-left" onClick={() => toggleRow(c.id, 'all')}>
                          {o ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <span>
                            <span className="font-semibold">{c.name}</span>
                            {c.pan && <span className="block text-xs text-[var(--muted)]">{c.pan}</span>}
                          </span>
                        </button>
                      </td>
                      <td className="text-sm">{entityLabel[c.entity_type] || c.entity_type || '-'}</td>
                      {view === 'matrix' && visibleDepts.map((d) => {
                        const x = model.deptSummary(c.id, d)
                        return (
                          <td key={d.key}>
                            <button className="flex items-center gap-1.5" title={`${d.name} ke forms kholo`}
                              onClick={() => toggleRow(c.id, d.key)}>
                              {x.handled > 0
                                ? <span className="badge badge-green">Yes · {x.handled}/{x.total}</span>
                                : <span className="text-[var(--muted)]">{x.total ? 'No' : '-'}</span>}
                              {x.overdue > 0 && <span className="badge badge-red">{x.overdue}</span>}
                            </button>
                          </td>
                        )
                      })}
                      {view === 'nested' && <td>{handledTotal}</td>}
                      <td>{s.pending}</td>
                      <td className={s.overdue ? 'text-red-400 font-semibold' : ''}>{s.overdue}</td>
                      <td className="text-green-400">{s.completed}</td>
                    </tr>
                    {o && (
                      <tr>
                        <td colSpan={colSpan} style={{ padding: 0 }}>
                          <Detail clientId={c.id} clientName={c.name} depts={model.depts} openKey={o} model={model} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > limit && (
        <div className="text-center mt-4">
          <button className="btn btn-outline" onClick={() => setLimit(limit + 50)}>Aur dikhao ({rows.length - limit} baaki)</button>
        </div>
      )}
    </div>
  )
}