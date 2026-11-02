'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Activity, Play, Loader2 } from 'lucide-react'
import { toast, confirmDialog } from '@/components/Feedback'

export default function SystemStatus() {
  const [role, setRole] = useState(null)
  const [runs, setRuns] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data: s } = await supabase.auth.getSession()
    if (!s.session) return
    const { data: me } = await supabase.from('profiles').select('role').eq('id', s.session.user.id).single()
    setRole(me?.role || '')
    if (me?.role !== 'admin') return
    const { data } = await supabase.from('cron_runs').select('*').order('ran_at', { ascending: false }).limit(6)
    setRuns(data || [])
  }
  useEffect(() => { load() }, [])

  if (role !== 'admin') return null

  async function run(force) {
    if (force) {
      const ok = await confirmDialog({
        title: 'Test mode chalayein?',
        message: 'Isse duplicate-check bypass hota hai, to jin filings ka reminder pehle ja chuka hai unka dobara chala jayega.',
        confirmText: 'Haan, chalao', danger: true,
      })
      if (!ok) return
    }
    setBusy(true)
    const { data: s } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/run-reminders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.session.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ force }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return toast.error(json.error || 'Engine nahi chala')
    toast.success(`Ho gaya: ${json.reminders_sent} reminder, ${json.escalations_sent} escalation, ${json.errors} error`)
    load()
  }

  const last = runs?.[0]
  const stale = !last || Date.now() - new Date(last.ran_at).getTime() > 36 * 3600 * 1000

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2"><Activity size={18} className="text-[var(--accent)]" /> System (reminder engine)</h2>
        {stale ? <span className="badge badge-red">36 ghante se nahi chala</span> : <span className="badge badge-green">Theek chal raha hai</span>}
      </div>

      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={() => run(false)} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Engine abhi chalao
        </button>
        <button className="btn btn-outline" onClick={() => run(true)} disabled={busy}>Test mode</button>
      </div>

      {runs === null ? null : runs.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Abhi tak koi run nahi hua. Vercel ka cron roz subah chalayega.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Kab</th><th>Kaise</th><th>Nayi filings</th><th>Reminder</th><th>Escalation</th><th>Error</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{new Date(r.ran_at).toLocaleString('en-IN')}</td>
                  <td>{r.trigger}</td>
                  <td>{r.generated}</td>
                  <td>{r.reminders_sent}</td>
                  <td>{r.escalations_sent}</td>
                  <td className={r.errors ? 'text-red-400' : ''} title={r.error_samples || ''}>{r.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}