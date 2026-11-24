import { HomeActions } from '@/components/home-actions'
import { Container, Section } from '@/components/site-chrome'
import { SITE_DESCRIPTION } from '@/lib/seo'

/** The one page everyone can see. It asks nothing of the server, so it is fully static. */
const FEATURES = [
  {
    title: 'Lectures',
    text: 'Curated, regularly reviewed lessons with sources you can check, organised by domain.',
  },
  {
    title: 'Flashcards',
    text: 'Spaced-repetition cards by topic. Your progress is saved in your browser.',
  },
  {
    title: 'Practice questions',
    text: 'Exam-style vignettes with an explanation for every choice, and your accuracy by domain.',
  },
  {
    title: 'Landmark papers',
    text: 'The studies that changed practice, with plain-language summaries and citation details.',
  },
  {
    title: 'Vetted videos',
    text: 'A catalogue of teaching videos that were reviewed before they were listed.',
  },
] as const

export default function HomePage() {
  return (
    <Container>
      <section className="space-y-5 pb-2 pt-10 sm:space-y-6 sm:pb-4 sm:pt-24">
        <h1 className="max-w-3xl text-[2rem] leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
          Learn medicine from sources you can check.
        </h1>
        <p className="max-w-2xl text-base text-slate-600 sm:text-lg dark:text-slate-300">
          {SITE_DESCRIPTION}
        </p>
        <HomeActions />
      </section>

      <Section title="What is inside">
        <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
            >
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{feature.text}</p>
            </li>
          ))}
        </ul>
      </Section>
    </Container>
  )
}
