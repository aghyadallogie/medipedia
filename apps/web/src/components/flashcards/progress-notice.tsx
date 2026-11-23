/** Flashcard progress is not synced anywhere in v1 (AGENTS.md §9), so say so wherever it matters. */
export function ProgressNotice({ className = '' }: { className?: string }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </svg>
      <span>
        Your progress is saved in this browser only. It does not follow you to other devices, and
        clearing this site&apos;s data in your browser erases it.
      </span>
    </p>
  )
}
