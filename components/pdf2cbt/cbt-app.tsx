'use client'

import { useEffect, useState } from 'react'
import { BarChart3, BookMarked, ChevronRight, Clock3, FilePlus2, History, LayoutDashboard, Play, RefreshCw } from 'lucide-react'
import type { Attempt, Test, View } from '@/lib/pdf2cbt/types'
import { localDB, seedIfEmpty } from '@/lib/pdf2cbt/storage'
import { TestBuilder } from './test-builder'
import { QuickImport } from './quick-import'
import { TestRunner } from './test-runner'
import { ResultsView } from './results-view'
import { MistakeLog } from './mistake-log'
import { MistakeReports } from './mistake-reports'

export function CBTApp() {
  const [view, setView] = useState<View>('dashboard')
  const [tests, setTests] = useState<Test[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [activeTest, setActiveTest] = useState<Test | null>(null)
  const [activeAttempt, setActiveAttempt] = useState<Attempt | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() { await seedIfEmpty(); const [t, a] = await Promise.all([localDB.tests(), localDB.attempts()]); setTests(t.sort((x,y) => y.createdAt-x.createdAt)); setAttempts(a.sort((x,y) => y.completedAt-x.completedAt)); setLoading(false) }
  useEffect(() => { refresh() }, [])

  function openResult(attempt: Attempt) { setActiveAttempt(attempt); setActiveTest(tests.find(t => t.id === attempt.testId) || null); setView('results') }
  function start(test: Test) { setActiveTest(test); setView('runner') }

  if (view === 'quick') return <QuickImport onCancel={() => setView('dashboard')} onSaved={async () => { await refresh(); setView('dashboard') }} />
  if (view === 'builder') return <TestBuilder onCancel={() => setView('dashboard')} onSaved={async () => { await refresh(); setView('dashboard') }} />
  if (view === 'runner' && activeTest) return <TestRunner test={activeTest} onExit={() => setView('dashboard')} onDone={async a => { setActiveAttempt(a); await refresh(); setView('results') }} />
  if (view === 'results' && activeTest && activeAttempt) return <ResultsView test={activeTest} attempt={activeAttempt} onBack={() => setView('dashboard')} onMistakes={() => setView('mistakes')} />
  if (view === 'mistakes' && activeTest && activeAttempt) return <MistakeLog test={activeTest} attempt={activeAttempt} onBack={() => setView('results')} />
  if (view === 'mistake-reports') return <MistakeReports attempts={attempts} tests={tests} onBack={() => setView('dashboard')} />

  return <div className="min-h-dvh bg-background">
    <header className="border-b border-border bg-card"><div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4"><button onClick={() => setView('dashboard')} className="flex items-center gap-2 font-bold"><span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">P2</span><span>PDF2CBT</span></button><nav aria-label="Primary" className="hidden items-center gap-1 sm:flex"><button className="nav-button bg-muted text-foreground"><LayoutDashboard />Dashboard</button><button onClick={() => setView('quick')} className="nav-button"><FilePlus2 />Quick import</button><button onClick={() => setView('builder')} className="nav-button"><FilePlus2 />Manual builder</button><button onClick={() => setView('mistake-reports')} className="nav-button"><BookMarked />Mistake reports</button></nav><button onClick={() => setView('mistake-reports')} className="ghost-button sm:hidden"><BookMarked />Reports</button></div></header>
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 p-4 py-6 md:py-9">
      <section className="flex flex-col justify-between gap-4 rounded-2xl bg-hero p-5 text-hero-foreground sm:flex-row sm:items-center md:p-7">
        <div className="max-w-2xl"><h1 className="text-balance text-2xl font-bold md:text-3xl">Turn any PDF into a CBT.</h1><p className="mt-1 text-sm text-hero-foreground/75">Auto-slices questions from the PDF — formulas and diagrams stay pixel-perfect.</p></div><button onClick={() => setView('quick')} className="min-h-12 shrink-0 rounded-xl bg-background px-5 font-semibold text-foreground">Quick import PDF</button>
      </section>

      <section><div className="mb-3"><h2 className="text-xl font-bold">Tests</h2></div>
        {loading ? <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">Loading…</div> : <div className="grid gap-3 md:grid-cols-2">{tests.map(test => { const latest = attempts.find(a => a.testId === test.id); return <article key={test.id} className="group rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex items-center gap-2"><span className={`size-2 rounded-full ${test.theme === 'classic' ? 'bg-classic' : 'bg-primary'}`} /><span className="text-xs font-semibold text-muted-foreground">{test.theme === 'classic' ? 'NTA CLASSIC' : 'SOFT BLUE'}</span></div><h3 className="truncate text-lg font-bold">{test.title}</h3><p className="mt-1 flex items-center gap-3 text-sm text-muted-foreground"><span>{test.questions.length} questions</span><span className="flex items-center gap-1"><Clock3 />{test.durationMinutes} min</span></p></div>{latest && <div className="rounded-lg bg-success/10 px-3 py-2 text-center"><strong className="block text-success">{Math.round(latest.score/latest.total*100)}%</strong><span className="text-[11px] text-muted-foreground">latest</span></div>}</div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => start(test)} className="primary-button"><Play />Start test</button>{latest && <button onClick={() => openResult(latest)} className="ghost-button"><BarChart3 />Analytics</button>}</div></article>})}</div>}
      </section>

      <section><div className="mb-3 flex items-end justify-between gap-3"><div><p className="eyebrow">Progress</p><h2 className="text-xl font-bold">Recent attempts</h2></div><button onClick={() => setView('mistake-reports')} className="ghost-button"><BookMarked />MISTAKE REPORTS</button></div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">{attempts.length ? attempts.slice(0,5).map(attempt => { const test=tests.find(t => t.id === attempt.testId); return <button key={attempt.id} onClick={() => openResult(attempt)} className="flex min-h-16 w-full items-center gap-3 border-b border-border p-3 text-left last:border-0 hover:bg-muted/50"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"><History /></span><span className="min-w-0 flex-1"><strong className="block truncate">{test?.title || 'Test'}</strong><span className="text-xs text-muted-foreground">{new Date(attempt.completedAt).toLocaleDateString()} · {Math.floor(attempt.durationSeconds/60)} min</span></span><strong>{attempt.score}/{attempt.total}</strong><ChevronRight /></button> }) : <div className="flex flex-col items-center gap-2 p-8 text-center"><RefreshCw className="text-muted-foreground" /><p className="font-semibold">No attempts yet</p><p className="text-sm text-muted-foreground">Complete a test to unlock analytics and your mistake notebook.</p></div>}</div>
      </section>
    </main>
  </div>
}
