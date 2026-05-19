'use client'

import { DestinationContext } from '@/lib/types'

interface Props {
  destination: string
  context: DestinationContext
}

export default function SpiritView({ destination, context }: Props) {
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      {/* Soul */}
      <div>
        <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Soul</h2>
        <p className="text-sm text-stone-700 leading-relaxed">{context.soul}</p>
      </div>

      {/* Defining pillars */}
      {context.defining_pillars?.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Defining Pillars</h2>
          <ul className="space-y-1.5">
            {context.defining_pillars.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-stone-600">
                <span className="text-stone-300 mt-0.5">→</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Best for */}
      {context.best_for?.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Best For</h2>
          <div className="flex flex-wrap gap-2">
            {context.best_for.map((b, i) => (
              <span key={i} className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full">{b}</span>
            ))}
          </div>
        </div>
      )}

      {/* Honest notes */}
      {context.honest_notes?.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Honest Notes</h2>
          <ul className="space-y-1.5">
            {context.honest_notes.map((n, i) => (
              <li key={i} className="flex gap-2 text-sm text-stone-500">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">!</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
