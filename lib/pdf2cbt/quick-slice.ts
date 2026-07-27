import type { Answer } from './types'

export const RENDER_SCALE = 2

export async function loadPdfDocument(file: File) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
}

/**
 * Detects the top edge of each question on a page using the PDF text layer.
 * Returns cut positions as fractions of page height (0 = top, 1 = bottom).
 * Works fully offline with pdf.js -- no AI, no API keys, no cost.
 */
export async function detectQuestionCuts(pdfPage: any): Promise<number[]> {
  try {
    const viewport = pdfPage.getViewport({ scale: 1 })
    const text = await pdfPage.getTextContent()
    const candidates: { y: number; num: number }[] = []

    for (const item of text.items as any[]) {
      const str = (item.str || '').trim()
      if (!str) continue
      // Match "1.", "1)", "Q1.", "Q.12", "12:" or "3. A ball..." at the start of a line
      const match = str.match(/^(?:Q\.?\s*)?(\d{1,3})\s*[.):]/) || str.match(/^(?:Q\.?\s*)?(\d{1,3})$/)
      if (!match) continue
      const num = Number(match[1])
      if (num < 1 || num > 400) continue
      const [x, yPdf] = [item.transform[4], item.transform[5]]
      // Question numbers sit near the left margin (left 22% of the page)
      if (x > viewport.width * 0.22) continue
      const fontHeight = Math.abs(item.transform[3]) || 10
      // Convert PDF bottom-left origin to top-based fraction, padded above the number
      const yTop = viewport.height - yPdf - fontHeight
      candidates.push({ y: Math.max(0, yTop / viewport.height - 0.006), num })
    }

    candidates.sort((a, b) => a.y - b.y)

    // Keep a plausible, increasing question-number sequence; drop noise (years, page numbers)
    const cuts: number[] = []
    let lastNum = 0
    for (const c of candidates) {
      const isNext = c.num > lastNum && c.num - lastNum <= 5
      const isFirst = cuts.length === 0
      if (!isFirst && !isNext) continue
      if (cuts.length && c.y - cuts[cuts.length - 1] < 0.02) continue
      cuts.push(c.y)
      lastNum = c.num
    }
    return cuts
  } catch {
    return []
  }
}

export async function renderPageToCanvas(pdfPage: any, scale = RENDER_SCALE): Promise<HTMLCanvasElement> {
  const viewport = pdfPage.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await pdfPage.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
  return canvas
}

export interface Strip {
  canvas: HTMLCanvasElement
  yStart: number
  yEnd: number
}

/**
 * Cuts a page only between adjacent markers. Page edges are never treated as
 * markers, and markers cannot pair across pages.
 */
export function slicePage(canvas: HTMLCanvasElement, cuts: number[]): Strip[] {
  const sorted = cuts
    .filter(cut => Number.isFinite(cut))
    .map(cut => Math.min(1, Math.max(0, cut)))
    .sort((a, b) => a - b)
  const strips: Strip[] = []

  for (let i = 0; i < sorted.length - 1; i++) {
    const yStart = sorted[i]
    const yEnd = sorted[i + 1]
    const y = Math.round(yStart * canvas.height)
    const h = Math.round((yEnd - yStart) * canvas.height)
    if (h < canvas.height * 0.015) continue

    const out = document.createElement('canvas')
    out.width = canvas.width
    out.height = h
    out.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
    strips.push({ canvas: out, yStart, yEnd })
  }

  return strips
}

const LETTERS = new Set(['A', 'B', 'C', 'D'])

/**
 * Parses an answer key from freeform text.
 * Supports: "ACBDA BCD...", "1-A 2-C 3.B 4) D", "1:A, 2:B", one per line, etc.
 */
export function parseAnswerKey(input: string, count: number): (Answer | undefined)[] {
  const result: (Answer | undefined)[] = new Array(count).fill(undefined)
  const numbered = [...input.matchAll(/(\d{1,3})\s*[-.):=]?\s*\(?([A-Da-d])\)?(?![a-z])/g)]

  if (numbered.length >= Math.min(count, 2)) {
    for (const m of numbered) {
      const idx = Number(m[1]) - 1
      if (idx >= 0 && idx < count) result[idx] = m[2].toUpperCase() as Answer
    }
    if (result.some(Boolean)) return result
  }

  // Fallback: sequential letter stream
  const letters = input.toUpperCase().split('').filter(ch => LETTERS.has(ch))
  for (let i = 0; i < Math.min(letters.length, count); i++) result[i] = letters[i] as Answer
  return result
}

/**
 * Parses subject ranges like "Physics 1-30, Chemistry 31-60, Maths 61-90".
 * Returns a subject for each question index, defaulting to fallback.
 */
export function parseSubjectRanges(input: string, count: number, fallback: string): string[] {
  const result = new Array(count).fill(fallback)
  const matches = [...input.matchAll(/([A-Za-z][A-Za-z ]*?)\s*(\d{1,3})\s*[-–to ]+\s*(\d{1,3})/g)]
  for (const m of matches) {
    const name = m[1].trim()
    const from = Number(m[2]) - 1
    const to = Number(m[3]) - 1
    for (let i = Math.max(0, from); i <= Math.min(count - 1, to); i++) result[i] = name
  }
  return result
}
