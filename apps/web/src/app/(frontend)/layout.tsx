import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { publicEnv } from '@/env'

import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: 'Medipedia',
    template: '%s · Medipedia',
  },
  description: 'Lectures, flashcards, questions, papers and videos for medical learners.',
}

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  )
}
