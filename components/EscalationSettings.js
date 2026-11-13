'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, Loader2 } from 'lucide-react'

const CHANNELS = [['email', 'Email'], ['push', 'Popup'], ['telegram', 'Telegram']]

export default function EscalationSettings() {
  const [role, setRole] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [daysText, setDaysText] = useState('')
  const [people, setPeople] = useState([])
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.auth.getSession()
      if (!s.session) return
      const { data: me } = await supabase.from('profiles').select('role').eq('id', s.session.user.id).single()
      setRole(me?.role || '')
      if (me?.role !== 'admin') return
      const { data: c } = await supabase.from('app_settings').select('*').eq('id', 1).single()
      const { data: p } = await supabase.from('profiles').select('id, full_name, role').neq('role', 'client')
      setCfg(c)
      setDaysText((c?.escalation_days || []).join(','))
      setPeople(p || [])
    }
    load()
  }, [])

  if (role !== 'admin' || !cfg) return null

  const toggle = (key, value) => {
    const list = cfg[key] || []
    setCfg({ ...cfg, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }

  async function save() {
    setMsg('')
    const days = [...new Set(daysText.split(',').map((x) => parseInt(x.trim())).filter((n) => n > 0))].sort((a, b) => a - b)
    if (cfg.escalation_enabled && days.length === 0) return setMsg('Enter at least one day, e.g., 1,3,7')
    setSaving(true)
    const { error } = await supabase.from('app_settings').update({
      escalation_enabled: cfg.escalation_enabled,
      escalation_days: days,
      escalation_channels: cfg.escalation_channels,
      escalate_to_admins: cfg.escalate_to_admins,
      escalation_user_ids: cfg.escalation_user_ids,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setSaving(false)
    setDaysText(days.join(','))
    setMsg(error ? error.message : 'Escalation rules saved ✅')
  }

  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-semibold flex items-center gap-2">
        <AlertTriangle size={18} className="text-amber-400" /> Escalation rules (alert seniors on overdue)
      </h2>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.escalation_enabled}
          onChange={(e) => setCfg({ ...cfg, escalation_enabled: e.target.checked })} />
        Enable escalation
      </label>

      <div>
        <label className="label">Alert after how many days overdue? (comma-separated)</label>
        <input className="w-full" value={daysText} onChange={(e) => setDaysText(e.target.value)} placeholder="1,3,7" />
        <p className="text-xs text-[var(--muted)] mt-1">
          e.g., 1,3,7 = 1st, 3rd, and 7th day after the due date. Each level fires only once.v
        </p>
      </div>

      <div>
        <label className="label">Where should the alert be sent?</label>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map(([id, label]) => (
            <label key={id} className="flex items-center gap-2 card px-3 py-2 text-sm cursor-pointer">
              <input type="checkbox" checked={(cfg.escalation_channels || []).includes(id)} onChange={() => toggle('escalation_channels', id)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Who should receive the alert?</label>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 card px-3 py-2 text-sm cursor-pointer">
            <input type="checkbox" checked={cfg.escalate_to_admins}
              onChange={(e) => setCfg({ ...cfg, escalate_to_admins: e.target.checked })} />
            All admins
          </label>
          {people.filter((p) => p.role !== 'admin').map((p) => (
            <label key={p.id} className="flex items-center gap-2 card px-3 py-2 text-sm cursor-pointer">
              <input type="checkbox" checked={(cfg.escalation_user_ids || []).includes(p.id)} onChange={() => toggle('escalation_user_ids', p.id)} />
              {p.full_name || p.id.slice(0, 6)}
            </label>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn btn-primary">
        {saving && <Loader2 size={16} className="animate-spin" />} Save
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  )
}