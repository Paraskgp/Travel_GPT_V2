'use client'

import { useState, FormEvent } from 'react'
import { Preferences } from '@/lib/types'

const INTERESTS = ['Food', 'Hiking', 'Nature', 'Culture', 'Adventure', 'Arts', 'Nightlife', 'Family']
const DIETARY   = ['Vegetarian', 'Vegan', 'Halal']
const PARTY     = [{ label: 'Solo', value: 'solo' }, { label: 'Couple', value: 'couple' }, { label: 'Family', value: 'family_young' }, { label: 'Group', value: 'group' }]

interface Props {
  onSubmit: (destination: string, startDate: string, endDate: string, arrivalTime: string, departureTime: string, prefs: Preferences) => void
  loading: boolean
  compact?: boolean
}

const inputCls = "border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
const inputSmCls = "border border-stone-300 rounded px-2.5 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 bg-white"

export default function InputForm({ onSubmit, loading, compact = false }: Props) {
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate]     = useState('')
  const [endDate, setEndDate]         = useState('')
  const [arrivalTime, setArrivalTime]       = useState('')
  const [departureTime, setDepartureTime]   = useState('')
  const [interests, setInterests]           = useState<string[]>([])
  const [dietary, setDietary]         = useState<string[]>([])
  const [partyType, setPartyType]     = useState('')
  const [expanded, setExpanded]       = useState(false)

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
    onSubmit(destination.trim(), startDate, endDate, arrivalTime, departureTime, prefs)
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
        <input
          value={destination}
          onChange={e => setDestination(e.target.value)}
          placeholder="Destination"
          className={`${inputSmCls} w-40`}
        />
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className={`${inputSmCls} w-36`}
        />
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className={`${inputSmCls} w-36`}
        />
        <button
          type="submit"
          disabled={loading || !destination.trim()}
          className="bg-stone-900 text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-40 hover:bg-stone-800 transition-colors"
        >
          {loading ? 'Generating…' : 'Search'}
        </button>
      </form>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-4">
        <h2 className="text-xl font-semibold text-stone-900">Where are you going?</h2>

        <div className="space-y-3">
          {/* Destination */}
          <input
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="City, region, island, national park…"
            required
            autoFocus
            className={`w-full ${inputCls}`}
          />

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-stone-500 mb-1 font-medium">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={`w-full ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1 font-medium">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                min={startDate || undefined}
                className={`w-full ${inputCls}`}
              />
            </div>
          </div>

          {/* Arrival + Departure time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-stone-500 mb-1 font-medium">
                Arrival time <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={arrivalTime}
                onChange={e => setArrivalTime(e.target.value)}
                className={`w-full ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1 font-medium">
                Departure time <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={departureTime}
                onChange={e => setDepartureTime(e.target.value)}
                className={`w-full ${inputCls}`}
              />
            </div>
          </div>
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
