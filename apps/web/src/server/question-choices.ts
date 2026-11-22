import { CHOICE_LABELS, QUESTION_CHOICES } from '@medipedia/shared'

type ChoiceRow = { label?: unknown; text?: unknown; isCorrect?: unknown }

/** Labels are positional (A, B, C, ...), never typed by an editor. */
export function assignChoiceLabels<T extends object>(
  choices: readonly T[],
): Array<T & { label: (typeof CHOICE_LABELS)[number] }> {
  return choices.map((choice, index) => ({
    ...choice,
    label: CHOICE_LABELS[index] ?? CHOICE_LABELS[CHOICE_LABELS.length - 1]!,
  }))
}

/** Field validator for `choices`: 2 to 6 rows and exactly one correct answer. Returns true or a message. */
export function validateChoices(value: unknown): true | string {
  if (!Array.isArray(value)) return 'Add at least two answer choices.'
  const rows = value as ChoiceRow[]
  if (rows.length < QUESTION_CHOICES.min) {
    return `Add at least ${QUESTION_CHOICES.min} answer choices.`
  }
  if (rows.length > QUESTION_CHOICES.max) {
    return `Use at most ${QUESTION_CHOICES.max} answer choices.`
  }
  const correct = rows.filter((row) => row.isCorrect === true).length
  if (correct !== 1) {
    return `Exactly one choice must be marked correct (found ${correct}).`
  }
  return true
}
