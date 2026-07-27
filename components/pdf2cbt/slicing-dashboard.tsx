'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { SECTION_PRESETS, SUBJECT_COLORS, SECTION_COLOR } from '@/lib/pdf2cbt/scoring'
import type { SectionMarker, SubjectMarker, QuestionType, Marks } from '@/lib/pdf2cbt/types'

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics'] as const

interface Props {
  questionCount: number
  subjectMarkers: SubjectMarker[]
  sectionMarkers: SectionMarker[]
  onSubjectMarkersChange: (m: SubjectMarker[]) => void
  onSectionMarkersChange: (m: SectionMarker[]) => void
}

function SubjectMarkerRow({
  marker,
  onChange,
  onDelete,
  questionCount,
}: {
  marker: SubjectMarker
  onChange: (m: SubjectMarker) => void
  onDelete: () => void
  questionCount: number
}) {
  const color = SUBJECT_COLORS[marker.subject] ?? '#475569'
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <select
        value={marker.subject}
        onChange={e => onChange({ ...marker, subject: e.target.value as typeof SUBJECTS[number] })}
        className="field h-9 flex-1 min-w-0 py-0 text-sm"
      >
        {SUBJECTS.map(s => <option key={s}>{s}</option>)}
      </select>
      <span className="text-xs text-muted-foreground shrink-0">Q</span>
      <input
        type="number"
        min={1}
        max={questionCount}
        value={marker.from + 1}
        onChange={e => onChange({ ...marker, from: Math.max(0, Number(e.target.value) - 1) })}
        className="field h-9 w-14 py-0 text-center text-sm"
        aria-label="From question"
      />
      <span className="text-xs text-muted-foreground shrink-0">–</span>
      <input
        type="number"
        min={1}
        max={questionCount}
        value={marker.to + 1}
        onChange={e => onChange({ ...marker, to: Math.max(0, Number(e.target.value) - 1) })}
        className="field h-9 w-14 py-0 text-center text-sm"
        aria-label="To question"
      />
      <button onClick={onDelete} className="icon-button size-9 shrink-0 text-destructive" aria-label="Remove subject marker">
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}

function SectionMarkerRow({
  marker,
  onChange,
  onDelete,
  questionCount,
}: {
  marker: SectionMarker
  onChange: (m: SectionMarker) => void
  onDelete: () => void
  questionCount: number
}) {
  const preset = SECTION_PRESETS.find(p => p.id === marker.schemeId)
  const type = marker.type

  function applyPreset(id: string) {
    const p = SECTION_PRESETS.find(p => p.id === id)
    if (!p) return
    onChange({
      ...marker,
      schemeId: p.id,
      type: p.type,
      marks: { correct: p.correct, wrong: p.wrong, partial: p.partial },
      label: p.name,
    })
  }

  function patchMarks(patch: Partial<Marks>) {
    onChange({ ...marker, marks: { ...marker.marks, ...patch } })
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2 dark:border-rose-900/50 dark:bg-rose-950/20">
      <div className="flex items-center gap-2">
        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: SECTION_COLOR }} />
        <select
          value={marker.schemeId}
          onChange={e => e.target.value === 'custom' ? onChange({ ...marker, schemeId: 'custom' }) : applyPreset(e.target.value)}
          className="field h-9 flex-1 min-w-0 py-0 text-sm"
        >
          {SECTION_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="custom">Custom Section</option>
        </select>
        <button onClick={onDelete} className="icon-button size-9 shrink-0 text-destructive" aria-label="Remove section marker">
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Q range */}
      <div className="flex items-center gap-2 pl-5">
        <span className="text-xs text-muted-foreground shrink-0">Q</span>
        <input
          type="number"
          min={1}
          max={questionCount}
          value={marker.from + 1}
          onChange={e => onChange({ ...marker, from: Math.max(0, Number(e.target.value) - 1) })}
          className="field h-9 w-14 py-0 text-center text-sm"
          aria-label="From question"
        />
        <span className="text-xs text-muted-foreground shrink-0">–</span>
        <input
          type="number"
          min={1}
          max={questionCount}
          value={marker.to + 1}
          onChange={e => onChange({ ...marker, to: Math.max(0, Number(e.target.value) - 1) })}
          className="field h-9 w-14 py-0 text-center text-sm"
          aria-label="To question"
        />
        <span className="ml-auto text-xs font-medium text-muted-foreground capitalize">{type}</span>
      </div>

      {/* Custom marks editor */}
      {marker.schemeId === 'custom' && (
        <div className="grid grid-cols-2 gap-2 pl-5 sm:grid-cols-4">
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-muted-foreground">Type</label>
            <select
              value={type}
              onChange={e => onChange({ ...marker, type: e.target.value as QuestionType })}
              className="field h-9 py-0 text-sm"
            >
              <option value="single">Single</option>
              <option value="multiple">Multiple</option>
              <option value="numerical">Numerical</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-muted-foreground">+Correct</label>
            <input
              type="number"
              value={marker.marks.correct}
              onChange={e => patchMarks({ correct: Number(e.target.value) })}
              className="field h-9 py-0 text-sm"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-muted-foreground">−Wrong</label>
            <input
              type="number"
              value={marker.marks.wrong}
              onChange={e => patchMarks({ wrong: Number(e.target.value) })}
              className="field h-9 py-0 text-sm"
            />
          </div>
          {type === 'multiple' && (
            <div className="flex flex-col gap-0.5">
              <label className="text-[11px] text-muted-foreground">Partial</label>
              <input
                type="number"
                value={marker.marks.partial ?? 0}
                onChange={e => patchMarks({ partial: Number(e.target.value) })}
                className="field h-9 py-0 text-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* Type hint */}
      <p className="pl-5 text-[11px] text-muted-foreground">
        {type === 'single' && 'Single option answer'}
        {type === 'multiple' && 'Multiple options can be selected'}
        {type === 'numerical' && 'Numeric input answer box'}
      </p>
    </div>
  )
}

export function SlicingDashboard({ questionCount, subjectMarkers, sectionMarkers, onSubjectMarkersChange, onSectionMarkersChange }: Props) {
  const [subOpen, setSubOpen] = useState(true)
  const [secOpen, setSecOpen] = useState(true)

  function addSubject() {
    const next = subjectMarkers.length
    const sub = SUBJECTS[next % SUBJECTS.length]
    const from = subjectMarkers.length ? subjectMarkers[subjectMarkers.length - 1].to + 1 : 0
    onSubjectMarkersChange([
      ...subjectMarkers,
      { id: crypto.randomUUID(), subject: sub, from, to: Math.max(from, questionCount - 1) },
    ])
  }

  function addSection() {
    const preset = SECTION_PRESETS[0]
    const from = sectionMarkers.length ? sectionMarkers[sectionMarkers.length - 1].to + 1 : 0
    onSectionMarkersChange([
      ...sectionMarkers,
      {
        id: crypto.randomUUID(),
        schemeId: preset.id,
        from,
        to: Math.max(from, questionCount - 1),
        type: preset.type,
        marks: { correct: preset.correct, wrong: preset.wrong, partial: preset.partial },
        label: preset.name,
      },
    ])
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Slicing Dashboard</p>

      {/* Subject markers */}
      <div>
        <button
          onClick={() => setSubOpen(o => !o)}
          className="flex w-full items-center justify-between gap-2 text-sm font-semibold"
        >
          <span className="flex items-center gap-2">
            <span className="flex gap-1">
              {SUBJECTS.map(s => (
                <span key={s} className="size-2.5 rounded-full" style={{ backgroundColor: SUBJECT_COLORS[s] }} />
              ))}
            </span>
            Subject Markers
          </span>
          {subOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {subOpen && (
          <div className="mt-2 flex flex-col gap-2">
            {subjectMarkers.length === 0 && (
              <p className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
                Add subject markers to tag question ranges as Physics, Chemistry, or Mathematics.
              </p>
            )}
            {subjectMarkers.map((m, i) => (
              <SubjectMarkerRow
                key={m.id}
                marker={m}
                questionCount={questionCount}
                onChange={updated => onSubjectMarkersChange(subjectMarkers.map((x, j) => j === i ? updated : x))}
                onDelete={() => onSubjectMarkersChange(subjectMarkers.filter((_, j) => j !== i))}
              />
            ))}
            <button onClick={addSubject} className="ghost-button self-start text-xs">
              <Plus className="size-3.5" />Add subject marker
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Section markers */}
      <div>
        <button
          onClick={() => setSecOpen(o => !o)}
          className="flex w-full items-center justify-between gap-2 text-sm font-semibold"
        >
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: SECTION_COLOR }} />
            Section / Marking Scheme
          </span>
          {secOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {secOpen && (
          <div className="mt-2 flex flex-col gap-2">
            {sectionMarkers.length === 0 && (
              <p className="rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
                Add sections to apply JEE-style marking schemes (+4, −1 Single / +4, −2 Multiple / +4, −1 Numerical etc.) to question ranges.
              </p>
            )}
            {sectionMarkers.map((m, i) => (
              <SectionMarkerRow
                key={m.id}
                marker={m}
                questionCount={questionCount}
                onChange={updated => onSectionMarkersChange(sectionMarkers.map((x, j) => j === i ? updated : x))}
                onDelete={() => onSectionMarkersChange(sectionMarkers.filter((_, j) => j !== i))}
              />
            ))}
            <button onClick={addSection} className="ghost-button self-start text-xs">
              <Plus className="size-3.5" />Add section marker
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
