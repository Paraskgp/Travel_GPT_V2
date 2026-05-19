'use client'

import { useState, FormEvent } from 'react'
import { Preferences } from '@/lib/types'

const INTERESTS = ['Food', 'Hiking', 'Nature', 'Culture', 'Adventure', 'Arts', 'Nightlife', 'Family']
const DIETARY   = ['Vegetarian', 'Vegan', 'Halal']
const PARTY     = [{ label: 'Solo', value: 'solo' }, { label: 'Couple', value: 'couple' }, { label: 'Family', value: 'family_young' }, { label: 'Group', value: 'group' }]

interface Props {
  onSubmit: (destination: string, month: string, prefs: Preferences) => void
  loading: boolean
  compact?: boolean  // true once board is showing
}

export default function InputForm({ onSubmit, loading, compact = false }: Props) {
  const [destination, setDestination] = useState('')
  const [month, setMonth] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [dietary, setDietary] = useState<string[]>([])
  const [partyType, setPartyType] = useState('')
  const [expanded, setExpanded] = useState(false)

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!destination.trim()) return
    const prefs: Preferences = {
      ...(interests.length && { interests: interests.map(i => i.toLowerCase()) }),
      ...(dietary.length   && { dietary: dietary.map(d => d.toLowerCase()) }),
      ...(partyType        && { party_type: partyType }),
    }
    onSubmit(destination.trim(), month.trim(), prefs)
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
        <input
          value={destination}
          onChange={e => setDestination(e.target.value)}
          placeholder="Destination"
          className="border border-stone-300 rounded px-2.5 py-1.5 text-sm w-44 focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
        <input
          value={month}
          onChange={e => setMonth(e.target.value)}
          placeholder="Month (optional)"
          className="border border-stone-300 rounded px-2.5 py-1.5 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
        <button
          type="submit"
          disabled={loading || !destination.trim()}
          className="bg-stone-900 text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-40 hover:bg-stone-800 transition-colors"
        >
          {loading ? 'Generating…' : 'New search'}
        </button>
      </form>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-stone-900 mb-4">Where are you going?</h2>
        </div>

        <div className="space-y-3">
          <input
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="City, region, island, national park…"
            required
            autoFocus
            className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <input
            value={month}
            onChange={e => setMonth(e.target.value)}
            placeholder="Travel month (e.g. April, March 2025)"
            className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>

        {/* Preferences — collapsed by default */}
        <div>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            {expanded ? '▲ Hide preferences' : '▼ Add preferences (optional)'}
          </button>

          {expanded && (
            <div className="mt-3 space-y-3 border border-stone-200 rounded-lg p-3 bg-white">
              {/* Interests */}
              <div>
                <p className="text-xs text-stone-500 mb-1.5 font-medium">Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {INTERESTS.map(i => (
                    <button
                      key={i} type="button"
                      onClick={() => setInterests(v => toggleArr(v, i))}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        interests.includes(i)
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'border-stone-300 text-stone-600 hover:border-stone-400'
                      }`}
                    >{i}</button>
                  ))}
                </div>
              </div>

              {/* Dietary */}
              <div>
                <p className="text-xs text-stone-500 mb-1.5 font-medium">Dietary</p>
                <div className="flex flex-wrap gap-1.5">
                  {DIETARY.map(d => (
                    <button
                      key={d} type="button"
                      onClick={() => setDietary(v => toggleArr(v, d))}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        dietary.includes(d)
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'border-stone-300 text-stone-600 hover:border-stone-400'
                      }`}
                    >{d}</button>
                  ))}
                </div>
              </div>

              {/* Party type */}
              <div>
                <p className="text-xs text-stone-500 mb-1.5 font-medium">Traveling as</p>
                <div className="flex flex-wrap gap-1.5">
                  {PARTY.map(p => (
                    <button
                      key={p.value} type="button"
                      onClick={() => setPartyType(v => v === p.value ? '' : p.value)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        partyType === p.value
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'border-stone-300 text-stone-600 hover:border-stone-400'
                      }`}
                    >{p.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !destination.trim()}
          className="w-full bg-stone-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-stone-800 transition-colors"
        >
          {loading ? 'Generating your board…' : 'Discover →'}
        </button>
      </form>
    </div>
  )
}
