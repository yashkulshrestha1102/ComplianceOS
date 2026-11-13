import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-6xl font-bold text-[var(--accent)]">404</div>
      <h1 className="text-xl font-semibold mt-3">Page not found</h1>
      <p className="text-sm text-[var(--muted)] mt-1">The link is incorrect or the page has been removed.</p>
      <Link href="/" className="btn btn-primary mt-6">Go to Dashboard</Link>
    </div>
  )
}