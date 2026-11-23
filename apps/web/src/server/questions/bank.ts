/**
 * The question bank: reading a question, picking the next one, and answering (AGENTS.md §6).
 *
 * All of it needs a signed-in user, which the route handlers check first. Reads that feed a GET
 * response go through the Local API with access checks ON, so Payload's field-level access strips
 * the answer key even if a serializer ever forgot to. Only `submitAnswer` reads the key, with
 * access overridden, and only to compute the verdict.
 */
import { randomInt } from 'node:crypto'

import {
  CHOICE_LABELS,
  IdSchema,
  type AnswerResult,
  type ChoiceLabel,
  type NextQuestion,
  type NextQuestionQuery,
  type Question as QuestionDto,
} from '@medipedia/shared'
import type { Payload, Where } from 'payload'

import type { Question, User } from '@/payload-types'
import { assertCanRead } from '@/server/access-tier'
import { ApiError } from '@/server/http'
import { idOf } from '@/server/ids'
import { getClient } from '@/server/payload'
import { listDomains, listTopics } from '@/server/public-queries'

import { correctLabelOf, hasChoice, toAnswerResult, toQuestion } from './serializers'

const PUBLISHED: Where = { _status: { equals: 'published' } }

/** Local API calls that check access need the user tagged with its collection. */
const asUser = (user: User) => ({ ...user, collection: 'users' as const })

// ---------- reading ----------

/** One published question without its answer key, or null (unknown, malformed or draft id). */
export async function getQuestion(user: User, id: string): Promise<QuestionDto | null> {
  if (!IdSchema.safeParse(id).success) return null
  const payload = await getClient()
  const { docs } = await payload.find({
    collection: 'questions',
    where: { and: [{ id: { equals: id } }, PUBLISHED] },
    limit: 1,
    depth: 1,
    draft: false,
    overrideAccess: false,
    user: asUser(user),
  })
  const doc = docs[0]
  if (!doc) return null
  assertCanRead(user, doc)
  return toQuestion(doc)
}

// ---------- the next question ----------

type Selection = { domainIds: string[] | null; topicIds: string[] | null }

/** Turns the slugs of a request into ids. A domain includes its sub-domains. */
async function resolveSelection(query: NextQuestionQuery): Promise<Selection> {
  const domainSlugs = query.domains ?? []
  const topicSlugs = query.topics ?? []
  let domainIds: string[] | null = null
  let topicIds: string[] | null = null

  if (domainSlugs.length > 0) {
    const all = await listDomains()
    const chosen = new Set(all.filter((d) => domainSlugs.includes(d.slug)).map((d) => d.id))
    domainIds = all
      .filter((d) => chosen.has(d.id) || (d.parentId !== null && chosen.has(d.parentId)))
      .map((d) => d.id)
  }
  if (topicSlugs.length > 0) {
    const all = await listTopics()
    topicIds = all.filter((t) => topicSlugs.includes(t.slug)).map((t) => t.id)
  }
  return { domainIds, topicIds }
}

async function matchingQuestionIds(payload: Payload, selection: Selection): Promise<string[]> {
  // A filter that names nothing that exists matches nothing (it must not fall back to "all").
  if (selection.domainIds?.length === 0 || selection.topicIds?.length === 0) return []

  const where: Where[] = [PUBLISHED]
  if (selection.domainIds) where.push({ domain: { in: selection.domainIds } })
  if (selection.topicIds) where.push({ topic: { in: selection.topicIds } })

  // Ids only. The pool is small (low thousands, AGENTS.md §15), so choosing in memory beats a
  // join, and it keeps the "unused" and "incorrect" filters to one more cheap query.
  const { docs } = await payload.find({
    collection: 'questions',
    where: { and: where },
    select: { updatedAt: true },
    pagination: false,
    depth: 0,
    draft: false,
    overrideAccess: true,
  })
  return docs.map((doc) => doc.id)
}

/** Ids of the questions that pass the learner's filter, given everything they have answered. */
async function applyFilter(
  payload: Payload,
  userId: string,
  filter: NextQuestionQuery['filter'],
  ids: string[],
): Promise<string[]> {
  if (filter === 'all' || ids.length === 0) return ids

  // Oldest first, so the last row seen for a question is the latest answer to it.
  const { docs } = await payload.find({
    collection: 'answer-events',
    where: { user: { equals: userId } },
    select: { question: true, isCorrect: true },
    sort: 'answeredAt',
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const latest = new Map<string, boolean>()
  for (const event of docs) {
    const questionId = idOf(event.question)
    if (questionId) latest.set(questionId, event.isCorrect)
  }

  return filter === 'unused'
    ? ids.filter((id) => !latest.has(id))
    : ids.filter((id) => latest.get(id) === false)
}

/** A random question that passes the filters, with how many there are to choose from. */
export async function nextQuestion(user: User, query: NextQuestionQuery): Promise<NextQuestion> {
  const payload = await getClient()
  const selection = await resolveSelection(query)
  const pool = await applyFilter(
    payload,
    user.id,
    query.filter,
    await matchingQuestionIds(payload, selection),
  )

  // A question can be unpublished or deleted between the two reads: try another one.
  const candidates = [...pool]
  while (candidates.length > 0) {
    const [picked] = candidates.splice(randomInt(candidates.length), 1)
    const question = picked ? await getQuestion(user, picked) : null
    if (question) return { question, remaining: pool.length }
  }
  return { question: null, remaining: 0 }
}

// ---------- answering ----------

async function priorAttempts(payload: Payload, userId: string, questionId: string) {
  const { totalDocs } = await payload.count({
    collection: 'answer-events',
    where: { and: [{ user: { equals: userId } }, { question: { equals: questionId } }] },
    overrideAccess: true,
  })
  return totalDocs
}

/**
 * Stores the answer. A learner's first answer to a question carries a unique key, so if two
 * submissions race, the database lets only one of them be "first" and the other is recorded as a
 * repeat instead of double-counting towards accuracy.
 */
async function recordAnswer(
  payload: Payload,
  args: {
    userId: string
    question: Question
    selectedLabel: ChoiceLabel
    isCorrect: boolean
  },
): Promise<{ isFirstAttempt: boolean }> {
  const { userId, question, selectedLabel, isCorrect } = args
  const base = {
    user: userId,
    question: question.id,
    selectedLabel,
    isCorrect,
    domain: idOf(question.domain),
    topic: idOf(question.topic),
  }
  const write = (isFirstAttempt: boolean) =>
    payload.create({
      collection: 'answer-events',
      data: {
        ...base,
        isFirstAttempt,
        firstAttemptKey: isFirstAttempt ? `${userId}:${question.id}` : null,
        answeredAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })

  if ((await priorAttempts(payload, userId, question.id)) === 0) {
    try {
      await write(true)
      return { isFirstAttempt: true }
    } catch (error) {
      // Lost the race for "first": someone else's row exists now. Anything else is a real error.
      if ((await priorAttempts(payload, userId, question.id)) === 0) throw error
    }
  }
  await write(false)
  return { isFirstAttempt: false }
}

/** Checks the learner's choice, records it, and returns the verdict with the explanations. */
export async function submitAnswer(
  user: User,
  questionId: string,
  selectedLabel: ChoiceLabel,
): Promise<AnswerResult> {
  const notFound = new ApiError('not_found', 'Question not found.')
  if (!IdSchema.safeParse(questionId).success) throw notFound

  const payload = await getClient()
  const { docs } = await payload.find({
    collection: 'questions',
    where: { and: [{ id: { equals: questionId } }, PUBLISHED] },
    limit: 1,
    depth: 0,
    draft: false,
    // The answer key is hidden from everyone but admins. Verifying an answer needs it.
    overrideAccess: true,
  })
  const question = docs[0]
  if (!question) throw notFound
  assertCanRead(user, question)

  if (!hasChoice(question, selectedLabel)) {
    throw new ApiError('validation_error', 'That choice does not exist for this question.', {
      allowed: CHOICE_LABELS.slice(0, question.choices?.length ?? 0),
    })
  }
  const correctLabel = correctLabelOf(question)
  if (!correctLabel) {
    // Validation guarantees exactly one correct choice, so this is corrupt data, not a bad request.
    throw new Error(`Question ${question.id} has no correct choice`)
  }

  const { isFirstAttempt } = await recordAnswer(payload, {
    userId: user.id,
    question,
    selectedLabel,
    isCorrect: selectedLabel === correctLabel,
  })
  return toAnswerResult(question, { selectedLabel, correctLabel, isFirstAttempt })
}
