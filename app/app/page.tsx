'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Board, Experience, Itinerary, Preferences } from '@/lib/types'
import WelcomeScreen from '@/components/welcome/WelcomeScreen'
import InputForm from '@/components/input/InputForm'
import ThemeSection from '@/components/board/ThemeSection'
import ExperienceDetail from '@/components/board/ExperienceDetail'
import SpiritView from '@/components/board/SpiritView'
import WeatherTable from '@/components/board/WeatherTable'
import MapView from '@/components/map/MapView'
import MapErrorBoundary from '@/components/map/MapErrorBoundary'
import ItineraryView from '@/components/itinerary/ItineraryView'
import AssumptionsBar from '@/components/itinerary/AssumptionsBar'

type Stage = 'welcome' | 'input' | 'loading' | 'board'
type Tab = 'spirit' | 'weather' | 'experiences' | 'map'

export default function Home() {
  const [stage, setStage]       = useState<Stage>('welcome')
  const [tab, setTab]           = useState<Tab>('experiences')
  const [board, setBoard]       = useState<Board | null>(null)
  const [tripDates, setTripDates] = useState<{ startDate: string; endDate: string; arrivalTime: string; departureTime: string } | null>(null)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError]     = useState<string | null>(null)
  const [loadingPhase, setLoadingPhase] = useState<'board' | 'plan'>('board')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [selected, setSelected] = useState<Experience | null>(null)

  // User itinerary signals — accumulated between replans
  const [forcedIds, setForcedIds]     = useState<Set<string>>(new Set())
  const [skippedIds, setSkippedIds]   = useState<Set<string>>(new Set())
  const [stayArea, setStayArea]       = useState<string>('')
  const [stayAreaChanged, setStayAreaChanged] = useState(false)

  // Derive which experience IDs are currently in the itinerary
  const includedIds = useMemo<Set<string>>(() => {
    if (!itinerary) return new Set()
    const ids = new Set<string>()
    for (const day of itinerary.days) {
      for (const row of day.rows) {
        if (row.experience_id) ids.add(row.experience_id)
      }
    }
    return ids
  }, [itinerary])

  async function callPlan(
    currentBoard: Board,
    dates: { startDate: string; endDate: string; arrivalTime: string; departureTime: string },
    forced: string[],
    skipped: string[],
    area?: string
  ): Promise<Itinerary | null> {
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board: currentBoard,
        start_date: dates.startDate,
        end_date: dates.endDate,
        arrival_time: dates.arrivalTime || undefined,
        departure_time: dates.departureTime || undefined,
        stay_area: area || undefined,
        forced_ids: forced,
        skipped_ids: skipped,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      let message = text
      try {
        const parsed = JSON.parse(text)
        if (parsed.error) message = parsed.error
      } catch { /* not JSON, use raw text */ }
      throw new Error(message)
    }
    const { itinerary: plan } = await res.json()
    return plan
  }

  async function handleGenerate(
    destination: string,
    startDate: string,
    endDate: string,
    arrivalTime: string,
    departureTime: string,
    prefs: Preferences
  ) {
    setLoading(true)
    setError(null)
    setStage('loading')
    setBoard(null)
    setItinerary(null)
    setPlanError(null)
    setForcedIds(new Set())
    setSkippedIds(new Set())
    setLoadingPhase('board')

    const dates = startDate ? { startDate, endDate, arrivalTime, departureTime } : null
    setTripDates(dates)

    try {
      // Step 1: generate board
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          ...(startDate     && { start_date: startDate }),
          ...(endDate       && { end_date: endDate }),
          ...(arrivalTime   && { arrival_time: arrivalTime }),
          ...(departureTime && { departure_time: departureTime }),
          preferences: prefs,
        }),
      })
      if (!genRes.ok) {
        const text = await genRes.text()
        let message = text
        try { const p = JSON.parse(text); if (p.error) message = p.error } catch { /* raw */ }
        throw new Error(message)
      }
      const { board: raw }: { board: Board } = await genRes.json()

      // Client-side ID dedup (safety net)
      const seenIds = new Set<string>()
      const generatedBoard: Board = {
        ...raw,
        themes: raw.themes.map(t => ({
          ...t,
          experiences: t.experiences.filter(e => {
            if (seenIds.has(e.id)) return false
            seenIds.add(e.id)
            return true
          }),
        })).filter(t => t.experiences.length > 0),
      }
      setBoard(generatedBoard)
      const defaultStayArea = generatedBoard.destination_context.recommended_stay_area ?? ''
      setStayArea(defaultStayArea)
      setStayAreaChanged(false)

      // Board is ready — show it immediately. Itinerary is on-demand via the CTA button.
      setStage('board')
      setTab('experiences')

      // Step 3: enrich in background (fire and forget)
      const allExps = generatedBoard.themes.flatMap(t => t.experiences)
      const mappable = allExps.filter(e => e.is_mappable)
      if (mappable.length > 0) {
        fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination: generatedBoard.destination,
            experiences: mappable.map(e => ({
              id: e.id,
              name: e.name,
              location_hint: e.location_hint,
              is_mappable: e.is_mappable,
            })),
          }),
        })
          .then(r => r.json())
          .then(({ enriched }) => {
            const lookup = Object.fromEntries(enriched.map((e: { id: string; places_enrichment: Experience['places_enrichment'] }) => [e.id, e.places_enrichment]))
            setBoard(prev => {
              if (!prev) return prev
              return {
                ...prev,
                themes: prev.themes.map(t => ({
                  ...t,
                  experiences: t.experiences.map(e => ({
                    ...e,
                    places_enrichment: lookup[e.id] ?? e.places_enrichment,
                  })),
                })),
              }
            })
            setSelected(prev => {
              if (!prev) return prev
              return lookup[prev.id] !== undefined ? { ...prev, places_enrichment: lookup[prev.id] } : prev
            })
          })
          .catch(() => {})
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('input')
    } finally {
      setLoading(false)
    }
  }

  async function handleReplan() {
    if (!board || !tripDates) return
    setPlanLoading(true)
    setPlanError(null)
    setError(null)
    try {
      const plan = await callPlan(
        board,
        tripDates,
        Array.from(forcedIds),
        Array.from(skippedIds),
        stayArea
      )
      setItinerary(plan)
      setStayAreaChanged(false)
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to replan')
    } finally {
      setPlanLoading(false)
    }
  }

  function handleStayAreaChange(newArea: string) {
    setStayArea(newArea)
    setStayAreaChanged(true)
  }

  function handleSkip(id: string) {
    setSkippedIds(prev => { const n = new Set(prev); n.add(id); return n })
    setForcedIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  function handleForceInclude(id: string) {
    setForcedIds(prev => { const n = new Set(prev); n.add(id); return n })
    setSkippedIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  function handleReset(id: string) {
    setForcedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    setSkippedIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const hasPendingChanges = forcedIds.size > 0 || skippedIds.size > 0 || stayAreaChanged

  if (stage === 'welcome') {
    return <WelcomeScreen onStart={() => setStage('input')} />
  }

  if (stage === 'input') {
    return (
      <div>
        {error && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2 rounded-lg z-50">
            {error}
          </div>
        )}
        <InputForm onSubmit={handleGenerate} loading={loading} />
      </div>
    )
  }

  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 gap-4">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
        <p className="text-sm text-stone-400">Building your board…</p>
      </div>
    )
  }

  // Stage: board
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200 px-4 py-2.5">
        <div className="max-w-3xl mx-auto flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-stone-900 text-sm shrink-0">TravelGPT</span>
          <div className="flex-1 min-w-0">
            <InputForm onSubmit={handleGenerate} loading={loading} compact />
          </div>
        </div>
      </header>

      {/* Destination banner + tabs */}
      {board && (
        <div className="bg-white border-b border-stone-100 px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h1 className="text-base font-semibold text-stone-900">{board.destination}</h1>
              <div className="flex bg-stone-100 rounded-lg p-0.5 text-xs font-medium shrink-0">
                {(['experiences', 'spirit', 'weather', 'map'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1.5 rounded-md transition-colors capitalize ${tab === t ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    {t === 'experiences' ? 'Trip' : t === 'spirit' ? 'Spirit' : t === 'weather' ? 'Weather' : 'Map'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full">
        {board && tab === 'spirit' && (
          <SpiritView destination={board.destination} context={board.destination_context} />
        )}

        {board && tab === 'weather' && (
          <WeatherTable weather={board.weather_context} />
        )}

        {board && tab === 'experiences' && (
          <div className="p-4 space-y-6">
            {/* Itinerary section — shown after user clicks Plan */}
            {tripDates?.startDate && itinerary && (
              <div>
                {stayArea && (
                  <div className="mb-4">
                    <AssumptionsBar
                      stayArea={stayArea}
                      stayReason={board.destination_context.recommended_stay_reason ?? ''}
                      onStayAreaChange={handleStayAreaChange}
                      hasChanges={stayAreaChanged}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-stone-900">Your Itinerary</h2>
                  <button
                    onClick={handleReplan}
                    disabled={planLoading}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${
                      hasPendingChanges
                        ? 'bg-stone-900 text-white hover:bg-stone-700'
                        : 'border border-stone-300 text-stone-600 hover:border-stone-500'
                    }`}
                  >
                    {planLoading ? 'Replanning…' : hasPendingChanges ? 'Replan with changes →' : 'Regenerate'}
                  </button>
                </div>
                <ItineraryView itinerary={itinerary} loading={false} />
                <div className="border-t border-stone-200 mt-6" />
              </div>
            )}

            {/* Plan CTA — top (shown when dates set and no itinerary yet) */}
            {tripDates?.startDate && !itinerary && (
              <div className="flex flex-col items-center gap-2 py-2">
                <button
                  onClick={handleReplan}
                  disabled={planLoading}
                  className="w-full max-w-xs py-3 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {planLoading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Planning your trip…</>
                    : 'Plan my itinerary →'
                  }
                </button>
                {planError && (
                  <p className="text-xs text-red-500 text-center">{planError}</p>
                )}
                <p className="text-xs text-stone-400">Browse the board below, then let AI build your day-by-day plan</p>
              </div>
            )}

            {/* Board — all themes with include/skip status */}
            <div className="space-y-1.5">
              {board.themes.map((theme, i) => (
                <ThemeSection
                  key={theme.id}
                  theme={theme}
                  includedIds={includedIds}
                  forcedIds={forcedIds}
                  skippedIds={skippedIds}
                  onSkip={handleSkip}
                  onForceInclude={handleForceInclude}
                  onReset={handleReset}
                  onSelect={setSelected}
                  defaultOpen={i < 2}
                  showItineraryStatus={!!itinerary}
                />
              ))}
            </div>

            {/* Plan CTA — bottom */}
            {tripDates?.startDate && !itinerary && (
              <div className="flex flex-col items-center gap-2 pt-4 pb-8">
                <button
                  onClick={handleReplan}
                  disabled={planLoading}
                  className="w-full max-w-xs py-3 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {planLoading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Planning your trip…</>
                    : 'Plan my itinerary →'
                  }
                </button>
                {planError && (
                  <p className="text-xs text-red-500 text-center">{planError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {board && tab === 'map' && (
          <div className="h-[calc(100vh-130px)]">
            <MapErrorBoundary>
              <MapView
                themes={board.themes}
                onSelect={setSelected}
              />
            </MapErrorBoundary>
          </div>
        )}
      </main>

      {/* Experience detail drawer */}
      <ExperienceDetail
        experience={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
