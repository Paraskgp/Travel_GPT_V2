'use client'

import { useMemo, useState, FormEvent } from 'react'
import { Preferences } from '@/lib/types'
import { DESTINATION_OPTIONS, getDestinationByName } from '@/lib/destinations/catalog'

const INTERESTS = ['Food', 'Hiking', 'Nature', 'Culture', 'Adventure', 'Arts', 'Nightlife', 'Family']
const DIETARY = ['Vegetarian', 'Vegan', 'Halal']
const PARTY = [
  { label: 'Solo', value: 'solo' },
  { label: 'Couple', value: 'couple' },
  { label: 'Family', value: 'family_young' },
  { label: 'Group', value: 'group' },
]
const PACE = [
  { label: 'Relaxed', value: 'relaxed' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Packed', value: 'packed' },
]
const BUDGET = [
  { label: 'Budget', value: 'budget' },
  { label: 'Mid', value: 'mid' },
  { label: 'Premium', value: 'premium' },
]
const AVOID = ['Crowds', 'Extreme physical', 'Expensive', 'Tourist traps', 'Alcohol']

interface Props {
  onSubmit: (destination: string, startDate: string, endDate: string, arrivalTime: string, departureTime: string, prefs: Preferences) => void
  loading: boolean
  compact?: boolean
  destination?: string
  onBack?: () => void
}

const inputCls = 'border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-500 bg-white'
const inputSmCls = 'border border-stone-300 rounded px-2.5 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-500 bg-white'

export default function InputForm({ onSubmit, loading, compact = false, destination, onBack }: Props) {
  const [selectedDestination, setSelectedDestination] = useState(destination ?? DESTINATION_OPTIONS[0].name)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [arrivalTime, setArrivalTime] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [dietary, setDietary] = useState<string[]>([])
  const [avoid, setAvoid] = useState<string[]>([])
  const [partyType, setPartyType] = useState('')
  const [pace, setPace] = useState('moderate')
  const [budget, setBudget] = useState('mid')

  const destinationDetails = useMemo(() => getDestinationByName(selectedDestination), [selectedDestination])
  const isComplete = Boolean(selectedDestination && startDate && endDate && arrivalTime && departureTime)

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isComplete) return
    const prefs: Preferences = {
      pace,
      budget,
      ...(interests.length && { interests: interests.map(i => i.toLowerCase()) }),
      ...(dietary.length && { dietary: dietary.map(d => d.toLowerCase()) }),
      ...(avoid.length && { avoid: avoid.map(item => item.toLowerCase().replace(/\s+/g, '_')) }),
      ...(partyType && { party_type: partyType }),
    }
    onSubmit(selectedDestination, startDate, endDate, arrivalTime, departureTime, prefs)
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
        <select
          value={selectedDestination}
          onChange={e => setSelectedDestination(e.target.value)}
          className={`${inputSmCls} w-56`}
          aria-label="Destination"
        >
          {DESTINATION_OPTIONS.map(option => (
            <option key={option.id} value={option.name}>{option.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          required
          className={`${inputSmCls} w-36`}
          aria-label="Start date"
        />
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          min={startDate || undefined}
          required
          className={`${inputSmCls} w-36`}
          aria-label="End date"
        />
        <input
          type="time"
          value={arrivalTime}
          onChange={e => setArrivalTime(e.target.value)}
          required
          className={`${inputSmCls} w-28`}
          aria-label="Arrival time"
        />
        <input
          type="time"
          value={departureTime}
          onChange={e => setDepartureTime(e.target.value)}
          required
          className={`${inputSmCls} w-28`}
          aria-label="Departure time"
        />
        <button
          type="submit"
          disabled={loading || !isComplete}
          className="bg-stone-900 text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-40 hover:bg-stone-800 transition-colors"
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </form>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f4ed] px-4 py-5 text-stone-950 sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
        <section className="overflow-hidden rounded-lg border border-stone-300 bg-white">
          <div className="relative h-72 bg-stone-200 lg:h-full">
            {destinationDetails ? (
              <img
                src={destinationDetails.imageUrl}
                alt={destinationDetails.imageAlt}
                className="h-full w-full object-cover"
              />
            ) : null}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                {destinationDetails?.region ?? 'Selected destination'}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{selectedDestination}</h1>
              {destinationDetails && (
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">{destinationDetails.pointOfView}</p>
              )}
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="flex flex-col rounded-lg border border-stone-300 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Trip constraints</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">Dates, windows, preferences.</h2>
            </div>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="rounded border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:border-stone-500 hover:text-stone-950"
              >
                Change
              </button>
            )}
          </div>

          <div className="grid gap-5 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-500">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                  className={`w-full ${inputCls}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-500">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  required
                  className={`w-full ${inputCls}`}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-500">Arrival time</label>
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={e => setArrivalTime(e.target.value)}
                  required
                  className={`w-full ${inputCls}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-500">Departure time</label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={e => setDepartureTime(e.target.value)}
                  required
                  className={`w-full ${inputCls}`}
                />
              </div>
            </div>

            <PreferenceGroup title="Traveling as">
              {PARTY.map(option => (
                <ChoiceButton
                  key={option.value}
                  selected={partyType === option.value}
                  onClick={() => setPartyType(value => value === option.value ? '' : option.value)}
                >
                  {option.label}
                </ChoiceButton>
              ))}
            </PreferenceGroup>

            <div className="grid gap-4 sm:grid-cols-2">
              <PreferenceGroup title="Pace">
                {PACE.map(option => (
                  <ChoiceButton
                    key={option.value}
                    selected={pace === option.value}
                    onClick={() => setPace(option.value)}
                  >
                    {option.label}
                  </ChoiceButton>
                ))}
              </PreferenceGroup>

              <PreferenceGroup title="Budget">
                {BUDGET.map(option => (
                  <ChoiceButton
                    key={option.value}
                    selected={budget === option.value}
                    onClick={() => setBudget(option.value)}
                  >
                    {option.label}
                  </ChoiceButton>
                ))}
              </PreferenceGroup>
            </div>

            <PreferenceGroup title="Interests">
              {INTERESTS.map(item => (
                <ChoiceButton
                  key={item}
                  selected={interests.includes(item)}
                  onClick={() => setInterests(value => toggleArr(value, item))}
                >
                  {item}
                </ChoiceButton>
              ))}
            </PreferenceGroup>

            <PreferenceGroup title="Dietary">
              {DIETARY.map(item => (
                <ChoiceButton
                  key={item}
                  selected={dietary.includes(item)}
                  onClick={() => setDietary(value => toggleArr(value, item))}
                >
                  {item}
                </ChoiceButton>
              ))}
            </PreferenceGroup>

            <PreferenceGroup title="Avoid">
              {AVOID.map(item => (
                <ChoiceButton
                  key={item}
                  selected={avoid.includes(item)}
                  onClick={() => setAvoid(value => toggleArr(value, item))}
                >
                  {item}
                </ChoiceButton>
              ))}
            </PreferenceGroup>
          </div>

          <button
            type="submit"
            disabled={loading || !isComplete}
            className="mt-auto w-full rounded-lg bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-40"
          >
            {loading ? 'Building your board...' : 'Build destination board'}
          </button>
        </form>
      </div>
    </main>
  )
}

function PreferenceGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        selected
          ? 'border-stone-950 bg-stone-950 text-white'
          : 'border-stone-300 bg-stone-50 text-stone-700 hover:border-stone-500 hover:bg-white'
      }`}
    >
      {children}
    </button>
  )
}
