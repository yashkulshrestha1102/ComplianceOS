'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui'
import { FileText, FileImage, Upload, Download, Trash2, Loader2 } from 'lucide-react'

const BUCKET = 'filing-proofs'
const MAX = 10 * 1024 * 1024
const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
const DOC_TYPES = { arn: 'ARN / Acknowledgement', challan: 'Challan', other: 'Other' }

const sizeText = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')

export default function DocumentsModal({ filing, canEdit, onClose, onChanged }) {
  const [docs, setDocs] = useState(null)
  const [arn, setArn] = useState(filing.arn_number || '')
  const [docType, setDocType] = useState('arn')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  async function loadDocs() {
    const { data } = await supabase.from('filing_documents').select('*')
      .eq('filing_id', filing.id).order('created_at', { ascending: false })
    setDocs(data || [])
  }
  useEffect(() => { loadDocs() }, [filing.id])

  async function saveArn() {
    setErr(''); setMsg('')
    const { error } = await supabase.from('filings').update({ arn_number: arn.trim() }).eq('id', filing.id)
    if (error) return setErr(error.message)
    setMsg('ARN save ho gaya ✅')
    onChanged?.()
  }

  async function upload(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return
    setErr(''); setMsg(''); setBusy(true)

    const { data: s } = await supabase.auth.getSession()
    let ok = 0
    for (const file of files) {
      if (!ALLOWED.includes(file.type)) { setErr(`${file.name}: sirf PDF, PNG, JPG ya WEBP chalega`); continue }
      if (file.size > MAX) { setErr(`${file.name}: 10 MB se badi hai`); continue }

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${filing.id}/${crypto.randomUUID()}-${safe}`

      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
      if (up.error) { setErr(`${file.name}: ${up.error.message}`); continue }

      const ins = await supabase.from('filing_documents').insert({
        filing_id: filing.id, file_path: path, file_name: file.name, file_size: file.size,
        content_type: file.type, doc_type: docType, uploaded_by: s.session.user.id,
      })
      if (ins.error) {
        await supabase.storage.from(BUCKET).remove([path])
        setErr(`${file.name}: ${ins.error.message}`)
        continue
      }
      await supabase.from('filing_activity').insert({
        filing_id: filing.id, user_id: s.session.user.id, action: 'document_added', note: file.name,
      })
      ok++
    }
    if (ok) { setMsg(`${ok} file upload ho gayi ✅`); loadDocs(); onChanged?.() }
    setBusy(false)
  }

  async function openDoc(d) {
    const w = window.open('', '_blank') // popup block se bachne ke liye pehle khol lo
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.file_path, 60)
    if (error) { w?.close(); return setErr(error.message) }
    if (w) w.location.href = data.signedUrl
    else window.location.href = data.signedUrl
  }

  async function removeDoc(d) {
    if (!confirm(`"${d.file_name}" delete karein?`)) return
    setErr('')
    const { error } = await supabase.storage.from(BUCKET).remove([d.file_path])
    if (error) return setErr(error.message)
    await supabase.from('filing_documents').delete().eq('id', d.id)
    loadDocs()
    onChanged?.()
  }

  return (
    <Modal wide onClose={onClose} title={`Documents: ${filing.filing_types?.name} (${filing.clients?.name})`}>
      <div className="space-y-5">
        {/* ARN */}
        <div>
          <label className="label">ARN / Acknowledgement number</label>
          {canEdit ? (
            <div className="flex gap-2">
              <input className="flex-1" placeholder="jaise AA2711250012345" value={arn} onChange={(e) => setArn(e.target.value)} />
              <button className="btn btn-outline" onClick={saveArn}>Save</button>
            </div>
          ) : (
            <div className="text-sm">{filing.arn_number || '-'}</div>
          )}
        </div>

        {/* Upload */}
        {canEdit && (
          <div>
            <label className="label">Proof upload karo</label>
            <div className="flex flex-wrap gap-2 items-center">
              <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={upload} />
              <button className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} File chuno
              </button>
              <span className="text-xs text-[var(--muted)]">PDF / Image, max 10 MB, ek saath kai files chal jayengi</span>
            </div>
          </div>
        )}

        {msg && <p className="text-sm text-green-400">{msg}</p>}
        {err && <p className="text-sm text-red-400">{err}</p>}

        {/* List */}
        <div>
          <div className="label">Uploaded files</div>
          <div className="space-y-2">
            {docs === null && <div className="skeleton h-12" />}
            {docs && docs.length === 0 && <p className="text-sm text-[var(--muted)]">Abhi koi file nahi hai.</p>}
            {(docs || []).map((d) => (
              <div key={d.id} className="card p-3 flex items-center gap-3">
                {d.content_type === 'application/pdf'
                  ? <FileText size={22} className="text-red-400 shrink-0" />
                  : <FileImage size={22} className="text-sky-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.file_name}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {DOC_TYPES[d.doc_type]} · {sizeText(d.file_size || 0)} · {new Date(d.created_at).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <button className="icon-btn" title="Kholo / Download" onClick={() => openDoc(d)}><Download size={16} /></button>
                {canEdit && (
                  <button className="icon-btn" title="Delete" onClick={() => removeDoc(d)}>
                    <Trash2 size={16} className="text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}