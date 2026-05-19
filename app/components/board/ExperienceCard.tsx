'use client'

import { Experience } from '@/lib/types'
import { ShortlistStatus } from '@/lib/shortlist'

interface Props {
  experience: Experience
  status: ShortlistStatus | undefined
  onLike: () => void
  onDismiss: () => void
  onSelect: () => void
}

const EFFORT_COLOR = { easy: 'text-green-600', moderate: 'text-amber-600', strenuous: 'text-red-600' }
const COST_LABEL   = { free: 'Free', budget: '$', mid: '$$', premium: '$$$' }

export default function ExperienceCard({ experience: exp, status, onLike, onDismiss, onSelect }: Props) {
  const photo = exp.places_enrichment?.photo_url
  const rating = exp.places_enrichment?.rating
  const isDismissed = status === 'dismissed'
  const isLiked = status === 'liked'

  return (
    <div className={`relative flex flex-col border rounded-lg overflow-hidden bg-white transition-opacity ${isDismissed ? 'opacity-30' : 'opacity-100'}`}
         style={{ width: 210, flexShrink: 0 }}>

      {/* Photo */}
      <div className="relative bg-stone-100" style={{ height: 120 }}>
        {photo
          ? <img src={photo} alt={exp.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">No photo</div>
        }
        {/* Rating badge */}
        {rating && (
          <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
            ★ {rating}
          </span>
        )}
        {/* Liked badge */}
        {isLiked && (
          <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full">♥</span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-2.5 gap-1.5">
        <p className="text-xs font-semibold text-stone-900 leading-tight line-clamp-2">{exp.name}</p>
        <p className="text-xs text-stone-500 leading-snug line-clamp-2">{exp.short_description}</p>

        {/* Meta row */}
        <div className="flex items-center gap-2 text-xs text-stone-400 mt-auto pt-1">
          <span className={EFFORT_COLOR[exp.effort] ?? 'text-stone-400'}>{exp.effort}</span>
          <span>·</span>
          <span>{COST_LABEL[exp.cost_band] ?? exp.cost_band}</span>
          <span>·</span>
          <span>{exp.duration}</span>
        </div>

        {/* Local tip */}
        {exp.local_tip && (
          <p className="text-xs text-stone-400 italic leading-snug line-clamp-2">💡 {exp.local_tip}</p>
        )}

        {/* Personalization flag */}
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
          <div className="flex gap-1.5">
            <button
              onClick={onDismiss}
              title="Skip"
              className={`w-7 h-7 rounded-full border flex items-center justify-center text-sm transition-colors ${
                isDismissed ? 'bg-stone-200 border-stone-300 text-stone-500' : 'border-stone-300 text-stone-400 hover:bg-stone-100'
              }`}
            >✕</button>
            <button
              onClick={onLike}
              title="Save"
              className={`w-7 h-7 rounded-full border flex items-center justify-center text-sm transition-colors ${
                isLiked ? 'bg-rose-500 border-rose-500 text-white' : 'border-stone-300 text-stone-400 hover:bg-rose-50 hover:border-rose-300'
              }`}
            >♥</button>
          </div>
        </div>
      </div>
    </div>
  )
}
