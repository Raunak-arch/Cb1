'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Crop, Upload } from 'lucide-react'
import type { Answer } from '@/lib/pdf2cbt/types'

type Target = 'question' | Answer

export function PDFCropper({ onCrop }: { onCrop: (target: Target, url: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<Target>('question')
  const [drag, setDrag] = useState<{ x: number; y: number; endX: number; endY: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let cancelled = false
    pdf.getPage(page).then((pdfPage: any) => {
      if (cancelled || !canvasRef.current) return
      const viewport = pdfPage.getViewport({ scale: 1.5 })
      const canvas = canvasRef.current
      canvas.width = viewport.width
      canvas.height = viewport.height
      pdfPage.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
    })
    return () => { cancelled = true }
  }, [pdf, page])

  async function loadPDF(file: File) {
    setError('')
    try {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      const loaded = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
      setPdf(loaded); setPage(1)
    } catch { setError('This PDF could not be opened. Try a standard, non-password-protected PDF.') }
  }

  function point(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const canvas = canvasRef.current!
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }
  }

  function saveCrop() {
    if (!drag || !canvasRef.current) return
    const x = Math.min(drag.x, drag.endX), y = Math.min(drag.y, drag.endY)
    const width = Math.abs(drag.endX - drag.x), height = Math.abs(drag.endY - drag.y)
    if (width < 15 || height < 15) return
    const out = document.createElement('canvas'); out.width = width; out.height = height
    out.getContext('2d')!.drawImage(canvasRef.current, x, y, width, height, 0, 0, width, height)
    onCrop(target, out.toDataURL('image/jpeg', .88)); setDrag(null)
  }

  const style = drag && canvasRef.current ? {
    left: `${Math.min(drag.x, drag.endX) / canvasRef.current.width * 100}%`, top: `${Math.min(drag.y, drag.endY) / canvasRef.current.height * 100}%`,
    width: `${Math.abs(drag.endX - drag.x) / canvasRef.current.width * 100}%`, height: `${Math.abs(drag.endY - drag.y) / canvasRef.current.height * 100}%`,
  } : undefined

  return <div className="flex min-w-0 flex-col gap-4">
    <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-5 text-center">
      <Upload aria-hidden="true" />
      <span className="font-semibold">Choose a PDF</span><span className="text-sm text-muted-foreground">Your file stays on this device</span>
      <input className="sr-only" type="file" accept="application/pdf" onChange={e => e.target.files?.[0] && loadPDF(e.target.files[0])} />
    </label>
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {pdf && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Crop target">
          {(['question','A','B','C','D'] as Target[]).map(item => <button key={item} onClick={() => setTarget(item)} className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${target === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>{item === 'question' ? 'Question' : item}</button>)}
        </div>
        <div className="flex items-center gap-2"><button className="icon-button" disabled={page === 1} onClick={() => setPage(p => p - 1)} aria-label="Previous PDF page"><ChevronLeft /></button><span className="text-sm font-medium">{page} / {pdf.numPages}</span><button className="icon-button" disabled={page === pdf.numPages} onClick={() => setPage(p => p + 1)} aria-label="Next PDF page"><ChevronRight /></button></div>
      </div>
      <p className="text-sm text-muted-foreground">Select <strong>{target === 'question' ? 'the question' : `option ${target}`}</strong>, then drag over its region.</p>
      <div className="relative touch-none overflow-hidden rounded-lg border border-border bg-muted" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); const p = point(e); setDrag({ ...p, endX:p.x, endY:p.y }) }} onPointerMove={e => { if (!drag) return; const p = point(e); setDrag(d => d && ({...d,endX:p.x,endY:p.y})) }} onPointerUp={saveCrop}>
        <canvas ref={canvasRef} className="block h-auto w-full" />
        {style && <div className="pointer-events-none absolute border-2 border-primary bg-primary/15" style={style} />}
      </div>
      <button onClick={saveCrop} disabled={!drag} className="primary-button self-start"><Crop />Save {target === 'question' ? 'question' : `option ${target}`} crop</button>
    </>}
  </div>
}
