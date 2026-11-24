import type { Metadata } from 'next'
import Link from 'next/link'

import { Bullets, ContactAddress, LegalPage, LegalSection } from '@/components/legal'
import { LEGAL_UPDATED } from '@/lib/legal'
import { SITE_NAME, pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Privacy policy',
  description: `What ${SITE_NAME} stores about you, why, who helps us run it, and how to delete it.`,
  path: '/privacy',
})

const link = 'text-brand-700 underline underline-offset-2 dark:text-brand-300'

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated={LEGAL_UPDATED}
      intro={`What ${SITE_NAME} stores about you, why, who helps us run it, and how to delete it.`}
    >
      <LegalSection title="The short version">
        <Bullets>
          <li>
            You need an account to use the site beyond its home page and these legal pages. With an
            account we keep your email, your name and the answers you give to practice questions.
          </li>
          <li>
            Visitors without an account leave no profile with us (our host&apos;s server logs aside,
            see below).
          </li>
          <li>Your flashcard progress stays in your own browser. It is never sent to us.</li>
          <li>We do not sell your data, show ads or use advertising trackers.</li>
          <li>You can delete your account, and your answer history with it, whenever you like.</li>
        </Bullets>
      </LegalSection>

      <LegalSection title="What we store">
        <p>
          <strong className="font-semibold">Your account.</strong> Your email address, your name,
          how you sign in (email and password, or Google), and whether you have confirmed your
          email. A password is stored only as a salted hash, so nobody at {SITE_NAME} can read it.
          If you sign in with Google we receive your email address, your name and Google&apos;s
          identifier for your account, and nothing else from your Google account.
        </p>
        <p>
          <strong className="font-semibold">Your practice answers.</strong> For every practice
          question you answer: which question, which choice you picked, whether it was right,
          whether it was your first try, its domain and topic, and when. We use this to show you
          your own results by domain. We do not compare you with other learners.
        </p>
        <p>
          <strong className="font-semibold">Your sessions.</strong> To keep you signed in we store a
          fingerprint (a hash) of your session token, which sign-in it belongs to, when it expires
          and, for the mobile app, an optional device name.
        </p>
        <p>
          <strong className="font-semibold">Technical logs.</strong> Our hosting provider records
          requests to the site, including IP addresses and browser details, for security and to keep
          the service running. We do not use these logs to profile anyone.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and browser storage">
        <p>
          We use only what the site needs to work. We do not use analytics or advertising cookies,
          so there is no cookie banner to dismiss.
        </p>
        <Bullets>
          <li>
            <strong className="font-semibold">Sign-in cookies</strong> (<code>access_token</code>,{' '}
            <code>refresh_token</code>): keep you signed in. They are not readable by scripts on the
            page. The access token lasts 15 minutes, and the refresh token 7 days.
          </li>
          <li>
            <strong className="font-semibold">A hint cookie</strong> (<code>signed_in</code>): holds
            no secret. It lets the header show &quot;Account&quot; or &quot;Sign in&quot; without a
            request, and tells the site that your session can be renewed when it has expired.
          </li>
          <li>
            <strong className="font-semibold">A short-lived Google sign-in cookie</strong>: set for
            up to 10 minutes while you sign in with Google, to protect that exchange.
          </li>
          <li>
            <strong className="font-semibold">Flashcard progress</strong>: saved in your
            browser&apos;s own storage (IndexedDB) on this device. It never reaches our servers,
            does not follow you to other devices, and clearing this site&apos;s data in your browser
            erases it.
          </li>
        </Bullets>
      </LegalSection>

      <LegalSection title="Why we use it">
        <Bullets>
          <li>
            To create your account, keep you signed in and let you reset a forgotten password.
          </li>
          <li>To run the question bank and show you your own results.</li>
          <li>To keep the service secure and to find and fix faults.</li>
        </Bullets>
        <p>We do not use your data for anything else, and we do not sell it.</p>
      </LegalSection>

      <LegalSection title="Who helps us run the site">
        <p>
          These providers handle data on our behalf, only to run the service. Each has its own
          privacy terms.
        </p>
        <Bullets>
          <li>Vercel: hosts the site and stores uploaded images.</li>
          <li>Neon: hosts the database that holds accounts and answers.</li>
          <li>Resend: sends the confirmation and password-reset emails.</li>
          <li>Google: only if you choose to sign in with Google.</li>
        </Bullets>
        <p>
          Some of these providers are based outside your country, so your data may be processed
          elsewhere. We share data with nobody else unless the law requires it.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          We keep your account and answer history until you delete your account. Sessions expire by
          themselves after at most 7 days on the web and 30 days in the mobile app. Provider logs
          are kept for the periods those providers set.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <Bullets>
          <li>
            <strong className="font-semibold">Delete everything.</strong> On your{' '}
            <Link href="/account" className={link}>
              account page
            </Link>{' '}
            you can delete your account. That removes your account, your answer history and your
            sessions. If you signed up with a password you will be asked to confirm it.
          </li>
          <li>
            <strong className="font-semibold">See or fix your details.</strong> Your name can be
            changed on the account page. For a copy of your data, or a correction to your email
            address, write to <ContactAddress />.
          </li>
          <li>
            <strong className="font-semibold">Your rights under the law.</strong> Depending on where
            you live you may also have the right to object to or restrict how we use your data, and
            to complain to your data protection authority. Write to <ContactAddress /> and we will
            help.
          </li>
        </Bullets>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          {SITE_NAME} is not meant for anyone under 16, and we do not knowingly collect their data.
          If you think a child has made an account, tell us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We will update this policy when how we handle data changes. The date at the top shows the
          latest edit, and we will tell you on the site or by email about changes that matter. See
          also our{' '}
          <Link href="/terms" className={link}>
            terms of use
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Privacy questions and requests: <ContactAddress />.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
