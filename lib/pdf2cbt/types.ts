export type Answer = 'A' | 'B' | 'C' | 'D'
export type TestTheme = 'classic' | 'soft'
export type View = 'dashboard' | 'builder' | 'quick' | 'runner' | 'results' | 'mistakes' | 'mistake-reports'
export type QuestionType = 'single' | 'multiple' | 'numerical'
export type MistakeCategory = 'Conceptual' | 'Calculation Error' | 'Question Interpretation' | 'Time'

/** Marks configuration for a question or section. */
export interface Marks {
  correct: number
  wrong: number
  partial?: number
}

/** A named section scheme template (e.g. "Single Correct +4, -1"). */
export interface SectionScheme {
  id: string
  name: string
  type: QuestionType
  correct: number
  wrong: number
  partial?: number
}

export interface Question {
  id: string
  subject: string
  type?: QuestionType
  marks?: Marks
  prompt?: string
  questionImage?: string
  options: Partial<Record<Answer, string>>
  optionText?: Partial<Record<Answer, string>>
  /** For single-correct questions */
  correctAnswer?: Answer
  /** For multiple-correct questions */
  correctAnswers?: Answer[]
  /** For numerical questions */
  correctNumerical?: string
  solution?: string
}

export interface Test {
  id: string
  title: string
  durationMinutes: number
  theme: TestTheme
  questions: Question[]
  createdAt: number
}

export interface QuestionMetric {
  questionId: string
  answer?: Answer
  answers?: Answer[]
  numerical?: string
  correct: boolean
  skipped: boolean
  durationSeconds: number
}

export interface Attempt {
  id: string
  testId: string
  completedAt: number
  score: number
  total: number
  durationSeconds: number
  metrics: QuestionMetric[]
}

export interface MistakeNote {
  id: string
  attemptId: string
  questionId: string
  text: string
  categories?: MistakeCategory[]
  updatedAt: number
}

/** A subject range marker placed on the cut editor (e.g. Physics Q1–Q30). */
export interface SubjectMarker {
  id: string
  subject: 'Physics' | 'Chemistry' | 'Mathematics'
  /** 0-based question index (inclusive) */
  from: number
  /** 0-based question index (inclusive) */
  to: number
}

/** A section marker applied to a range of questions. */
export interface SectionMarker {
  id: string
  schemeId: string
  /** 0-based question index (inclusive) */
  from: number
  /** 0-based question index (inclusive) */
  to: number
  /** Resolved marks at time of creation */
  marks: Marks
  type: QuestionType
  /** Custom label override */
  label?: string
}
