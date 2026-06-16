'use client'

import { useState } from 'react'
import {
  FeedbackBoardContext,
  FeedbackCardContext,
  FeedbackContext,
  FeedbackItineraryContext,
  FeedbackSentiment,
  FeedbackSurface,
} from '@/lib/types'

interface Props {
  surface: FeedbackSurface
  boardContext: FeedbackBoardContext
  cardContext?: FeedbackCardContext
  itineraryContext?: FeedbackItineraryContext
  label?: string
  compact?: boolean
  className?: string
}

const SENTIMENT_OPTIONS: Array<{ value: FeedbackSentiment; label: string }> = [
  { value: 'negative', label: 'Problem' },
  { value: 'correction', label: 'Correction' },
  { value: 'missing', label: 'Missing' },
  { value: 'positive', label: 'Useful' },
  { value: 'other', label: 'Other' },
]

/**
 * Renders a feedback trigger and modal form for board, card, and detail feedback.
 *
 * Submits compact caller-provided context to `/api/feedback`.
 * Keeps failures local to the control and never mutates board or itinerary state.
 */
export default function FeedbackButton({
  surface,
  boardContext,
  cardContext,
  itineraryContext,
  label = 'Feedback',
  compact = false,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const [sentiment, setSentiment] = useState<FeedbackSentiment>('negative')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recorded, setRecorded] = useState(false)

  function resetForm() {
    setMessage('')
    setSentiment('negative')
    setError(null)
    setRecorded(false)
  }

  function close() {
    setOpen(false)
    resetForm()
  }

  async function submitFeedback() {
    const trimmed = message.trim()
    if (trimmed.length < 2) {
      setError('Add a short note first.')
      return
    }

    const context: FeedbackContext = {
      surface,
      page_path: typeof window === 'undefined' ? null : `${window.location.pathname}${window.location.search}`,
      board: boardContext,
      ...(cardContext ? { card: cardContext } : {}),
      ...(itineraryContext ? { itinerary: itineraryContext } : {}),
    }

    setSubmitting(true)
    setError(null)
    setRecorded(false)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentiment, message: trimmed, context }),
      })

      if (!res.ok) {
        const text = await res.text()
        let detail = 'Could not record feedback.'
        try {
          const parsed = JSON.parse(text)
          if (parsed.error) detail = parsed.error
        } catch { /* raw response ignored */ }
        throw new Error(detail)
      }

      setRecorded(true)
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${compact ? 'text-xs px-2 py-1 rounded border border-stone-300 text-stone-500 hover:border-stone-500 hover:text-stone-700' : 'text-xs px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 hover:border-stone-500 hover:text-stone-900'} transition-colors ${className}`}
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className="w-full max-w-sm rounded-lg bg-white shadow-2xl border border-stone-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <div>
                <p id="feedback-dialog-title" className="text-sm font-semibold text-stone-900">Send feedback</p>
                <p className="text-xs text-stone-400">
                  {surface === 'board' ? boardContext.destination : cardContext?.experience_name}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="w-8 h-8 rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                aria-label="Close feedback"
              >
                x
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {SENTIMENT_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSentiment(option.value)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      sentiment === option.value
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 text-stone-500 hover:border-stone-400'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={e => { setMessage(e.target.value); setError(null); setRecorded(false) }}
                maxLength={2000}
                rows={5}
                className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-500"
                placeholder="What should we improve, fix, or keep doing?"
              />

              <div className="min-h-5">
                {error && <p className="text-xs text-red-500">{error}</p>}
                {recorded && <p className="text-xs text-emerald-600">Recorded. Thank you.</p>}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 rounded-lg border border-stone-300 py-2 text-sm text-stone-600 hover:border-stone-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitFeedback}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-stone-900 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
