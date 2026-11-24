import type { Metadata } from 'next'
import Link from 'next/link'

import { Bullets, ContactAddress, LegalPage, LegalSection } from '@/components/legal'
import { LEGAL_UPDATED } from '@/lib/legal'
import { SITE_NAME, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Terms of use',
  description: `The rules for using ${SITE_NAME}: educational use only, accounts, acceptable use and liability.`,
  path: '/terms',
})

const link = 'text-brand-700 underline underline-offset-2 dark:text-brand-300'

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated={LEGAL_UPDATED}
      intro={`By using ${SITE_NAME} you agree to these terms. They are short on purpose: please read them.`}
    >
      <LegalSection title="For education only, not medical advice">
        <p>
          {SITE_NAME} offers lectures, flashcards, practice questions, paper summaries and videos
          for people who are learning medicine. It is not medical advice, and it must not be used to
          diagnose or treat any patient, or to make decisions about anyone&apos;s care.
        </p>
        <p>
          Medicine changes, and a summary can be out of date or wrong. Always check current clinical
          guidelines, the original sources and your institution&apos;s protocols before acting on
          anything you read here. Practice questions are teaching tools: they are not a prediction
          of how you will do in any exam.
        </p>
      </LegalSection>

      <LegalSection title="Who can use it">
        <p>
          You must be at least 16 to create an account. You need an account to use {SITE_NAME}:
          without one you can see the home page, these terms and the privacy policy, and the pages
          for signing up and signing in. Lectures, flashcards, practice questions, papers and videos
          are for signed-in members.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <Bullets>
          <li>
            Give a real email address you can read. We use it to confirm your account and to let you
            reset your password.
          </li>
          <li>
            Keep your password to yourself. Anything done with your account is your responsibility
            until you tell us it was not you.
          </li>
          <li>One person, one account. Do not share logins or create accounts for other people.</li>
          <li>
            You can delete your account at any time from your{' '}
            <Link href="/account" className={link}>
              account page
            </Link>
            . That also deletes your answer history. See the{' '}
            <Link href="/privacy" className={link}>
              privacy policy
            </Link>
            .
          </li>
        </Bullets>
      </LegalSection>

      <LegalSection title="What you may and may not do">
        <p>You may use the site for your own learning. You may not:</p>
        <Bullets>
          <li>copy, scrape or republish the content in bulk, or resell it;</li>
          <li>
            share practice questions or their answers outside the site, for example by posting them;
          </li>
          <li>
            try to read answers before submitting them, or to get around the site&apos;s limits;
          </li>
          <li>attack, overload or probe the site or other people&apos;s accounts;</li>
          <li>use the site for anything unlawful.</li>
        </Bullets>
        <p>
          We may suspend or close an account that breaks these rules. Where we can, we will tell you
          why.
        </p>
      </LegalSection>

      <LegalSection title="The content">
        <p>
          The lectures, questions, flashcards, summaries and other material are written, reviewed
          and published by us and our authors, and are protected by copyright. Papers and videos
          belong to their authors and publishers: we link to them, and embedded videos are played by
          their own providers. You get a personal, non-transferable licence to read and study the
          content for your own learning.
        </p>
        <p>
          We work to keep the content accurate and current, and show when a page was last reviewed
          or updated, but we cannot promise that it is complete or free of mistakes. If you spot
          one, please tell us at <ContactAddress />.
        </p>
      </LegalSection>

      <LegalSection title="Availability and liability">
        <p>
          The site is provided as it is, without any promise that it will always be available,
          error-free or suitable for a particular purpose. Features and content can change or be
          removed.
        </p>
        <p>
          To the extent the law allows, we are not liable for loss or damage that comes from using
          the site or relying on its content, including any decision about patient care. Nothing in
          these terms limits liability that cannot lawfully be limited.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms. The date at the top shows the latest change. If a change
          matters to how you use the site, we will say so on the site or by email. Using the site
          after a change means you accept the new terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms: <ContactAddress />.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
