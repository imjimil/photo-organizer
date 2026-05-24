import { useCallback, useEffect, useState } from 'react'
import {
  getImage,
  getSimilar,
  mediaUrl,
  type ImageDetail,
  type SearchResult,
} from '../api/client'

interface LightboxProps {
  imageId: string
  onClose: () => void
  onSelect: (id: string) => void
}

export function Lightbox({ imageId, onClose, onSelect }: LightboxProps) {
  const [detail, setDetail] = useState<ImageDetail | null>(null)
  const [similar, setSimilar] = useState<SearchResult[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getImage(imageId).then(setDetail).catch(console.error)
    getSimilar(imageId, 8)
      .then((r) => setSimilar(r.results))
      .catch(console.error)
  }, [imageId])

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [handleKey])

  const copyQuote = async () => {
    if (!detail?.ocr_text) return
    await navigator.clipboard.writeText(detail.ocr_text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex bg-bg-base/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Image detail"
    >
      <button
        type="button"
        className="absolute inset-0 -z-10 cursor-default"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="flex h-full w-full flex-col lg:flex-row">
        <div className="flex flex-1 items-center justify-center overflow-hidden p-4 lg:p-8">
          {detail ? (
            <img
              src={mediaUrl(detail.id)}
              alt=""
              className="max-h-[70vh] max-w-full object-contain lg:max-h-[85vh]"
            />
          ) : (
            <div className="font-mono text-sm text-text-faint">Loading…</div>
          )}
        </div>

        <aside className="flex w-full flex-col border-t border-border bg-bg-elevated lg:w-[min(420px,40vw)] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <span className="font-mono text-xs text-text-faint">Quote</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-sm text-text-muted hover:bg-bg-hover hover:text-text-primary"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            {detail?.ocr_text ? (
              <blockquote className="font-quote text-[1.25rem] leading-[1.6] text-text-primary md:text-[1.5rem]">
                {detail.ocr_text}
              </blockquote>
            ) : (
              <p className="font-quote text-text-muted italic">
                No text extracted yet — this match is visual only.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
            {detail?.ocr_text && (
              <button
                type="button"
                onClick={copyQuote}
                className="rounded-lg border border-border px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
              >
                {copied ? 'Copied' : 'Copy quote'}
              </button>
            )}
          </div>

          {similar.length > 0 && (
            <div className="border-t border-border px-5 py-4">
              <h3 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-text-faint">
                More like this
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {similar.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className="overflow-hidden rounded-md ring-offset-bg-base transition hover:ring-2 hover:ring-accent/40"
                  >
                    <img
                      src={`/api/thumbs/${s.id}`}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
