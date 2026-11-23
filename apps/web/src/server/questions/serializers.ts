/**
 * Question documents -> DTOs. These are explicit allow-lists: nothing is copied by spreading, so a
 * field added to the collection later cannot leak into a response by accident.
 *
 * `toQuestion` is what a learner sees before answering and never touches `isCorrect`, the
 * explanations or the citations. `toAnswerResult` is the only place the answer key is read.
 */
import {
  CHOICE_LABELS,
  type AnswerResult,
  type ChoiceLabel,
  type Question as QuestionDto,
  type QuestionChoice,
} from '@medipedia/shared'

import type { Question } from '@/payload-types'
import { lexicalToRichText } from '@/server/richtext'
import { populated, require_, toDomainRef, toTopicRef } from '@/server/serializers'

type ChoiceRow = NonNullable<Question['choices']>[number]

/** Labels are assigned by position when a row has none, so a response never has a gap. */
function labelAt(index: number, row: ChoiceRow): ChoiceLabel {
  const stored = CHOICE_LABELS.find((label) => label === row.label)
  return stored ?? CHOICE_LABELS[index] ?? CHOICE_LABELS[CHOICE_LABELS.length - 1]!
}

const choicesOf = (doc: Pick<Question, 'choices'>): ChoiceRow[] => doc.choices ?? []

export function toQuestion(doc: Question): QuestionDto {
  const topic = require_(populated(doc.topic), 'question.topic')
  const domain = require_(populated(doc.domain), 'question.domain')
  const choices: QuestionChoice[] = choicesOf(doc).map((row, index) => ({
    label: labelAt(index, row),
    text: row.text,
  }))
  return {
    id: doc.id,
    vignette: lexicalToRichText(doc.vignette),
    stem: doc.stem,
    choices,
    topic: toTopicRef(topic),
    domain: toDomainRef(domain),
    difficulty: doc.difficulty,
    accessTier: doc.accessTier,
    updatedAt: doc.updatedAt,
  }
}

/** The label of the one choice marked correct, or null if the data is broken. */
export function correctLabelOf(doc: Pick<Question, 'choices'>): ChoiceLabel | null {
  const rows = choicesOf(doc)
  const index = rows.findIndex((row) => row.isCorrect === true)
  const row = rows[index]
  return row ? labelAt(index, row) : null
}

/** Whether `label` names one of the question's choices. */
export const hasChoice = (doc: Pick<Question, 'choices'>, label: ChoiceLabel): boolean =>
  choicesOf(doc).some((row, index) => labelAt(index, row) === label)

export function toAnswerResult(
  doc: Question,
  answer: { selectedLabel: ChoiceLabel; correctLabel: ChoiceLabel; isFirstAttempt: boolean },
): AnswerResult {
  return {
    questionId: doc.id,
    selectedLabel: answer.selectedLabel,
    correctLabel: answer.correctLabel,
    isCorrect: answer.selectedLabel === answer.correctLabel,
    isFirstAttempt: answer.isFirstAttempt,
    choices: choicesOf(doc).map((row, index) => ({
      label: labelAt(index, row),
      isCorrect: row.isCorrect === true,
      explanation: lexicalToRichText(row.explanation),
    })),
    overallExplanation: lexicalToRichText(doc.overallExplanation),
    citations: (doc.citations ?? []).map(({ label, url }) => ({ label, url })),
  }
}
