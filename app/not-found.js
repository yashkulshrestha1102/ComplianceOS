import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-6xl font-bold text-[var(--accent)]">404</div>
      <h1 className="text-xl font-semibold mt-3">Ye page nahi mila</h1>
      <p className="text-sm text-[var(--muted)] mt-1">Link galat hai ya page hata diya gaya hai.</p>
      <Link href="/" className="btn btn-primary mt-6">Dashboard par jao</Link>
    </div>
  )
}