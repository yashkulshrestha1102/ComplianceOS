'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Briefcase, Clock, AlertTriangle, CheckCircle2, Paperclip, Hourglass } from 'lucide-react'
import { PageHeader, EmptyState, Skeleton, StatusBadge } from '@/components/ui'
import DocumentsModal from '@/components/DocumentsModal'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const todayStr = () => new Date().toLocaleDateString('en-CA')
const fmt = (d) => { const [y, m, dd] = d.split('-'); return `${+dd} ${MONTHS[+m - 1]} ${y}` }
const daysLeft = (d) => Math.round((new Date(d) - new Date(todayStr())) / 86400000)
const shownStatus = (f) => (f.status !== 'filed' && f.due_date < todayStr() ? 'overdue' : f.status)

function Card({ icon: Icon, value, label, color }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '26' }}>
        <Icon size={24} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-[var(--muted)]">{label}</div>
      </div>
    </div>
  )
}

function DueCell({ f }) {
  if (f.status === 'filed') {
    return (
      <div>
        <div>{fmt(f.due_date)}</div>
        <div className="text-xs text-green-400">Filed{f.filed_on ? ` on ${fmt(f.filed_on)}` : ''}</div>
      </div>
    )
  }
  const d = daysLeft(f.due_date)
  const cls = d < 0 ? 'text-red-400' : d <= 7 ? 'text-amber-400' : 'text-[var(--muted)]'
  const text = d < 0 ? `${-d} din se overdue` : d === 0 ? 'Aaj due hai' : `${d} din baaki`
  return (
    <div>
      <div>{fmt(f.due_date)}</div>
      <div className={`text-xs font-medium ${cls}`}>{text}</div>
    </div>
  )
}

export default function Portal() {
  const [me, setMe] = useState(null)
  const [company, setCompany] = useState('')
  const [filings, setFilings] = useState(null)
  const [docFiling, setDocFiling] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.auth.getSession()
      if (!s.session) return
      const { data: p } = await supabase.from('profiles')
        .select('full_name, role, client_id').eq('id', s.session.user.id).single()
      setMe(p || {})
      if (p?.role !== 'client' || !p?.client_id) { setFilings([]); return }

      const { data: c } = await supabase.from('clients').select('name').eq('id', p.client_id).single()
      setCompany(c?.name || '')
      const { data } = await supabase.from('portal_filings').select('*').order('due_date')
      setFilings(data || [])
    }
    load()
  }, [])

  if (me && me.role !== 'client') {
    return (
      <div className="page">
        <PageHeader icon={Briefcase} title="Client Portal" />
        <div className="card"><EmptyState title="Ye page client accounts ke liye hai"
          text="Admin aur staff apne Dashboard aur Filings pages use karein." /></div>
      </div>
    )
  }

  if (me && me.role === 'client' && !me.client_id) {
    return (
      <div className="page">
        <PageHeader icon={Briefcase} title="Client Portal" />
        <div className="card"><EmptyState title="Account abhi kisi company se jodha nahi hai"
          text="Apne compliance manager se kaho ki wo aapka account company ke saath link kar de." /></div>
      </div>
    )
  }

  const all = filings || []
  const open = all.filter((f) => f.status !== 'filed')
  const overdue = open.filter((f) => daysLeft(f.due_date) < 0)
  const soon = open.filter((f) => daysLeft(f.due_date) >= 0 && daysLeft(f.due_date) <= 7)
  const filed = all.filter((f) => f.status === 'filed')
  const pending = open.length - overdue.length

  return (
    <div className="page">
      <PageHeader icon={Briefcase} title={company || 'Client Portal'}
        subtitle={me?.full_name ? `Namaste ${me.full_name}, ye aapki compliance filings ki sthiti hai` : 'Aapki compliance filings ki sthiti'} />

      {filings === null ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}</div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <Card icon={Hourglass} value={pending} label="Pending" color="#facc15" />
            <Card icon={Clock} value={soon.length} label="7 din ke andar due" color="#fb923c" />
            <Card icon={AlertTriangle} value={overdue.length} label="Overdue" color="#ef4444" />
            <Card icon={CheckCircle2} value={filed.length} label="Filed" color="#22c55e" />
          </div>

          <div className="card overflow-x-auto">
            {all.length === 0 ? (
              <EmptyState title="Abhi koi filing nahi hai" text="Jaise hi aapki koi filing add hogi, yahan dikhegi." />
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Filing</th><th>Due date</th><th>Status</th><th>ARN</th><th>Documents</th></tr>
                </thead>
                <tbody>
                  {all.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <div className="font-semibold">{f.filing_type}</div>
                        <div className="text-xs text-[var(--muted)]">{f.period || '-'}</div>
                      </td>
                      <td><DueCell f={f} /></td>
                      <td><StatusBadge status={shownStatus(f)} /></td>
                      <td className="text-sm">{f.arn_number || '-'}</td>
                      <td>
                        {Number(f.doc_count) > 0 ? (
                          <button className="btn btn-outline" style={{ padding: '0.3rem 0.7rem' }}
                            onClick={() => setDocFiling({
                              id: f.id, arn_number: f.arn_number,
                              filing_types: { name: f.filing_type }, clients: { name: company },
                            })}>
                            <Paperclip size={14} /> {f.doc_count} file
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {docFiling && <DocumentsModal filing={docFiling} canEdit={false} onClose={() => setDocFiling(null)} />}
    </div>
  )
}