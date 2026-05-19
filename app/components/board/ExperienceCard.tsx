'use client'

import { Experience } from '@/lib/types'

interface Props {
  experience: Experience
  onSelect: () => void
  // Itinerary status
  showItineraryStatus?: boolean
  isIncluded?: boolean
  isForced?: boolean
  isSkipped?: boolean
  onSkip?: () => void
  onForceInclude?: () => void
  onReset?: () => void
}

const EFFORT_COLOR = { easy: 'text-green-600', moderate: 'text-amber-600', strenuous: 'text-red-600' }
const COST_LABEL   = { free: 'Free', budget: '$', mid: '$$', premium: '$$$' }

export default function ExperienceCard({
  experience: exp, onSelect,
  showItineraryStatus = false,
  isIncluded = false, isForced = false, isSkipped = false,
  onSkip, onForceInclude, onReset,
}: Props) {
  const photo  = exp.places_enrichment?.photo_url
  const rating = exp.places_enrichment?.rating

  return (
    <div
      className={`relative flex flex-col border rounded-lg overflow-hidden bg-white transition-opacity ${isSkipped ? 'opacity-40' : 'opacity-100'}`}
      style={{ width: 210, flexShrink: 0 }}
    >
      {/* Photo */}
      <div className="relative bg-stone-100" style={{ height: 120 }}>
        {photo
          ? <img src={photo} alt={exp.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">No photo</div>
        }
        {rating && (
          <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
            ★ {rating}
          </span>
        )}

        {/* Itinerary status badge */}
        {showItineraryStatus && (
          <span className={`absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${
            isIncluded
              ? 'bg-emerald-500 text-white'
              : isSkipped
              ? 'bg-stone-400 text-white'
              : 'bg-white/80 text-stone-500 border border-stone-200'
          }`}>
            {isIncluded ? '✓ In plan' : isSkipped ? '✕ Skipped' : 'Not in plan'}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-2.5 gap-1.5">
        <p className="text-xs font-semibold text-stone-900 leading-tight line-clamp-2">{exp.name}</p>
        <p className="text-xs text-stone-500 leading-snug line-clamp-2">{exp.short_description}</p>

        <div className="flex items-center gap-2 text-xs text-stone-400 mt-auto pt-1">
          <span className={EFFORT_COLOR[exp.effort] ?? 'text-stone-400'}>{exp.effort}</span>
          <span>·</span>
          <span>{COST_LABEL[exp.cost_band] ?? exp.cost_band}</span>
          <span>·</span>
          <span>{exp.duration}</span>
        </div>

        {exp.local_tip && (
          <p className="text-xs text-stone-400 italic leading-snug line-clamp-2">💡 {exp.local_tip}</p>
        )}

        {exp.personalization_note && (
          <p className="text-xs text-amber-600 leading-snug line-clamp-1">⚠ {exp.personalization_note}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1 mt-auto">
          <button
            onClick={onSelect}
            className="text-xs text-stone-400 hover:text-stone-700 transition-colors underline underline-offset-2"
          >
            Learn more
          </button>

          {showItineraryStatus ? (
            <div className="flex gap-1">
              {isSkipped ? (
                <button
                  onClick={onReset}
                  title="Add back"
                  className="text-xs px-2 py-1 rounded border border-stone-300 text-stone-500 hover:border-stone-500 transition-colors"
                >
                  Add back
                </button>
              ) : isIncluded ? (
                <button
                  onClick={onSkip}
                  title="Skip this"
                  className="text-xs px-2 py-1 rounded border border-stone-300 text-stone-500 hover:border-red-300 hover:text-red-600 transition-colors"
                >
                  Skip
                </button>
              ) : (
                <button
                  onClick={onForceInclude}
                  title="Add to plan"
                  className="text-xs px-2 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  + Add
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
