'use client'

import { useState } from 'react'
import { Theme, Experience } from '@/lib/types'
import { Shortlist, ShortlistStatus } from '@/lib/shortlist'
import ExperienceCard from './ExperienceCard'

interface Props {
  theme: Theme
  shortlist: Shortlist
  onLike: (id: string) => void
  onDismiss: (id: string) => void
  onSelect: (exp: Experience) => void
  defaultOpen?: boolean
}

export default function ThemeSection({ theme, shortlist, onLike, onDismiss, onSelect, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const likedCount = theme.experiences.filter(e => shortlist[e.id] === 'liked').length

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden">
      {/* Accordion header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 h-10 bg-white hover:bg-stone-50 transition-colors text-left"
      >
        {/* Toggle indicator */}
        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center border border-stone-300 rounded text-xs font-mono text-stone-500 leading-none">
          {open ? '−' : '+'}
        </span>

        {/* Theme name — description shown on hover */}
        <span
          className="font-medium text-sm text-stone-900 truncate"
          title={theme.description}
        >
          {theme.name}
        </span>

        {/* Count badge */}
        <span className="flex-shrink-0 text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
          {theme.experiences.length}
        </span>

        {/* Liked badge */}
        {likedCount > 0 && (
          <span className="flex-shrink-0 text-xs text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
            ♥ {likedCount}
          </span>
        )}
      </button>

      {/* Card tray */}
      {open && (
        <div className="px-4 pb-4 pt-3 bg-stone-50 border-t border-stone-100">
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
            {theme.experiences.map(exp => (
              <ExperienceCard
                key={exp.id}
                experience={exp}
                status={shortlist[exp.id] as ShortlistStatus | undefined}
                onLike={() => onLike(exp.id)}
                onDismiss={() => onDismiss(exp.id)}
                onSelect={() => onSelect(exp)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
