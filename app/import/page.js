'use client'
import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase'
import { Upload, Download, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui'

const VALID_CHANNELS = ['email', 'push', 'whatsapp', 'telegram']
const TEMPLATE =
  'client_name,filing_type,period,due_date,reminder_days,channels,assignee_emails\n' +
  'ABC Pvt Ltd,GSTR-3B,Oct 2026,20-11-2026,5;2;0,email;push,staff@example.com\n' +
  'XYZ Traders,Advance Tax,Q3 FY26-27,15-12-2026,7;3;0,email;push;telegram,\n'

const list = (s) => String(s || '').split(/[;,|]+/).map((x) => x.trim()).filter(Boolean)
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

// YYYY-MM-DD ya DD-MM-YYYY / DD/MM/YYYY
function parseDate(s) {
  s = String(s || '').trim()
  let y, mo, d
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3] }
  else {
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
    if (!m) return null
    d = +m[1]; mo = +m[2]; y = +m[3]
  }
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function validate(raw, ctx, createClients) {
  const clientByName = {}
  ctx.clients.forEach((c) => (clientByName[c.name.trim().toLowerCase()] = c.id))
  const typeByName = {}
  ctx.types.forEach((t) => (typeByName[t.name.trim().toLowerCase()] = t))
  const personByEmail = {}
  ctx.people.forEach((p) => p.email && (personByEmail[p.email.trim().toLowerCase()] = p.id))
  const existing = new Set(ctx.existing.map((f) => `${f.client_id}|${f.filing_type_id}|${f.due_date}|${(f.period || '').toLowerCase()}`))
  const seen = new Set()

  return raw.map((r, i) => {
    const errors = []
    const clientName = String(r.client_name || '').trim()
    const clientId = clientByName[clientName.toLowerCase()] || null
    if (!clientName) errors.push('client_name khali hai')
    else if (!clientId && !createClients) errors.push('client nahi mila')

    const type = typeByName[String(r.filing_type || '').trim().toLowerCase()]
    if (!type) errors.push('filing_type nahi mila')

    const due = parseDate(r.due_date)
    if (!due) errors.push('due_date galat (DD-MM-YYYY likho)')

    let days = list(r.reminder_days).map((x) => parseInt(x)).filter((n) => !isNaN(n))
    if (days.length === 0) days = type ? type.default_reminder_days : [5, 2, 0]

    let channels = list(r.channels).map((c) => c.toLowerCase())
    if (channels.length === 0) channels = ['email', 'push']
    const badCh = channels.filter((c) => !VALID_CHANNELS.includes(c))
    if (badCh.length) errors.push('channel galat: ' + badCh.join(', '))

    const assigneeIds = []
    list(r.assignee_emails).forEach((em) => {
      const id = personByEmail[em.toLowerCase()]
      if (id) assigneeIds.push(id)
      else errors.push('user nahi mila: ' + em)
    })

    const period = String(r.period || '').trim()
    if (!errors.length) {
      const key = `${clientId || 'new:' + clientName.toLowerCase()}|${type.id}|${due}|${period.toLowerCase()}`
      if (clientId && existing.has(key)) errors.push('pehle se maujood (duplicate)')
      else if (seen.has(key)) errors.push('file me dobara aayi')
      seen.add(key)
    }

    return {
      n: i + 2, // Excel row number (header ke baad)
      ok: errors.length === 0,
      error: errors.join('; '),
      data: { clientName, clientId, typeId: type?.id, typeName: type?.name, period, due, days, channels, assigneeIds },
    }
  })
}

export default function ImportPage() {
  const [ctx, setCtx] = useState({ clients: [], types: [], people: [], existing: [] })
  const [raw, setRaw] = useState([])
  const [createClients, setCreateClients] = useState(true)
  const [fileName, setFileName] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadCtx() {
    const [c, t, p, f] = await Promise.all([
      supabase.from('clients').select('id,name'),
      supabase.from('filing_types').select('id,name,default_reminder_days'),
      supabase.from('profiles').select('id,email').neq('role', 'client'),
      supabase.from('filings').select('client_id,filing_type_id,due_date,period').limit(5000),
    ])
    const next = { clients: c.data || [], types: t.data || [], people: p.data || [], existing: f.data || [] }
    setCtx(next)
    return next
  }
  useEffect(() => { loadCtx() }, [])

  const checked = useMemo(() => validate(raw, ctx, createClients), [raw, ctx, createClients])
  const good = checked.filter((r) => r.ok)

  function downloadTemplate() {
    const blob = new Blob(['\ufeff' + TEMPLATE], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'filings-import-template.csv'
    a.click()
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg('')
    setFileName(file.name)
    await loadCtx()
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => setRaw(res.data),
    })
    e.target.value = ''
  }

  async function doImport() {
    setBusy(true)
    setMsg('')
    try {
      if (good.length === 0) throw new Error('Koi valid row nahi hai')
      const { data: s } = await supabase.auth.getSession()

      // 1) Naye clients
      const idByName = {}
      ctx.clients.forEach((c) => (idByName[c.name.trim().toLowerCase()] = c.id))
      const newNames = [...new Set(good.filter((r) => !r.data.clientId).map((r) => r.data.clientName))]
      if (newNames.length) {
        const { data: made, error } = await supabase.from('clients').insert(newNames.map((name) => ({ name }))).select('id,name')
        if (error) throw error
        made.forEach((c) => (idByName[c.name.trim().toLowerCase()] = c.id))
      }

      // 2) Filings
      const filingRows = []
      const assigneeRows = []
      const activityRows = []
      good.forEach((r) => {
        const id = crypto.randomUUID()
        filingRows.push({
          id,
          client_id: r.data.clientId || idByName[r.data.clientName.toLowerCase()],
          filing_type_id: r.data.typeId,
          period: r.data.period,
          due_date: r.data.due,
          reminder_days: r.data.days,
          channels: r.data.channels,
        })
        r.data.assigneeIds.forEach((uid) => assigneeRows.push({ filing_id: id, user_id: uid }))
        activityRows.push({ filing_id: id, user_id: s.session.user.id, action: 'created', note: 'Bulk import se bani' })
      })

      for (const part of chunk(filingRows, 200)) {
        const { error } = await supabase.from('filings').insert(part)
        if (error) throw error
      }
      for (const part of chunk(assigneeRows, 200)) {
        const { error } = await supabase.from('filing_assignees').insert(part)
        if (error) throw error
      }
      for (const part of chunk(activityRows, 200)) {
        await supabase.from('filing_activity').insert(part)
      }

      setMsg(`${filingRows.length} filings import ho gayi ✅` + (newNames.length ? ` (${newNames.length} naye client bhi bane)` : ''))
      setRaw([])
      setFileName('')
      await loadCtx()
    } catch (e) {
      setMsg('Error: ' + (e.message || e))
    } finally {
      setBusy(false)
    }
  }

    return (
    <div className="page">
      <PageHeader icon={Upload} title="Bulk Import" subtitle="Excel se bahut saari filings ek saath daalo" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 lg:col-span-2 space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--border)] rounded-xl p-8 cursor-pointer hover:border-[var(--accent)] transition text-center">
            <Upload size={28} className="text-[var(--accent)]" />
            <span className="font-semibold text-sm">{fileName || 'CSV file chuno'}</span>
            <span className="text-xs text-[var(--muted)]">Excel me File → Save As → CSV UTF-8, phir yahan upload karo</span>
            <input type="file" accept=".csv" className="hidden" onChange={onFile} />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={createClients} onChange={(e) => setCreateClients(e.target.checked)} />
            Jo clients system me nahi hain unhe apne aap bana do
          </label>
        </div>

        <div className="card p-5 text-sm space-y-3">
          <div className="font-semibold">Kaise karein?</div>
          <ol className="list-decimal ml-5 text-[var(--muted)] space-y-1">
            <li>Sample CSV download karo.</li>
            <li>Excel me apni filings bharo.</li>
            <li>CSV UTF-8 me save karke upload karo.</li>
            <li>Preview dekho, phir import dabao.</li>
          </ol>
          <button onClick={downloadTemplate} className="btn btn-outline"><Download size={16} /> Sample CSV</button>
          <ul className="text-xs text-[var(--muted)] list-disc ml-4 space-y-1">
            <li><b>client_name</b> aur <b>filing_type</b> system ke naam se match hone chahiye.</li>
            <li><b>due_date</b>: DD-MM-YYYY ya YYYY-MM-DD.</li>
            <li>Ek se zyada values semicolon se: <b>5;2;0</b>. Khali chhodo to default lagega.</li>
          </ul>
        </div>
      </div>

      {checked.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex gap-2 text-sm">
              <span className="badge badge-gray">Total {checked.length}</span>
              <span className="badge badge-green">{good.length} sahi</span>
              <span className="badge badge-red">{checked.length - good.length} galat</span>
            </div>
            <button disabled={busy || good.length === 0} onClick={doImport} className="btn btn-primary">
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? 'Import ho raha hai...' : `${good.length} sahi rows import karo`}
            </button>
          </div>

          <div className="card overflow-auto max-h-[28rem]">
            <table className="data-table">
              <thead>
                <tr><th>Row</th><th>Client</th><th>Filing</th><th>Period</th><th>Due</th><th>Status</th></tr>
              </thead>
              <tbody>
                {checked.map((r) => (
                  <tr key={r.n}>
                    <td>{r.n}</td>
                    <td>{r.data.clientName}{r.ok && !r.data.clientId ? <span className="badge badge-blue ml-2">naya</span> : null}</td>
                    <td>{r.data.typeName || '-'}</td>
                    <td>{r.data.period || '-'}</td>
                    <td>{r.data.due || '-'}</td>
                    <td>
                      {r.ok
                        ? <span className="badge badge-green">OK</span>
                        : <span className="text-xs text-red-400">{r.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {msg && <p className="text-sm mt-4">{msg}</p>}
    </div>
  )
}
