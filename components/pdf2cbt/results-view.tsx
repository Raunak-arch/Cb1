'use client'

import { ArrowLeft, BookMarked } from 'lucide-react'
import type { Attempt, Test } from '@/lib/pdf2cbt/types'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
}

function Bar({ label, value, total, tone = 'primary' }: { label: string; value: number; total: number; tone?: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return <div className="flex flex-col gap-1"><div className="flex justify-between text-sm"><span className="font-medium">{label}</span><span className="text-muted-foreground">{value}/{total} ({pct}%)</span></div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full bg-${tone}`} style={{ width: `${pct}%` }} /></div></div>
}

export function ResultsView({ test, attempt, onBack, onMistakes }: { test: Test; attempt: Attempt; onBack: () => void; onMistakes: () => void }) {
  const accuracy = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0
  const subjects = Array.from(new Set(test.questions.map(q => q.subject))).map(subject => {
    const ids = test.questions.filter(q => q.subject === subject).map(q => q.id)
    const correct = attempt.metrics.filter(m => ids.includes(m.questionId) && m.correct).length
    return { subject, correct, total: ids.length }
  })
  const fmt = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`

  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><button onClick={onBack} className="ghost-button mb-2"><ArrowLeft />Dashboard</button><h2 className="text-2xl font-bold">{test.title} — Results</h2></div><button onClick={onMistakes} className="primary-button"><BookMarked />Open mistake log</button></div>
    <div className="grid gap-3 sm:grid-cols-4"><Stat label="Score" value={`${attempt.score}/${attempt.total}`} /><Stat label="Accuracy" value={`${accuracy}%`} /><Stat label="Time spent" value={fmt(attempt.durationSeconds)} /><Stat label="Avg / question" value={fmt(Math.round(attempt.durationSeconds / (attempt.total || 1)))} /></div>
    <div className="rounded-xl border border-border bg-card p-4"><h3 className="mb-4 font-bold">Subject breakdown</h3><div className="flex flex-col gap-4">{subjects.map(s => <Bar key={s.subject} label={s.subject} value={s.correct} total={s.total} tone="success" />)}</div></div>
    <div className="overflow-hidden rounded-xl border border-border bg-card"><h3 className="border-b border-border p-4 font-bold">Time per question</h3>
      {test.questions.map((q, i) => { const m = attempt.metrics.find(x => x.questionId === q.id)!; return <div key={q.id} className="flex items-center gap-3 border-b border-border p-3 text-sm last:border-0"><span className="font-semibold">Q{i + 1}</span><span className="text-muted-foreground">{q.subject}</span><span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${m.correct ? 'bg-success/15 text-success' : m.skipped ? 'bg-muted text-muted-foreground' : 'bg-destructive/15 text-destructive'}`}>{m.correct ? 'Correct' : m.skipped ? 'Skipped' : 'Wrong'}</span><span className="w-16 text-right font-mono">{fmt(m.durationSeconds)}</span></div> })}
    </div>
  </div>
}
