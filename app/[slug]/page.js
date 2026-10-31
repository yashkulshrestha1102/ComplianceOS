'use client'
import { usePathname } from 'next/navigation'

export default function ComingSoon() {
  const name = usePathname().replace('/', '')
  return (
    <div className="px-8 py-10">
      <div className="card p-10 text-center">
        <h1 className="text-2xl font-bold capitalize">{name}</h1>
        <p className="text-[var(--muted)] mt-2">Ye page aage ke steps me banega. 🚧</p>
      </div>
    </div>
  )
}