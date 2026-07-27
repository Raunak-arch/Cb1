'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight,
  ClipboardPaste, Hash, Save, Scissors, Sparkles, Upload, X,
} from 'lucide-react'
import type { Answer, Question, SectionMarker, SubjectMarker, Test } from '@/lib/pdf2cbt/types'
import { localDB } from '@/lib/pdf2cbt/storage'
import { SECTION_COLOR, SUBJECT_COLORS } from '@/lib/pdf2cbt/scoring'
import {
  detectQuestionCuts, loadPdfDocument,
  parseAnswerKey, renderPageToCanvas, slicePage,
} from '@/lib/pdf2cbt/quick-slice'
import { SlicingDashboard } from './slicing-dashboard'

const ANSWERS: Answer[] = ['A', 'B', 'C', 'D']

interface SlicedQuestion {
  image: string
  answer?: Answer
  /** For multiple-correct questions */
  answers?: Answer[]
  /** For numerical questions */
  numerical?: string
}

export function QuickImport({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<'upload' | 'cuts' | 'key'>('upload')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [pdf, setPdf] = useState<any>(null)
  const [pageCuts, setPageCuts] = useState<number[][]>([])
  const [autoCount, setAutoCount] = useState(0)
  const [page, setPage] = useState(0)
  const [slices, setSlices] = useState<SlicedQuestion[]>([])
  const [keyText, setKeyText] = useState('')
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(60)
  // Dashboard markers
  const [subjectMarkers, setSubjectMarkers] = useState<SubjectMarker[]>([])
  const [sectionMarkers, setSectionMarkers] = useState<SectionMarker[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewScale = useRef(1.2)

  // ---------- Step 1: upload + auto-detect ----------
  async function handleFile(file: File) {
    setError('')
    setBusy('Reading PDF…')
    try {
      const doc = await loadPdfDocument(file)
      setPdf(doc)
      setTitle(file.name.replace(/\.pdf$/i, ''))
      setBusy('Auto-detecting questions…')
      const allCuts: number[][] = []
      let total = 0
      for (let i = 1; i <= doc.numPages; i++) {
        const cuts = await detectQuestionCuts(await doc.getPage(i))
        allCuts.push(cuts)
        total += cuts.length
      }
      setPageCuts(allCuts)
      setAutoCount(total)
      setPage(0)
      setStep('cuts')
    } catch (err) {
      console.log('[v0] PDF load failed:', err)
      setError('Could not open this PDF. Make sure it is not password-protected.')
    } finally {
      setBusy('')
    }
  }

  // ---------- Step 2: cut editor ----------
  const renderPreview = useCallback(async () => {
    if (!pdf || !canvasRef.current) return
    const pdfPage = await pdf.getPage(page + 1)
    const viewport = pdfPage.getViewport({ scale: previewScale.current })
    const canvas = canvasRef.current
    canvas.width = viewport.width
    canvas.height = viewport.height
    await pdfPage.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
  }, [pdf, page])

  useEffect(() => { if (step === 'cuts') renderPreview() }, [step, renderPreview])

  function addCut(event: React.MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const y = (event.clientY - rect.top) / rect.height
    setPageCuts(pc => pc.map((cuts, i) => i === page ? [...cuts, y].sort((a, b) => a - b) : cuts))
  }

  function removeCut(index: number) {
    setPageCuts(pc => pc.map((cuts, i) => i === page ? cuts.filter((_, j) => j !== index) : cuts))
  }

  /** Count only regions bounded by two markers on the same page. */
  function computeQuestionCount(): number {
    return pageCuts.reduce((count, cuts) => count + Math.max(0, cuts.length - 1), 0)
  }

  async function generateSlices() {
    if (!pdf) return
    setBusy('Slicing questions…')
    setError('')
    try {
      const questions: SlicedQuestion[] = []
      for (let i = 0; i < pdf.numPages; i++) {
        if ((pageCuts[i]?.length ?? 0) < 2) continue

        setBusy(`Slicing page ${i + 1} of ${pdf.numPages}…`)
        const canvas = await renderPageToCanvas(await pdf.getPage(i + 1))
        for (const strip of slicePage(canvas, pageCuts[i])) {
          questions.push({ image: strip.canvas.toDataURL('image/jpeg', 0.85) })
        }
      }
      if (!questions.length) {
        setError('No complete questions found. Each question must be between two markers on the same page.')
        setBusy('')
        return
      }
      // Update subject markers' to match actual count
      setSubjectMarkers(sm =>
        sm.map(m => ({ ...m, to: Math.min(m.to, questions.length - 1) }))
      )
      setSectionMarkers(sm =>
        sm.map(m => ({ ...m, to: Math.min(m.to, questions.length - 1) }))
      )
      setSlices(questions)
      setStep('key')
    } catch (e) {
      console.log('[v0] Slicing error:', e)
      setError('Slicing failed. Try again.')
    } finally {
      setBusy('')
    }
  }

  // ---------- Step 3: answer key ----------
  function applyKey(text: string) {
    setKeyText(text)
    const parsed = parseAnswerKey(text, slices.length)
    setSlices(s => s.map((q, i) => ({ ...q, answer: parsed[i] ?? q.answer })))
  }

  /** Resolve subject for question index from subject markers */
  function resolveSubject(idx: number): string {
    for (const m of subjectMarkers) {
      if (idx >= m.from && idx <= m.to) return m.subject
    }
    return 'General'
  }

  /** Resolve section/marks for question index from section markers */
  function resolveSection(idx: number) {
    for (const m of sectionMarkers) {
      if (idx >= m.from && idx <= m.to) return m
    }
    return null
  }

  /** Get the type for a question given section markers */
  function resolveType(idx: number): 'single' | 'multiple' | 'numerical' {
    const sec = resolveSection(idx)
    return sec?.type ?? 'single'
  }

  const answeredCount = slices.filter(s => {
    const t = resolveType(slices.indexOf(s))
    if (t === 'numerical') return !!s.numerical?.trim()
    if (t === 'multiple') return (s.answers?.length ?? 0) > 0
    return !!s.answer
  }).length

  function toggleMultiAnswer(qIdx: number, a: Answer) {
    setSlices(all => all.map((q, j) => {
      if (j !== qIdx) return q
      const current = q.answers ?? []
      const next = current.includes(a) ? current.filter(x => x !== a) : [...current, a]
      return { ...q, answers: next }
    }))
  }

  async function save() {
    const questions: Question[] = slices.map((s, i) => {
      const sec = resolveSection(i)
      const type = sec?.type ?? 'single'
      const marks = sec?.marks ?? { correct: 4, wrong: -1 }
      return {
        id: crypto.randomUUID(),
        subject: resolveSubject(i),
        type,
        marks,
        questionImage: s.image,
        options: {},
        optionText: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
        correctAnswer: type === 'single' ? (s.answer ?? 'A') : undefined,
        correctAnswers: type === 'multiple' ? (s.answers ?? []) : undefined,
        correctNumerical: type === 'numerical' ? (s.numerical ?? '') : undefined,
        solution: '',
      }
    })
    const test: Test = {
      id: crypto.randomUUID(),
      title: title.trim() || 'Quick Test',
      durationMinutes: duration,
      theme: 'classic',
      questions,
      createdAt: Date.now(),
    }
    await localDB.putTest(test)
    onSaved()
  }

  // Compute cuts count for the current page marker overlays
  const currentPageCuts = pageCuts[page] ?? []

  // ---------- UI ----------
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onCancel} className="ghost-button"><ArrowLeft />Back</button>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Scissors aria-hidden="true" className="size-4" />Quick Import
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {busy && <p aria-live="polite" className="rounded-lg bg-primary/10 p-3 text-sm font-medium text-primary">{busy}</p>}

      {/* -------- STEP 1: Upload -------- */}
      {step === 'upload' && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold">Import a question paper PDF</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Questions are sliced as images — formulas, diagrams, and chemistry structures are preserved pixel-perfect.
            </p>
          </div>
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center">
            <Upload aria-hidden="true" className="text-primary" />
            <span className="font-semibold">Choose your question paper PDF</span>
            <span className="text-sm text-muted-foreground">Question numbers are auto-detected from the text layer</span>
            <input className="sr-only" type="file" accept="application/pdf" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
          <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <li className="rounded-lg border border-border bg-card p-3">
              <strong className="block text-foreground">1. Auto-slice</strong>
              Question starts are detected from the PDF text layer
            </li>
            <li className="rounded-lg border border-border bg-card p-3">
              <strong className="block text-foreground">2. Adjust cuts &amp; tag</strong>
              Tap to add cuts, assign subjects and marking schemes
            </li>
            <li className="rounded-lg border border-border bg-card p-3">
              <strong className="block text-foreground">3. Paste key</strong>
              Paste an answer key and save
            </li>
          </ol>
        </div>
      )}

      {/* -------- STEP 2: Cuts + Dashboard -------- */}
      {step === 'cuts' && pdf && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Review cut lines</h2>
              <p className="text-sm text-muted-foreground">
                {autoCount > 0
                  ? <><Sparkles aria-hidden="true" className="mr-1 inline size-3.5 text-primary" />{autoCount} cut{autoCount !== 1 ? 's' : ''} auto-detected. Tap the page to add more.</>
                  : 'No text layer found. Tap the page once at the start of each question.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="icon-button" disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Previous page"><ChevronLeft /></button>
              <span className="text-sm font-medium">{page + 1} / {pdf.numPages}</span>
              <button className="icon-button" disabled={page === pdf.numPages - 1} onClick={() => setPage(p => p + 1)} aria-label="Next page"><ChevronRight /></button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            {/* PDF canvas */}
            <div className="flex flex-col gap-3">
              <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
                <canvas
                  ref={canvasRef}
                  onClick={addCut}
                  className="block h-auto w-full cursor-crosshair"
                />
                {currentPageCuts.map((cut, i) => {
                  // Determine if this cut is the last on the page (trailing → continuation)
                  const isTrailing = i === currentPageCuts.length - 1
                  const color = isTrailing ? '#94a3b8' : '#4f46e5'
                  return (
                    <div
                      key={`${cut}-${i}`}
                      className="pointer-events-none absolute inset-x-0 flex items-center"
                      style={{ top: `${cut * 100}%` }}
                    >
                      <div className="h-0.5 flex-1" style={{ backgroundColor: color }} />
                      <button
                        onClick={e => { e.stopPropagation(); removeCut(i) }}
                        className="pointer-events-auto -my-3 flex size-7 items-center justify-center rounded-full text-white shadow"
                        style={{ backgroundColor: color }}
                        aria-label={`Remove cut line ${i + 1}`}
                      >
                        <X className="size-4" />
                      </button>
                      {isTrailing && (
                        <div
                          className="pointer-events-none absolute left-2 -top-5 rounded px-1 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: color }}
                        >
                          continues…
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-6 bg-primary" />solid = question start
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-6 bg-slate-400" />grey = continues to next page
                </span>
              </div>
            </div>

            {/* Dashboard sidebar */}
            <div className="flex flex-col gap-3">
              <SlicingDashboard
                questionCount={Math.max(computeQuestionCount(), 1)}
                subjectMarkers={subjectMarkers}
                sectionMarkers={sectionMarkers}
                onSubjectMarkersChange={setSubjectMarkers}
                onSectionMarkersChange={setSectionMarkers}
              />
              {/* Test meta */}
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Test Settings</p>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" htmlFor="qi-title-c">Title</label>
                  <input id="qi-title-c" value={title} onChange={e => setTitle(e.target.value)} className="field" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" htmlFor="qi-dur-c">Duration (min)</label>
                  <input id="qi-dur-c" type="number" min={1} value={duration} onChange={e => setDuration(+e.target.value)} className="field" />
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-background py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
            <span className="text-sm text-muted-foreground">
              {pageCuts.reduce((n, c) => n + c.length, 0)} cuts total
            </span>
            <button onClick={generateSlices} disabled={!!busy} className="primary-button">
              <Scissors />Slice questions<ArrowRight />
            </button>
          </div>
        </div>
      )}

      {/* -------- STEP 3: Answer key -------- */}
      {step === 'key' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">{slices.length} questions sliced</h2>
              <p className="text-sm text-muted-foreground">Assign answers, then save.</p>
            </div>
            <button onClick={() => setStep('cuts')} className="ghost-button"><ArrowLeft />Back to cuts</button>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="qi-key">
                <ClipboardPaste aria-hidden="true" className="mr-1 inline size-3.5" />
                Paste answer key (single-correct questions)
              </label>
              <textarea
                id="qi-key"
                value={keyText}
                onChange={e => applyKey(e.target.value)}
                rows={2}
                className="field font-mono"
                placeholder={'ACBDA BCDAB…  or  1-A 2-C 3-B…'}
              />
              <p className="text-xs text-muted-foreground">{answeredCount} / {slices.length} answered</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {slices.map((s, i) => {
              const type = resolveType(i)
              const subj = resolveSubject(i)
              const sec = resolveSection(i)
              const subjColor = SUBJECT_COLORS[subj] ?? '#475569'
              return (
                <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">Q{i + 1}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-white"
                        style={{ backgroundColor: subjColor }}
                      >
                        {subj}
                      </span>
                      {sec && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-white"
                          style={{ backgroundColor: SECTION_COLOR }}
                        >
                          {type === 'single' ? 'Single' : type === 'multiple' ? 'Multi' : 'Num'}
                        </span>
                      )}
                    </div>
                    {/* Answer input area */}
                    {type === 'single' && (
                      <div className="flex gap-1">
                        {ANSWERS.map(a => (
                          <button
                            key={a}
                            onClick={() => setSlices(all => all.map((q, j) => j === i ? { ...q, answer: a } : q))}
                            className={`size-9 rounded-md border text-sm font-semibold transition-colors ${s.answer === a ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted'}`}
                            aria-label={`Question ${i + 1} answer ${a}`}
                          >{a}</button>
                        ))}
                      </div>
                    )}
                    {type === 'multiple' && (
                      <div className="flex gap-1">
                        {ANSWERS.map(a => (
                          <button
                            key={a}
                            onClick={() => toggleMultiAnswer(i, a)}
                            className={`size-9 rounded-md border text-sm font-semibold transition-colors ${(s.answers ?? []).includes(a) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted'}`}
                            aria-label={`Toggle answer ${a} for question ${i + 1}`}
                          >{a}</button>
                        ))}
                      </div>
                    )}
                    {type === 'numerical' && (
                      <div className="flex items-center gap-1.5">
                        <Hash className="size-4 text-muted-foreground" />
                        <input
                          type="text"
                          value={s.numerical ?? ''}
                          onChange={e => setSlices(all => all.map((q, j) => j === i ? { ...q, numerical: e.target.value } : q))}
                          placeholder="numeric answer"
                          className="field h-9 w-32 py-0 text-sm"
                          aria-label={`Numerical answer for question ${i + 1}`}
                        />
                      </div>
                    )}
                  </div>
                  <img
                    src={s.image || '/placeholder.svg'}
                    alt={`Question ${i + 1}`}
                    className="max-h-44 w-full rounded border border-border bg-white object-contain object-top"
                  />
                </div>
              )
            })}
          </div>

          <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-background py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
            <span className="text-sm text-muted-foreground">
              {answeredCount < slices.length
                ? `${slices.length - answeredCount} questions without an answer`
                : 'Answer key complete'}
            </span>
            <button onClick={save} className="primary-button"><Save />Save test</button>
          </div>
        </div>
      )}
    </div>
  )
}
