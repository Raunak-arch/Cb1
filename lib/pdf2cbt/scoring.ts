import type { Answer, Question, QuestionType, SectionScheme } from './types'

/** Response captured for a question during a test run. */
export interface Response {
  single?: Answer
  multiple?: Answer[]
  numerical?: string
}

/** Ready-made section marking schemes offered in the slicing dashboard. */
export const SECTION_PRESETS: SectionScheme[] = [
  { id: 'single-4-1', name: 'Single Correct (+4, −1)', type: 'single', correct: 4, wrong: -1 },
  { id: 'single-3-1', name: 'Single Correct (+3, −1)', type: 'single', correct: 3, wrong: -1 },
  { id: 'multiple-4-2', name: 'Multiple Correct — JEE Adv (+4, partial +1, −2)', type: 'multiple', correct: 4, wrong: -2, partial: 1 },
  { id: 'multiple-4-1', name: 'Multiple Correct (+4, partial +1, −1)', type: 'multiple', correct: 4, wrong: -1, partial: 1 },
  { id: 'numerical-4-1', name: 'Numerical (+4, −1)', type: 'numerical', correct: 4, wrong: -1 },
  { id: 'numerical-3-0', name: 'Comprehension / Numerical (+3, 0)', type: 'numerical', correct: 3, wrong: 0 },
]

export const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics'] as const

/** Per-subject marker colours used across the slicing dashboard. */
export const SUBJECT_COLORS: Record<string, string> = {
  Physics: '#2563eb',
  Chemistry: '#16845b',
  Mathematics: '#d97706',
}

export const SECTION_COLOR = '#be123c'

export function subjectColor(subject: string) {
  return SUBJECT_COLORS[subject] ?? '#475569'
}

/** Fills in defaults so tests created before sections/types still grade correctly. */
export function normalizeQuestion(q: Question): Question {
  return {
    ...q,
    type: q.type ?? 'single',
    marks: q.marks ?? { correct: 1, wrong: 0 },
  }
}

function numericEqual(a: string | undefined, b: string | undefined) {
  if (a == null || b == null) return false
  const an = Number.parseFloat(a.trim())
  const bn = Number.parseFloat(b.trim())
  if (Number.isFinite(an) && Number.isFinite(bn)) return Math.abs(an - bn) < 1e-6
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export interface Grade {
  marks: number
  correct: boolean
  answered: boolean
}

/** Grades a single response against a question's marking scheme. */
export function gradeQuestion(question: Question, response: Response | undefined): Grade {
  const q = normalizeQuestion(question)
  const resp = response ?? {}
  const { correct, wrong, partial } = q.marks ?? { correct: 1, wrong: 0 }

  if (q.type === 'numerical') {
    const answered = !!resp.numerical?.trim()
    if (!answered) return { marks: 0, correct: false, answered: false }
    const ok = numericEqual(resp.numerical, q.correctNumerical)
    return { marks: ok ? correct : wrong, correct: ok, answered: true }
  }

  if (q.type === 'multiple') {
    const chosen = resp.multiple ?? []
    if (!chosen.length) return { marks: 0, correct: false, answered: false }
    const key = q.correctAnswers ?? []
    const hasWrong = chosen.some(o => !key.includes(o))
    if (hasWrong) return { marks: wrong, correct: false, answered: true }
    const full = chosen.length === key.length
    if (full) return { marks: correct, correct: true, answered: true }
    return { marks: (partial ?? 0) * chosen.length, correct: false, answered: true }
  }

  // single
  const answered = !!resp.single
  if (!answered) return { marks: 0, correct: false, answered: false }
  const ok = resp.single === q.correctAnswer
  return { marks: ok ? correct : wrong, correct: ok, answered: true }
}

/** Maximum marks achievable on a question. */
export function maxMarks(question: Question) {
  return normalizeQuestion(question).marks?.correct ?? 1
}

/** Human-readable correct answer for review screens. */
export function formatCorrectAnswer(question: Question) {
  const q = normalizeQuestion(question)
  if (q.type === 'numerical') return q.correctNumerical ?? '—'
  if (q.type === 'multiple') return (q.correctAnswers ?? []).join(', ') || '—'
  return q.correctAnswer ?? '—'
}

/** Human-readable given answer for review screens. */
export function formatResponse(type: QuestionType, metric: { answer?: Answer; answers?: Answer[]; numerical?: string }) {
  if (type === 'numerical') return metric.numerical?.trim() || 'Not answered'
  if (type === 'multiple') return metric.answers?.length ? metric.answers.join(', ') : 'Not answered'
  return metric.answer || 'Not answered'
}
