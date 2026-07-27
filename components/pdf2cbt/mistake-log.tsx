'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Check, CheckCircle2 } from 'lucide-react'
import type { Attempt, MistakeCategory, MistakeNote, Test } from '@/lib/pdf2cbt/types'
import { localDB } from '@/lib/pdf2cbt/storage'

const CATEGORIES: MistakeCategory[] = ['Conceptual', 'Calculation Error', 'Question Interpretation', 'Time']

export function MistakeLog({ test, attempt, onBack }: { test: Test; attempt: Attempt; onBack: () => void }) {
  const [notes, setNotes] = useState<Record<string, MistakeNote>>({})
  const mistakes = attempt.metrics.filter(metric => !metric.correct)

  useEffect(() => {
    localDB.notes(attempt.id).then(items => setNotes(Object.fromEntries(items.map(note => [note.questionId, note]))))
  }, [attempt.id])

  function save(questionId: string, patch: Partial<Pick<MistakeNote, 'text' | 'categories'>>) {
    const current = notes[questionId]
    const note: MistakeNote = {
      id: `${attempt.id}:${questionId}`,
      attemptId: attempt.id,
      questionId,
      text: current?.text ?? '',
      categories: current?.categories ?? [],
      updatedAt: Date.now(),
      ...patch,
    }
    setNotes(previous => ({ ...previous, [questionId]: note }))
    void localDB.putNote(note)
  }

  function toggleCategory(questionId: string, category: MistakeCategory) {
    const selected = notes[questionId]?.categories ?? []
    save(questionId, {
      categories: selected.includes(category)
        ? selected.filter(item => item !== category)
        : [...selected, category],
    })
  }

  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4">
    <div><button onClick={onBack} className="ghost-button mb-2"><ArrowLeft />Results</button><h2 className="flex items-center gap-2 text-2xl font-bold"><BookOpen />Mistake notebook</h2><p className="mt-1 text-muted-foreground">{test.title}</p></div>
    {!mistakes.length ? <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center"><CheckCircle2 className="text-success" /><h3 className="font-bold">Perfect attempt</h3><p className="text-muted-foreground">There are no wrong or skipped questions to review.</p></div> : mistakes.map(metric => {
      const question = test.questions.find(item => item.id === metric.questionId)!
      const number = test.questions.indexOf(question) + 1
      const selected = notes[question.id]?.categories ?? []
      return <article key={question.id} className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex items-center gap-3 border-b border-border bg-muted/40 p-4"><span className="font-bold">Question {number}</span><span className="text-sm text-muted-foreground">{question.subject}</span><span className="ml-auto rounded-full bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">{metric.skipped ? 'Skipped' : 'Wrong'}</span></header>
        <div className="flex flex-col gap-4 p-4">
          {question.prompt && <p className="font-medium leading-relaxed">{question.prompt}</p>}{question.questionImage && <img src={question.questionImage || '/placeholder.svg'} alt="Question content" className="max-h-64 w-full object-contain object-left" />}
          <div className="grid gap-2 sm:grid-cols-2"><p className="rounded-lg bg-destructive/10 p-3 text-sm"><span className="block text-xs font-semibold text-destructive">Your answer</span>{metric.answer || 'Not answered'}</p><p className="rounded-lg bg-success/10 p-3 text-sm"><span className="block text-xs font-semibold text-success">Correct answer</span>{question.correctAnswer}</p></div>
          {question.solution && <div className="rounded-lg border border-border p-3"><p className="mb-1 text-xs font-semibold text-muted-foreground">SOLUTION</p><p className="text-sm leading-relaxed">{question.solution}</p></div>}
          <fieldset className="flex flex-col gap-2"><legend className="text-sm font-semibold">Mistake categories <span className="font-normal text-muted-foreground">(select all that apply)</span></legend><div className="flex flex-wrap gap-2">{CATEGORIES.map(category => { const active = selected.includes(category); return <button key={category} type="button" role="checkbox" aria-checked={active} onClick={() => toggleCategory(question.id, category)} className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted'}`}>{active && <Check className="size-4" />}{category}</button> })}</div></fieldset>
          <div className="flex flex-col gap-1"><label htmlFor={`note-${question.id}`} className="text-sm font-semibold">My notebook entry</label><textarea id={`note-${question.id}`} value={notes[question.id]?.text || ''} onChange={event => save(question.id, { text: event.target.value })} rows={3} className="field" placeholder="What went wrong? Add a shortcut, concept, or reminder…" /></div>
        </div>
      </article>
    })}
  </div>
}
