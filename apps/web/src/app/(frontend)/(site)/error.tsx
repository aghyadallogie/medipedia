'use client'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-slate-600 dark:text-slate-300">
        The page could not be loaded. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </div>
  )
}
