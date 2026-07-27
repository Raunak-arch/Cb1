'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpenCheck, TrendingUp } from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { Attempt, MistakeCategory, MistakeNote, Test } from '@/lib/pdf2cbt/types'
import { localDB } from '@/lib/pdf2cbt/storage'

const CATEGORY_KEYS: { category: MistakeCategory; key: string; color: string }[] = [
  { category: 'Conceptual', key: 'conceptual', color: 'var(--chart-1)' },
  { category: 'Calculation Error', key: 'calculation', color: 'var(--chart-2)' },
  { category: 'Question Interpretation', key: 'interpretation', color: 'var(--chart-3)' },
  { category: 'Time', key: 'time', color: 'var(--chart-4)' },
]

const chartConfig = Object.fromEntries(CATEGORY_KEYS.map(item => [item.key, { label: item.category, color: item.color }])) satisfies ChartConfig

type ReportPoint = { label: string; title: string; date: string; conceptual: number; calculation: number; interpretation: number; time: number }

export function MistakeReports({ attempts, tests, onBack }: { attempts: Attempt[]; tests: Test[]; onBack: () => void }) {
  const [notes, setNotes] = useState<MistakeNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    localDB.allNotes().then(items => { setNotes(items); setLoading(false) })
  }, [])

  const data = useMemo<ReportPoint[]>(() => [...attempts].sort((a, b) => a.completedAt - b.completedAt).map((attempt, index) => {
    const attemptNotes = notes.filter(note => note.attemptId === attempt.id)
    const counts = Object.fromEntries(CATEGORY_KEYS.map(item => [item.key, attemptNotes.filter(note => note.categories?.includes(item.category)).length])) as Record<string, number>
    const test = tests.find(item => item.id === attempt.testId)
    return {
      label: `T${index + 1}`,
      title: test?.title ?? 'Test',
      date: new Date(attempt.completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      conceptual: counts.conceptual,
      calculation: counts.calculation,
      interpretation: counts.interpretation,
      time: counts.time,
    }
  }), [attempts, notes, tests])

  const totals: Record<string, number> = {
    conceptual: data.reduce((sum, point) => sum + point.conceptual, 0),
    calculation: data.reduce((sum, point) => sum + point.calculation, 0),
    interpretation: data.reduce((sum, point) => sum + point.interpretation, 0),
    time: data.reduce((sum, point) => sum + point.time, 0),
  }
  const hasCategories = Object.values(totals).some(Boolean)

  return <div className="min-h-dvh bg-background"><main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 py-6 md:py-9">
    <header className="flex flex-col gap-3"><button onClick={onBack} className="ghost-button w-fit"><ArrowLeft />Dashboard</button><div><p className="eyebrow">Performance trends</p><h1 className="text-balance text-2xl font-bold md:text-3xl">Mistake reports</h1><p className="mt-1 text-sm text-muted-foreground">Track which mistake patterns are leading across your completed tests.</p></div></header>

    {!attempts.length ? <EmptyState title="No completed tests yet" description="Complete a test and categorize its wrong or skipped questions to build your report." /> : loading ? <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">Loading reports…</div> : !hasCategories ? <EmptyState title="No categorized mistakes yet" description="Open a test’s mistake notebook and select one or more categories for wrong or skipped questions." /> : <>
      <section aria-label="Mistake category totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{CATEGORY_KEYS.map(item => <article key={item.key} className="rounded-xl border border-border bg-card p-4"><div className="mb-3 h-1.5 w-10 rounded-full" style={{ backgroundColor: `var(--color-${item.key}, ${item.color})` }} /><p className="text-sm text-muted-foreground">{item.category}</p><strong className="mt-1 block text-2xl tabular-nums">{totals[item.key]}</strong></article>)}</section>

      <section className="rounded-xl border border-border bg-card p-4 md:p-6"><div className="mb-5 flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"><TrendingUp /></span><div><h2 className="font-bold">Mistakes across tests</h2><p className="text-sm text-muted-foreground">Each selected category is counted once per question.</p></div></div>
        <ChartContainer config={chartConfig} className="h-72 w-full min-w-0 aspect-auto">
          <LineChart accessibilityLayer data={data} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload ? `${payload[0].payload.title} · ${payload[0].payload.date}` : ''} />} />
            <ChartLegend content={<ChartLegendContent />} />
            {CATEGORY_KEYS.map(item => <Line key={item.key} dataKey={item.key} type="monotone" stroke={`var(--color-${item.key})`} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />)}
          </LineChart>
        </ChartContainer>
      </section>

      <section><h2 className="mb-3 text-lg font-bold">Test timeline</h2><div className="overflow-hidden rounded-xl border border-border bg-card">{data.map(point => <div key={`${point.label}-${point.date}`} className="flex items-center gap-3 border-b border-border p-3 last:border-0"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-sm font-bold">{point.label}</span><span className="min-w-0 flex-1"><strong className="block truncate">{point.title}</strong><span className="text-xs text-muted-foreground">{point.date}</span></span><span className="text-sm font-semibold tabular-nums">{point.conceptual + point.calculation + point.interpretation + point.time} tags</span></div>)}</div></section>
    </>}
  </main></div>
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center"><BookOpenCheck className="size-8 text-muted-foreground" /><h2 className="font-bold">{title}</h2><p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p></div>
}
