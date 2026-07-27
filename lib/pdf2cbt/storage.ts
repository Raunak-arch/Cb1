import { openDB, type DBSchema } from 'idb'
import type { Attempt, MistakeNote, Test } from './types'

interface CBTDatabase extends DBSchema {
  tests: { key: string; value: Test }
  attempts: { key: string; value: Attempt; indexes: { 'by-test': string } }
  notes: { key: string; value: MistakeNote; indexes: { 'by-attempt': string } }
}

const getDB = () => openDB<CBTDatabase>('pdf2cbt-offline', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('tests')) db.createObjectStore('tests', { keyPath: 'id' })
    if (!db.objectStoreNames.contains('attempts')) {
      const attempts = db.createObjectStore('attempts', { keyPath: 'id' })
      attempts.createIndex('by-test', 'testId')
    }
    if (!db.objectStoreNames.contains('notes')) {
      const notes = db.createObjectStore('notes', { keyPath: 'id' })
      notes.createIndex('by-attempt', 'attemptId')
    }
  },
})

export const localDB = {
  tests: async () => (await getDB()).getAll('tests'),
  putTest: async (test: Test) => (await getDB()).put('tests', test),
  attempts: async () => (await getDB()).getAll('attempts'),
  putAttempt: async (attempt: Attempt) => (await getDB()).put('attempts', attempt),
  notes: async (attemptId: string) => (await getDB()).getAllFromIndex('notes', 'by-attempt', attemptId),
  allNotes: async () => (await getDB()).getAll('notes'),
  putNote: async (note: MistakeNote) => (await getDB()).put('notes', note),
}

export const demoTest: Test = {
  id: 'demo-nta-2026', title: 'JEE Main Practice Set', durationMinutes: 30, theme: 'soft', createdAt: Date.now(),
  questions: [
    { id: 'q1', subject: 'Physics', type: 'single', marks: { correct: 4, wrong: -1 }, prompt: 'A body starts from rest with constant acceleration. If it travels 20 m in 4 s, what is its acceleration?', options: {}, optionText: { A: '1.5 m/s²', B: '2.0 m/s²', C: '2.5 m/s²', D: '4.0 m/s²' }, correctAnswer: 'C', solution: 'Using s = ½at², a = 2s/t² = 40/16 = 2.5 m/s².' },
    { id: 'q2', subject: 'Chemistry', type: 'single', marks: { correct: 4, wrong: -1 }, prompt: 'Which element has the highest electronegativity?', options: {}, optionText: { A: 'Oxygen', B: 'Fluorine', C: 'Chlorine', D: 'Nitrogen' }, correctAnswer: 'B', solution: 'Fluorine is the most electronegative element.' },
    { id: 'q3', subject: 'Mathematics', type: 'single', marks: { correct: 4, wrong: -1 }, prompt: 'The derivative of sin(x) is:', options: {}, optionText: { A: 'cos(x)', B: '-cos(x)', C: 'sin(x)', D: '-sin(x)' }, correctAnswer: 'A', solution: 'By the standard trigonometric derivative, d(sin x)/dx = cos x.' },
    { id: 'q4', subject: 'Physics', type: 'single', marks: { correct: 4, wrong: -1 }, prompt: 'Which quantity is conserved in an isolated collision?', options: {}, optionText: { A: 'Velocity', B: 'Acceleration', C: 'Momentum', D: 'Force' }, correctAnswer: 'C', solution: 'Total linear momentum is conserved in an isolated system.' },
  ],
}

export async function seedIfEmpty() {
  const tests = await localDB.tests()
  if (!tests.length) await localDB.putTest(demoTest)
}
