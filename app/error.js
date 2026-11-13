'use client'

export default function ErrorPage({ error, reset }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-xl font-semibold mt-3">Something went wrong</h1>
      <p className="text-sm text-[var(--muted)] mt-1 max-w-md">
        The page could not load. Please try again, or contact your admin if the issue persists.
      </p>
      {error?.digest && <p className="text-xs text-[var(--muted)] mt-2">Code: {error.digest}</p>}
      <button onClick={reset} className="btn btn-primary mt-6">Try again</button>
    </div>
  )
}