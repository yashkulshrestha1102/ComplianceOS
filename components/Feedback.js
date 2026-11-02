'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { Modal } from '@/components/ui'

const emit = (name, detail) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }))
}

export const toast = {
  success: (message) => emit('app:toast', { type: 'success', message }),
  error: (message) => emit('app:toast', { type: 'error', message }),
}

export function confirmDialog({ title = 'Pakka?', message = '', confirmText = 'Haan, karo', danger = false } = {}) {
  return new Promise((resolve) => emit('app:confirm', { title, message, confirmText, danger, resolve }))
}

export default function Feedback() {
  const [toasts, setToasts] = useState([])
  const [dlg, setDlg] = useState(null)

  useEffect(() => {
    const onToast = (e) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((t) => [...t, { id, ...e.detail }])
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
    }
    const onConfirm = (e) => setDlg(e.detail)
    window.addEventListener('app:toast', onToast)
    window.addEventListener('app:confirm', onConfirm)
    return () => {
      window.removeEventListener('app:toast', onToast)
      window.removeEventListener('app:confirm', onConfirm)
    }
  }, [])

  const close = (value) => {
    dlg?.resolve(value)
    setDlg(null)
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[60] space-y-2 w-80 max-w-[92vw]">
        {toasts.map((t) => (
          <div key={t.id} className="card p-3 flex items-start gap-3 shadow-2xl"
            style={{ borderColor: t.type === 'error' ? '#ef4444' : '#22c55e' }}>
            {t.type === 'error'
              ? <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              : <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />}
            <div className="flex-1 text-sm">{t.message}</div>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              <X size={14} className="text-[var(--muted)]" />
            </button>
          </div>
        ))}
      </div>

      {dlg && (
        <Modal title={dlg.title} onClose={() => close(false)}>
          {dlg.message && <p className="text-sm text-[var(--muted)] mb-5 whitespace-pre-line">{dlg.message}</p>}
          <div className="flex justify-end gap-3">
            <button className="btn btn-outline" onClick={() => close(false)}>Cancel</button>
            <button className={`btn ${dlg.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
              {dlg.confirmText}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}