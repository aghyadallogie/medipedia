import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { JsonLd } from '@/components/json-ld'
import { publicEnv } from '@/env'
import { SITE_DESCRIPTION, SITE_NAME, websiteJsonLd } from '@/lib/seo'

import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${SITE_NAME}: medical learning, with sources`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, type: 'website' },
}

// Colours the browser chrome on phones and lets native controls and scrollbars follow dark mode.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
  colorScheme: 'light dark',
}

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <div aria-hidden="true" className="site-backdrop" />
        {children}
        <JsonLd data={websiteJsonLd()} />
      </body>
    </html>
  )
}
