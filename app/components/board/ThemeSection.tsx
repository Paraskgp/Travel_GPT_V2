'use client'

import { useState } from 'react'
import { Theme, Experience } from '@/lib/types'
import ExperienceCard from './ExperienceCard'

interface Props {
  theme: Theme
  onSelect: (exp: Experience) => void
  defaultOpen?: boolean
  // Itinerary status props — only used when showItineraryStatus is true
  showItineraryStatus?: boolean
  includedIds?: Set<string>
  forcedIds?: Set<string>
  skippedIds?: Set<string>
  onSkip?: (id: string) => void
  onForceInclude?: (id: string) => void
  onReset?: (id: string) => void
}

export default function ThemeSection({
  theme, onSelect, defaultOpen = false,
  showItineraryStatus = false,
  includedIds = new Set(), forcedIds = new Set(), skippedIds = new Set(),
  onSkip, onForceInclude, onReset,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const includedCount = showItineraryStatus
    ? theme.experiences.filter(e => includedIds.has(e.id)).length
    : 0

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 h-10 bg-white hover:bg-stone-50 transition-colors text-left"
      >
        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center border border-stone-300 rounded text-xs font-mono text-stone-500 leading-none">
          {open ? '−' : '+'}
        </span>
        <span className="font-medium text-sm text-stone-900 truncate" title={theme.description}>
          {theme.name}
        </span>
        <span className="flex-shrink-0 text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
          {theme.experiences.length}
        </span>
        {showItineraryStatus && includedCount > 0 && (
          <span className="flex-shrink-0 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            ✓ {includedCount} in plan
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 bg-stone-50 border-t border-stone-100">
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
            {theme.experiences.map(exp => (
              <ExperienceCard
                key={exp.id}
                experience={exp}
                onSelect={() => onSelect(exp)}
                showItineraryStatus={showItineraryStatus}
                isIncluded={includedIds.has(exp.id)}
                isForced={forcedIds.has(exp.id)}
                isSkipped={skippedIds.has(exp.id)}
                onSkip={onSkip ? () => onSkip(exp.id) : undefined}
                onForceInclude={onForceInclude ? () => onForceInclude(exp.id) : undefined}
                onReset={onReset ? () => onReset(exp.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
