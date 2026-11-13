'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Bell, CheckCheck } from 'lucide-react'

export default function Notifications() {
  const [list, setList] = useState([])

  async function load() {
    const { data } = await supabase.from('notifications').select('*')
      .order('created_at', { ascending: false }).limit(100)
    setList(data || [])
    window.dispatchEvent(new Event('notif-changed'))
  }
  useEffect(() => { load() }, [])

  async function markRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    load()
  }
  async function markAll() {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
    load()
  }

  return (
    <div className="px-8 pb-10 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button onClick={markAll} className="flex items-center gap-2 text-sm text-[var(--accent)]">
          <CheckCheck size={16} /> Mark all as read
        </button>
      </div>

      <div className="space-y-3">
        {list.map((n) => (
          <div key={n.id} onClick={() => !n.is_read && markRead(n.id)}
            className="card p-4 flex gap-3 cursor-pointer"
            style={n.is_read ? { opacity: 0.55 } : { borderColor: 'var(--accent)' }}>
            <Bell size={20} className="text-[var(--accent)] mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">{n.title}</div>
              <div className="text-sm text-[var(--muted)]">{n.message}</div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {new Date(n.created_at).toLocaleString('en-IN')}
              </div>
            </div>
            {!n.is_read && <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] mt-2" />}
          </div>
        ))}
        {list.length === 0 && <p className="text-[var(--muted)]">No notifications yet.</p>}
      </div>
    </div>
  )
}