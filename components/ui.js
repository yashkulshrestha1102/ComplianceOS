'use client'
import { useEffect } from 'react'
import { Inbox, X } from 'lucide-react'

export function PageHeader({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6 pt-2">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {Icon && <Icon size={24} className="text-[var(--accent)]" />} {title}
        </h1>
        {subtitle && <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--accent-soft)' }}>
        <Inbox size={26} className="text-[var(--accent)]" />
      </div>
      <div className="font-semibold">{title}</div>
      {text && <p className="text-sm text-[var(--muted)] mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />
}

const STATUS = {
  pending: ['badge-yellow', 'Pending'],
  in_progress: ['badge-blue', 'In progress'],
  filed: ['badge-green', 'Filed'],
  overdue: ['badge-red', 'Overdue'],
}
export function StatusBadge({ status }) {
  const [cls, label] = STATUS[status] || ['badge-gray', status]
  return <span className={`badge ${cls}`}>{label}</span>
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`card w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto p-6`}
        style={{ background: 'var(--panel)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}