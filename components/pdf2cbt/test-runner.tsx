'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Expand, Flag, Hash, Menu, Trash2, X } from 'lucide-react'
import type { Answer, Attempt, Question, QuestionMetric, Test } from '@/lib/pdf2cbt/types'
import { localDB } from '@/lib/pdf2cbt/storage'
import { gradeQuestion, maxMarks, normalizeQuestion } from '@/lib/pdf2cbt/scoring'
import { toggleFullscreen } from '@/lib/pdf2cbt/fullscreen'

const ANSWERS: Answer[] = ['A', 'B', 'C', 'D']

interface Responses {
  single: Record<string, Answer>
  multiple: Record<string, Answer[]>
  numerical: Record<string, string>
}

function getType(q: Question) { return normalizeQuestion(q).type }

export function TestRunner({ test, onDone, onExit }: { test: Test; onDone: (attempt: Attempt) => void; onExit: () => void }) {
  const [current, setCurrent] = useState(0)
  const [responses, setResponses] = useState<Responses>({ single: {}, multiple: {}, numerical: {} })
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [visited, setVisited] = useState<Set<string>>(new Set([test.questions[0]?.id]))
  const [palette, setPalette] = useState(false)
  const [seconds, setSeconds] = useState(test.durationMinutes * 60)
  const [timings, setTimings] = useState<Record<string, number>>({})
  const enteredAt = useRef(Date.now())
  const rootRef = useRef<HTMLDivElement>(null)
  const q = normalizeQuestion(test.questions[current])
  const qType = q.type

  function switchTo(index: number) {
    const elapsed = Math.max(0, Math.round((Date.now() - enteredAt.current) / 1000))
    setTimings(t => ({ ...t, [q.id]: (t[q.id] || 0) + elapsed }))
    enteredAt.current = Date.now()
    setCurrent(index)
    setVisited(v => new Set(v).add(test.questions[index].id))
    setPalette(false)
  }

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => { if (seconds === 0) submit() }, [seconds])

  function isAnswered(question: Question) {
    const t = normalizeQuestion(question).type
    if (t === 'numerical') return !!(responses.numerical[question.id]?.trim())
    if (t === 'multiple') return (responses.multiple[question.id]?.length ?? 0) > 0
    return !!responses.single[question.id]
  }

  function buildResponse(question: Question) {
    const t = normalizeQuestion(question).type
    return {
      single: responses.single[question.id],
      multiple: responses.multiple[question.id],
      numerical: responses.numerical[question.id],
    }
  }

  async function submit() {
    const finalTimings = {
      ...timings,
      [q.id]: (timings[q.id] || 0) + Math.round((Date.now() - enteredAt.current) / 1000),
    }
    let totalMarks = 0
    const metrics: QuestionMetric[] = test.questions.map(question => {
      const nq = normalizeQuestion(question)
      const resp = buildResponse(question)
      const grade = gradeQuestion(nq, resp)
      totalMarks += grade.marks
      return {
        questionId: question.id,
        answer: responses.single[question.id],
        answers: responses.multiple[question.id],
        numerical: responses.numerical[question.id],
        correct: grade.correct,
        skipped: !grade.answered,
        durationSeconds: finalTimings[question.id] || 0,
      }
    })
    const correctCount = metrics.filter(m => m.correct).length
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      testId: test.id,
      completedAt: Date.now(),
      score: correctCount,
      total: test.questions.length,
      durationSeconds: test.durationMinutes * 60 - seconds,
      metrics,
    }
    await localDB.putAttempt(attempt)
    onDone(attempt)
  }

  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const classic = test.theme === 'classic'

  function toggleMultiple(a: Answer) {
    setResponses(r => {
      const cur = r.multiple[q.id] ?? []
      const next = cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a]
      return { ...r, multiple: { ...r.multiple, [q.id]: next } }
    })
  }

  function clearAnswer() {
    setResponses(r => {
      const { [q.id]: _s, ...single } = r.single
      const { [q.id]: _m, ...multiple } = r.multiple
      const { [q.id]: _n, ...numerical } = r.numerical
      return { single, multiple, numerical }
    })
  }

  const palettePanel = (
    <div className={`flex h-full flex-col gap-4 p-4 ${classic ? 'rounded-none bg-card' : 'rounded-xl bg-card'}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Question Palette</h2>
        <button onClick={() => setPalette(false)} className="icon-button md:hidden" aria-label="Close question palette"><X /></button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {test.questions.map((question, i) => {
          const answered = isAnswered(question)
          const isMarked = marked.has(question.id)
          const isVisited = visited.has(question.id)
          return (
            <button
              key={question.id}
              onClick={() => switchTo(i)}
              aria-label={`Question ${i + 1}${answered ? ', answered' : ''}`}
              className={`size-11 border text-sm font-bold ${classic ? 'rounded-none' : 'rounded-lg'} ${i === current ? 'ring-2 ring-primary ring-offset-2' : ''} ${isMarked ? 'border-review bg-review text-review-foreground' : answered ? 'border-success bg-success text-success-foreground' : isVisited ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-border bg-muted'}`}
            >{i + 1}</button>
          )
        })}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 text-xs">
        <span><i className="inline-block size-3 bg-success" /> Answered</span>
        <span><i className="inline-block size-3 bg-destructive" /> Not answered</span>
        <span><i className="inline-block size-3 bg-review" /> Review</span>
        <span><i className="inline-block size-3 bg-muted" /> Not visited</span>
      </div>
    </div>
  )

  return (
    <div ref={rootRef} className={`min-h-dvh bg-muted/40 ${classic ? 'font-sans' : ''}`}>
      <header className={`flex min-h-16 items-center justify-between gap-3 border-b border-border px-3 md:px-6 ${classic ? 'bg-classic text-classic-foreground' : 'bg-card'}`}>
        <div className="min-w-0">
          <p className="truncate font-bold">{test.title}</p>
          <p className={`text-xs ${classic ? 'text-classic-foreground/75' : 'text-muted-foreground'}`}>Question {current + 1} of {test.questions.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`min-w-20 rounded-lg px-3 py-2 text-center font-mono font-bold ${classic ? 'bg-classic-foreground text-classic' : 'bg-primary/10 text-primary'}`}>{time}</span>
          <button onClick={() => toggleFullscreen(rootRef.current!).catch(e => alert(e.message))} className="icon-button" aria-label="Toggle fullscreen"><Expand /></button>
          <button onClick={() => setPalette(true)} className="icon-button md:hidden" aria-label="Open question palette"><Menu /></button>
        </div>
      </header>

      <main className="grid min-h-[calc(100dvh-4rem)] md:grid-cols-[1fr_280px]">
        <section className="flex min-w-0 flex-col p-3 md:p-6">
          <div className={`flex flex-1 flex-col gap-5 border border-border bg-card p-4 md:p-6 ${classic ? 'rounded-none' : 'rounded-xl shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground">{q.subject}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">{qType}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">+{q.marks?.correct ?? 4} / {q.marks?.wrong ?? -1}</span>
              </div>
              <button
                onClick={() => setMarked(m => { const n = new Set(m); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n })}
                className="ghost-button"
              >
                <Flag />{marked.has(q.id) ? 'Unmark' : 'Mark for review'}
              </button>
            </div>

            {q.prompt && <p className="text-pretty text-base font-medium leading-relaxed md:text-lg">{q.prompt}</p>}
            {q.questionImage && (
              <img src={q.questionImage} alt="Question content" className="max-h-[60dvh] w-full object-contain object-left" />
            )}

            {/* Single correct */}
            {qType === 'single' && (
              <fieldset className="flex flex-col gap-3">
                <legend className="sr-only">Answer options</legend>
                {ANSWERS.map(a => (
                  <label
                    key={a}
                    className={`flex min-h-14 cursor-pointer items-center gap-3 border p-3 ${classic ? 'rounded-none' : 'rounded-xl'} ${responses.single[q.id] === a ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'}`}
                  >
                    <input
                      type="radio"
                      name="answer"
                      checked={responses.single[q.id] === a}
                      onChange={() => setResponses(r => ({ ...r, single: { ...r.single, [q.id]: a } }))}
                      className="size-5 accent-primary"
                    />
                    <strong>{a}.</strong>
                    {q.options[a]
                      ? <img src={q.options[a]!} alt={`Option ${a}`} className="max-h-24 min-w-0 object-contain object-left" />
                      : <span>{q.optionText?.[a] || `Option ${a}`}</span>}
                  </label>
                ))}
              </fieldset>
            )}

            {/* Multiple correct */}
            {qType === 'multiple' && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 text-sm text-muted-foreground">Select all correct options</legend>
                {ANSWERS.map(a => {
                  const chosen = (responses.multiple[q.id] ?? []).includes(a)
                  return (
                    <label
                      key={a}
                      className={`flex min-h-14 cursor-pointer items-center gap-3 border p-3 ${classic ? 'rounded-none' : 'rounded-xl'} ${chosen ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={chosen}
                        onChange={() => toggleMultiple(a)}
                        className="size-5 accent-primary"
                      />
                      <strong>{a}.</strong>
                      {q.options[a]
                        ? <img src={q.options[a]!} alt={`Option ${a}`} className="max-h-24 min-w-0 object-contain object-left" />
                        : <span>{q.optionText?.[a] || `Option ${a}`}</span>}
                    </label>
                  )
                })}
              </fieldset>
            )}

            {/* Numerical */}
            {qType === 'numerical' && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Enter your numerical answer:</p>
                <div className="flex items-center gap-2">
                  <Hash className="size-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={responses.numerical[q.id] ?? ''}
                    onChange={e => setResponses(r => ({ ...r, numerical: { ...r.numerical, [q.id]: e.target.value } }))}
                    placeholder="Type your answer…"
                    className="field max-w-xs"
                    aria-label="Numerical answer"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 mt-3 flex flex-wrap items-center gap-2 border-t border-border bg-background py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
            <button onClick={clearAnswer} className="ghost-button"><Trash2 />Clear</button>
            <div className="ml-auto flex gap-2">
              <button disabled={current === 0} onClick={() => switchTo(current - 1)} className="ghost-button"><ChevronLeft />Previous</button>
              {current < test.questions.length - 1
                ? <button onClick={() => switchTo(current + 1)} className="primary-button">Save &amp; Next<ChevronRight /></button>
                : <button onClick={() => confirm('Submit this test?') && submit()} className="primary-button"><Check />Submit</button>}
            </div>
          </div>
        </section>

        <aside className="hidden border-l border-border p-3 md:block">{palettePanel}</aside>
      </main>

      {palette && (
        <div className="fixed inset-0 flex justify-end bg-foreground/30 md:hidden" role="dialog" aria-modal="true" aria-label="Question palette">
          <button className="absolute inset-0" aria-label="Close question palette" onClick={() => setPalette(false)} />
          <div className="relative h-full w-[min(86vw,340px)] bg-card shadow-xl">{palettePanel}</div>
        </div>
      )}
    </div>
  )
}
