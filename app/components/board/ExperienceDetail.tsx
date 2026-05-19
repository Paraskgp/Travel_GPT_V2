'use client'

import { Experience } from '@/lib/types'
import { ShortlistStatus } from '@/lib/shortlist'
import { useEffect } from 'react'

interface Props {
  experience: Experience | null
  status: ShortlistStatus | undefined
  onLike: () => void
  onDismiss: () => void
  onClose: () => void
}

const EFFORT_COLOR = { easy: 'text-green-600', moderate: 'text-amber-600', strenuous: 'text-red-600' }
const EFFORT_BG    = { easy: 'bg-green-50', moderate: 'bg-amber-50', strenuous: 'bg-red-50' }
const COST_LABEL   = { free: 'Free', budget: '$', mid: '$$', premium: '$$$' }
const BOOKING_LABEL = { walk_in: 'Walk-in', reserve_ahead: 'Reserve ahead', hard_to_get: 'Hard to get' }

export default function ExperienceDetail({ experience: exp, status, onLike, onDismiss, onClose }: Props) {
  const isLiked = status === 'liked'
  const isDismissed = status === 'dismissed'

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Trap scroll when open
  useEffect(() => {
    if (exp) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [exp])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-200 ${exp ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col transition-transform duration-250 ease-out ${exp ? 'translate-x-0' : 'translate-x-full'}`}>
        {!exp ? null : (
          <>
            {/* Photo header */}
            <div className="relative bg-stone-100 flex-shrink-0" style={{ height: 220 }}>
              {exp.places_enrichment?.photo_url
                ? <img src={exp.places_enrichment.photo_url} alt={exp.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-stone-300 text-sm">No photo</div>
              }
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm hover:bg-black/70 transition-colors"
              >✕</button>
              {/* Rating badge */}
              {exp.places_enrichment?.rating && (
                <span className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  ★ {exp.places_enrichment.rating}
                  {exp.places_enrichment.review_count && (
                    <span className="ml-1 opacity-70">({exp.places_enrichment.review_count.toLocaleString()})</span>
                  )}
                </span>
              )}
              {/* Maps link */}
              {exp.places_enrichment?.maps_url && (
                <a
                  href={exp.places_enrichment.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded hover:bg-black/80 transition-colors"
                >
                  Open in Maps →
                </a>
              )}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-stone-900 leading-snug">{exp.name}</h2>
                {exp.places_enrichment?.address && (
                  <p className="text-xs text-stone-400 mt-0.5">{exp.places_enrichment.address}</p>
                )}
              </div>

              {/* Meta chips */}
              <div className="flex flex-wrap gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${EFFORT_COLOR[exp.effort]} ${EFFORT_BG[exp.effort]}`}>
                  {exp.effort}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                  {COST_LABEL[exp.cost_band] ?? exp.cost_band}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                  {exp.duration}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                  {BOOKING_LABEL[exp.booking_difficulty] ?? exp.booking_difficulty}
                </span>
              </div>

              <p className="text-sm text-stone-600 leading-relaxed">{exp.long_description}</p>

              <div className="space-y-2.5">
                <DetailRow label="Why worth it" value={exp.why_worth_it} />
                <DetailRow label="Best time" value={exp.best_time} />
                {exp.local_tip && <DetailRow label="Local tip" value={exp.local_tip} />}
                {exp.weather_sensitivity && <DetailRow label="Weather" value={exp.weather_sensitivity} />}
                {exp.watch_out_for && <DetailRow label="Watch out for" value={exp.watch_out_for} />}
              </div>

              {exp.what_to_bring && exp.what_to_bring.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-stone-500 mb-1">What to bring</p>
                  <div className="flex flex-wrap gap-1">
                    {exp.what_to_bring.map(item => (
                      <span key={item} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{item}</span>
                    ))}
                  </div>
                </div>
              )}

              {exp.nearby_pairings && exp.nearby_pairings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-stone-500 mb-1">Pair with</p>
                  <div className="flex flex-wrap gap-1">
                    {exp.nearby_pairings.map(item => (
                      <span key={item} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{item}</span>
                    ))}
                  </div>
                </div>
              )}

              {exp.personalization_note && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">{exp.personalization_note}</p>
                </div>
              )}

              {exp.tags && exp.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {exp.tags.map(tag => (
                    <span key={tag} className="text-xs text-stone-400 border border-stone-200 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="flex-shrink-0 border-t border-stone-100 p-4 flex gap-3">
              <button
                onClick={onDismiss}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  isDismissed
                    ? 'bg-stone-200 border-stone-300 text-stone-600'
                    : 'border-stone-300 text-stone-500 hover:bg-stone-50'
                }`}
              >
                {isDismissed ? 'Skipped' : 'Skip'}
              </button>
              <button
                onClick={onLike}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  isLiked
                    ? 'bg-rose-500 border-rose-500 text-white'
                    : 'border-rose-300 text-rose-500 hover:bg-rose-50'
                }`}
              >
                {isLiked ? '♥ Saved' : '♥ Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-stone-400 mb-0.5">{label}</p>
      <p className="text-sm text-stone-600 leading-snug">{value}</p>
    </div>
  )
}
