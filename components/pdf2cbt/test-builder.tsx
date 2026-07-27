'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ImageOff, Plus, Save, Trash2 } from 'lucide-react'
import type { Answer, Question, Test, TestTheme } from '@/lib/pdf2cbt/types'
import { localDB } from '@/lib/pdf2cbt/storage'
import { PDFCropper } from './pdf-cropper'

const ANSWERS: Answer[] = ['A', 'B', 'C', 'D']
const blank = (): Question => ({ id: crypto.randomUUID(), subject: 'Physics', prompt: '', options: {}, optionText: {}, correctAnswer: 'A', solution: '' })

const THEMES: { id: TestTheme; name: string; desc: string; swatch: string }[] = [
  { id: 'classic', name: 'NTA Classic', desc: 'Rigid, dense exam layout', swatch: 'bg-[#1a3a6b]' },
  { id: 'soft', name: 'Soft Blue', desc: 'Modern rounded cards', swatch: 'bg-indigo-600' },
]

export function TestBuilder({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(30)
  const [theme, setTheme] = useState<TestTheme>('soft')
  const [questions, setQuestions] = useState<Question[]>([blank()])
  const [active, setActive] = useState(0)
  const [step, setStep] = useState(0)
  const [reviewKey, setReviewKey] = useState(false)

  const current = questions[active]
  const update = (patch: Partial<Question>) => setQuestions(qs => qs.map((q, i) => i === active ? { ...q, ...patch } : q))

  function crop(target: 'question' | Answer, url: string) {
    if (target === 'question') update({ questionImage: url })
    else update({ options: { ...current.options, [target]: url } })
  }

  async function save() {
    const test: Test = { id: crypto.randomUUID(), title: title.trim() || 'Untitled Test', durationMinutes: duration, theme, questions, createdAt: Date.now() }
    await localDB.putTest(test)
    onSaved()
  }

  const meta = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1"><label className="text-sm font-medium" htmlFor="q-subject">Subject</label>
        <select id="q-subject" value={current.subject} onChange={e => update({ subject: e.target.value })} className="field">
          {['Physics', 'Chemistry', 'Mathematics', 'Biology', 'General'].map(s => <option key={s}>{s}</option>)}
        </select></div>
      <div className="flex flex-col gap-1"><label className="text-sm font-medium" htmlFor="q-prompt">Question text (optional)</label>
        <textarea id="q-prompt" value={current.prompt} onChange={e => update({ prompt: e.target.value })} rows={2} className="field" placeholder="Shown above the cropped image" /></div>
      <fieldset className="flex flex-col gap-2"><legend className="text-sm font-medium">Correct answer</legend>
        <div className="flex gap-2">{ANSWERS.map(a => <button key={a} type="button" onClick={() => update({ correctAnswer: a })} className={`min-h-11 flex-1 rounded-lg border font-semibold ${current.correctAnswer === a ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>{a}</button>)}</div></fieldset>
      <div className="flex flex-col gap-1"><label className="text-sm font-medium" htmlFor="q-sol">Solution / note (optional)</label>
        <textarea id="q-sol" value={current.solution} onChange={e => update({ solution: e.target.value })} rows={2} className="field" placeholder="Explanation for the mistake log" /></div>
    </div>
  )

  const previews = (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Cropped previews</p>
      <div className="rounded-lg border border-border bg-muted/40 p-2">{current.questionImage ? <img src={current.questionImage || "/placeholder.svg"} alt="Cropped question" className="max-h-40 w-full object-contain" /> : <span className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><ImageOff aria-hidden="true" />No question crop yet</span>}</div>
      <div className="grid grid-cols-2 gap-2">{ANSWERS.map(a => <div key={a} className="rounded-lg border border-border bg-muted/40 p-2 text-center"><span className="text-xs font-semibold text-muted-foreground">Option {a}</span>{current.options[a] ? <img src={current.options[a]! || "/placeholder.svg"} alt={`Cropped option ${a}`} className="mt-1 max-h-20 w-full object-contain" /> : <p className="mt-1 text-xs text-muted-foreground">empty</p>}</div>)}</div>
    </div>
  )

  const qNav = (
    <div className="flex flex-wrap items-center gap-2">
      {questions.map((_, i) => <button key={i} onClick={() => { setActive(i); setStep(1) }} className={`size-11 rounded-lg border text-sm font-semibold ${i === active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>{i + 1}</button>)}
      <button onClick={() => { setQuestions(qs => [...qs, blank()]); setActive(questions.length); setStep(1) }} className="icon-button" aria-label="Add question"><Plus /></button>
      {questions.length > 1 && <button onClick={() => { setQuestions(qs => qs.filter((_, i) => i !== active)); setActive(0) }} className="icon-button text-destructive" aria-label="Delete current question"><Trash2 /></button>}
    </div>
  )

  if (reviewKey) return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4">
      <h2 className="text-2xl font-bold">Answer key review</h2>
      <p className="text-muted-foreground">Confirm the correct option for every question before saving.</p>
      <div className="overflow-hidden rounded-xl border border-border">
        {questions.map((q, i) => <div key={q.id} className="flex flex-wrap items-center gap-3 border-b border-border p-3 last:border-0">
          <span className="font-semibold">Q{i + 1}</span><span className="text-sm text-muted-foreground">{q.subject}</span>
          <div className="ml-auto flex gap-1">{ANSWERS.map(a => <button key={a} onClick={() => setQuestions(qs => qs.map((qq, idx) => idx === i ? { ...qq, correctAnswer: a } : qq))} className={`size-10 rounded-md border text-sm font-semibold ${q.correctAnswer === a ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>{a}</button>)}</div>
        </div>)}
      </div>
      <div className="flex flex-wrap gap-3"><button onClick={() => setReviewKey(false)} className="ghost-button"><ArrowLeft />Back to editing</button><button onClick={save} className="primary-button"><Save />Save test</button></div>
    </div>
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><button onClick={onCancel} className="ghost-button mb-2"><ArrowLeft />Dashboard</button><h2 className="text-2xl font-bold">Create a test</h2></div>
        <button onClick={() => setReviewKey(true)} className="primary-button"><Check />Review answer key</button>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 sm:col-span-1"><label className="text-sm font-medium" htmlFor="t-title">Test title</label><input id="t-title" value={title} onChange={e => setTitle(e.target.value)} className="field" placeholder="e.g. Physics Mock 1" /></div>
        <div className="flex flex-col gap-1"><label className="text-sm font-medium" htmlFor="t-dur">Duration (min)</label><input id="t-dur" type="number" min={1} value={duration} onChange={e => setDuration(+e.target.value)} className="field" /></div>
        <fieldset className="flex flex-col gap-1"><legend className="text-sm font-medium">Exam theme</legend><div className="flex gap-2">{THEMES.map(t => <button key={t.id} type="button" onClick={() => setTheme(t.id)} className={`flex flex-1 items-center gap-2 rounded-lg border p-2 text-left text-sm ${theme === t.id ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`}><span className={`size-6 shrink-0 rounded ${t.swatch}`} /><span className="min-w-0"><span className="block font-semibold">{t.name}</span><span className="block truncate text-xs text-muted-foreground">{t.desc}</span></span></button>)}</div></fieldset>
      </div>

      {qNav}

      {/* Desktop split view */}
      <div className="hidden gap-5 md:grid md:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-4"><PDFCropper onCrop={crop} /></div>
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4">{meta}{previews}</div>
      </div>

      {/* Mobile wizard */}
      <div className="flex flex-col gap-4 md:hidden">
        <div className="flex gap-1">{['Crop', 'Details', 'Review'].map((label, i) => <div key={label} className={`flex-1 rounded-full py-1 text-center text-xs font-semibold ${i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{label}</div>)}</div>
        <div className="rounded-xl border border-border bg-card p-4">
          {step === 0 && <PDFCropper onCrop={crop} />}
          {step === 1 && meta}
          {step === 2 && previews}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="ghost-button flex-1 justify-center"><ArrowLeft />Back</button>
          {step < 2 ? <button onClick={() => setStep(s => s + 1)} className="primary-button flex-1 justify-center">Next<ArrowRight /></button> : <button onClick={() => setReviewKey(true)} className="primary-button flex-1 justify-center"><Check />Finish</button>}
        </div>
      </div>
    </div>
  )
}
