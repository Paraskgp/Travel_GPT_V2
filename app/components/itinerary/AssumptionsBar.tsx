'use client'

import { useState, useRef, useEffect } from 'react'

interface Assumption {
  key: string
  icon: string
  label: string
  value: string
  sublabel?: string
  editable: boolean
}

interface Props {
  stayArea: string
  stayReason: string
  onStayAreaChange: (newArea: string) => void
  hasChanges: boolean
}

export default function AssumptionsBar({ stayArea, stayReason, onStayAreaChange, hasChanges }: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingKey && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingKey])

  function startEdit(key: string, currentValue: string) {
    setDraft(currentValue)
    setEditingKey(key)
  }

  function commitEdit(key: string) {
    if (key === 'stay_area' && draft.trim()) {
      onStayAreaChange(draft.trim())
    }
    setEditingKey(null)
  }

  function cancelEdit() {
    setEditingKey(null)
  }

  const assumptions: Assumption[] = [
    {
      key: 'stay_area',
      icon: '📍',
      label: 'Staying near',
      value: stayArea,
      sublabel: stayReason,
      editable: true,
    },
  ]

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Planning assumptions</p>

      {assumptions.map(a => (
        <div key={a.key}>
          {editingKey === a.key ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">{a.icon}</span>
              <span className="text-xs text-stone-500 font-medium shrink-0">{a.label}:</span>
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit(a.key)
                  if (e.key === 'Escape') cancelEdit()
                }}
                className="flex-1 text-xs border border-stone-300 rounded px-2 py-1 text-stone-900 bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                placeholder={a.value}
              />
              <button
                onClick={() => commitEdit(a.key)}
                className="text-xs px-2 py-1 bg-stone-900 text-white rounded hover:bg-stone-700 transition-colors"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2 group">
              <span className="text-sm mt-0.5">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-stone-500 font-medium">{a.label}:</span>
                  <span className="text-xs font-semibold text-stone-900">{a.value}</span>
                  {a.editable && (
                    <button
                      onClick={() => startEdit(a.key, a.value)}
                      className="text-stone-300 hover:text-stone-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Edit"
                    >
                      ✏️
                    </button>
                  )}
                </div>
                {a.sublabel && (
                  <p className="text-xs text-stone-400 leading-snug mt-0.5">{a.sublabel}</p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {hasChanges && (
        <p className="text-xs text-amber-600 mt-1">
          ↑ Assumption changed — hit &ldquo;Replan with changes&rdquo; to update your itinerary.
        </p>
      )}
    </div>
  )
}
