'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function NotificationBell() {
  const [unread, setUnread] = useState(0)
  const [toasts, setToasts] = useState([])

  function showToast(n) {
    setToasts((t) => (t.some((x) => x.id === n.id) ? t : [...t, n]))
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 12000)
  }

    useEffect(() => {
    let cancelled = false
    let channel = null
    let uid = null

    const refresh = async () => {
      if (!uid) return
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('is_read', false)
      if (!cancelled) setUnread(count || 0)
    }

    async function init() {
      const { data } = await supabase.auth.getSession()
      if (cancelled || !data.session) return
      uid = data.session.user.id
      refresh()

      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }

      // Session me pehli baar: purane unread reminders popup me dikhao
      if (!sessionStorage.getItem('toasted')) {
        sessionStorage.setItem('toasted', '1')
        const { data: old } = await supabase
          .from('notifications').select('*')
          .eq('user_id', uid).eq('is_read', false)
          .order('created_at', { ascending: false }).limit(3)
        ;(old || []).forEach(showToast)
      }

      if (cancelled) return

      // Har baar naya unique naam, taaki purane channel se takraav na ho
      channel = supabase
        .channel(`notif-${uid}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
          (payload) => {
            const n = payload.new
            setUnread((u) => u + 1)
            showToast(n)
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(n.title, { body: n.message })
            }
          }
        )
        .subscribe()

      window.addEventListener('notif-changed', refresh)
    }
    init()

    return () => {
      cancelled = true
      window.removeEventListener('notif-changed', refresh)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return (
    <>
      <Link href="/notifications" className="relative p-2.5 card rounded-full">
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-[var(--accent)] text-xs rounded-full px-1.5">{unread}</span>
        )}
      </Link>

      {/* Popup toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-3 w-80">
        {toasts.map((t) => (
          <div key={t.id} className="card p-4 shadow-2xl flex gap-3"
            style={{ borderColor: 'var(--accent)', boxShadow: '0 0 25px var(--glow)' }}>
            <Bell size={20} className="text-[var(--accent)] shrink-0 mt-0.5" />
            <Link href="/notifications" className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{t.title}</div>
              <div className="text-xs text-[var(--muted)] mt-1">{t.message}</div>
            </Link>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              <X size={16} className="text-[var(--muted)]" />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}