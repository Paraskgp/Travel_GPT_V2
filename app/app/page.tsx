'use client'

import { useState, useCallback, useEffect } from 'react'
import { Board, Experience, Preferences } from '@/lib/types'
import { Shortlist, loadShortlist, saveShortlist, setStatus } from '@/lib/shortlist'
import WelcomeScreen from '@/components/welcome/WelcomeScreen'
import InputForm from '@/components/input/InputForm'
import ThemeSection from '@/components/board/ThemeSection'
import ExperienceDetail from '@/components/board/ExperienceDetail'
import SpiritView from '@/components/board/SpiritView'
import WeatherTable from '@/components/board/WeatherTable'
import MapView from '@/components/map/MapView'
import MapErrorBoundary from '@/components/map/MapErrorBoundary'

type Stage = 'welcome' | 'input' | 'loading' | 'board'
type Tab = 'spirit' | 'weather' | 'experiences' | 'map'

export default function Home() {
  const [stage, setStage] = useState<Stage>('welcome')
  const [tab, setTab] = useState<Tab>('experiences')
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shortlist, setShortlist] = useState<Shortlist>({})
  const [selected, setSelected] = useState<Experience | null>(null)

  useEffect(() => {
    setShortlist(loadShortlist())
  }, [])

  const updateShortlist = useCallback((next: Shortlist) => {
    setShortlist(next)
    saveShortlist(next)
  }, [])

  const handleLike = useCallback((id: string) => {
    setShortlist(prev => {
      const next = setStatus(prev, id, prev[id] === 'liked' ? null : 'liked')
      saveShortlist(next)
      return next
    })
  }, [])

  const handleDismiss = useCallback((id: string) => {
    setShortlist(prev => {
      const next = setStatus(prev, id, prev[id] === 'dismissed' ? null : 'dismissed')
      saveShortlist(next)
      return next
    })
  }, [])

  async function handleGenerate(destination: string, month: string, prefs: Preferences) {
    setLoading(true)
    setError(null)
    setStage('loading')
    setBoard(null)

    try {
      // Step 1: generate board
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, month: month || undefined, preferences: prefs }),
      })
      if (!genRes.ok) throw new Error(await genRes.text())
      const { board: raw }: { board: Board } = await genRes.json()
      // Deduplicate by ID (LLM occasionally repeats the same id across themes)
      const seenIds = new Set<string>()
      const generated: Board = {
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
      setBoard(generated)
      setStage('board')
      setTab('experiences')

      // Step 2: enrich in background (fire and forget UI-side)
      const allExps = generated.themes.flatMap(t => t.experiences)
      const mappable = allExps.filter(e => e.is_mappable)

      if (mappable.length > 0) {
        fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination: generated.destination,
            experiences: mappable.map(e => ({
              id: e.id,
              name: e.name,
              location_hint: e.location_hint,
              is_mappable: e.is_mappable,
            })),
          }),
        })
          .then(r => r.json())
          .then(({ enriched }: { enriched: { id: string; places_enrichment: Experience['places_enrichment'] }[] }) => {
            const lookup = Object.fromEntries(enriched.map(e => [e.id, e.places_enrichment]))
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
            // Update selected exp if open
            setSelected(prev => {
              if (!prev) return prev
              return lookup[prev.id] !== undefined
                ? { ...prev, places_enrichment: lookup[prev.id] }
                : prev
            })
          })
          .catch(() => {}) // silent — enrichment is best-effort
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('input')
    } finally {
      setLoading(false)
    }
  }

  const likedCount = Object.values(shortlist).filter(s => s === 'liked').length

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
          {likedCount > 0 && (
            <span className="text-xs text-rose-500 bg-rose-50 px-2 py-1 rounded-full shrink-0">
              ♥ {likedCount} saved
            </span>
          )}
        </div>
      </header>

      {/* Destination banner */}
      {board && (
        <div className="bg-white border-b border-stone-100 px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-base font-semibold text-stone-900">{board.destination}</h1>
              </div>
              {/* Tab switcher */}
              <div className="flex bg-stone-100 rounded-lg p-0.5 text-xs font-medium shrink-0">
                {(['spirit', 'weather', 'experiences', 'map'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1.5 rounded-md transition-colors capitalize ${tab === t ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    {t === 'spirit' ? 'Spirit' : t === 'weather' ? 'Weather' : t === 'experiences' ? 'Experiences' : 'Map'}
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
          <div className="p-4 space-y-1.5">
            {board.themes.map((theme, i) => (
              <ThemeSection
                key={theme.id}
                theme={theme}
                shortlist={shortlist}
                onLike={handleLike}
                onDismiss={handleDismiss}
                onSelect={setSelected}
                defaultOpen={i < 2}
              />
            ))}
          </div>
        )}

        {board && tab === 'map' && (
          <div className="h-[calc(100vh-130px)]">
            <MapErrorBoundary>
              <MapView
                themes={board.themes}
                shortlist={shortlist}
                onSelect={setSelected}
                onLike={handleLike}
                onDismiss={handleDismiss}
              />
            </MapErrorBoundary>
          </div>
        )}
      </main>

      {/* Experience detail drawer */}
      <ExperienceDetail
        experience={selected}
        status={selected ? shortlist[selected.id] : undefined}
        onLike={() => selected && handleLike(selected.id)}
        onDismiss={() => selected && handleDismiss(selected.id)}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
