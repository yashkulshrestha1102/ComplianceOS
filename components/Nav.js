'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session && pathname !== '/login') router.push('/login')
      else setEmail(data.session?.user.email || '')
    })
  }, [pathname, router])

  if (pathname === '/login') return null

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const link = (href, label) => (
    <Link href={href} className={`px-3 py-1 rounded ${pathname === href ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}>
      {label}
    </Link>
  )

  return (
    <nav className="flex items-center justify-between bg-white border-b px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="font-bold mr-4">Compliance Tracker</span>
        {link('/', 'Dashboard')}
        {link('/clients', 'Clients')}
        {link('/filings', 'Filings')}
      </div>
      <div className="text-sm">
        {email} <button onClick={logout} className="ml-3 text-red-600 underline">Logout</button>
      </div>
    </nav>
  )
}