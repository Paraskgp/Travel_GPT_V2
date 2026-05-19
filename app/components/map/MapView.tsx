'use client'

import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps'
import { useState, useMemo, useEffect } from 'react'
import { Experience, Theme } from '@/lib/types'
import { Shortlist, ShortlistStatus } from '@/lib/shortlist'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

// Silver/muted style — suppresses POIs and noise so pins stand out
const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e8ede8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e0e0e0' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c5dff0' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
]

function pinSvg(fill: string, stroke: string, scale = 1) {
  const r = Math.round(10 * scale)
  const d = r * 2
  const inner = r - 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}" viewBox="0 0 ${d} ${d}"><circle cx="${r}" cy="${r}" r="${inner}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

interface Props {
  themes: Theme[]
  shortlist: Shortlist
  onSelect: (exp: Experience) => void
  onLike: (id: string) => void
  onDismiss: (id: string) => void
}

interface MappableExp extends Experience {
  themeName: string
}

export default function MapView({ themes, shortlist, onSelect, onLike, onDismiss }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    const w = window as typeof window & { gm_authFailure?: () => void }
    w.gm_authFailure = () => setMapError('Maps JavaScript API not activated')
    return () => { delete w.gm_authFailure }
  }, [])

  const pins: MappableExp[] = useMemo(() => {
    const seen = new Set<string>()
    return themes.flatMap(t =>
      t.experiences
        .filter(e => {
          if (!e.is_mappable || !e.places_enrichment?.coordinates) return false
          if (seen.has(e.id)) return false
          seen.add(e.id)
          return true
        })
        .map(e => ({ ...e, themeName: t.name }))
    )
  }, [themes])

  const center = useMemo(() => {
    if (pins.length === 0) return { lat: 35.6762, lng: 139.6503 }
    const lats = pins.map(p => p.places_enrichment!.coordinates!.lat)
    const lngs = pins.map(p => p.places_enrichment!.coordinates!.lng)
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    }
  }, [pins])

  const activePin = pins.find(p => p.id === activeId)

  if (mapError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
        <p className="text-stone-500 text-sm font-medium">Map unavailable</p>
        <p className="text-stone-400 text-xs max-w-xs">
          Enable the <strong>Maps JavaScript API</strong> in Google Cloud Console for this API key, then reload.
        </p>
      </div>
    )
  }

  if (pins.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400 text-sm">
        No mappable experiences yet
      </div>
    )
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY} onError={() => setMapError('Maps JavaScript API not activated')}>
      <Map
        defaultCenter={center}
        defaultZoom={13}
        styles={MAP_STYLE}
        className="w-full h-full"
        gestureHandling="greedy"
        disableDefaultUI={false}
      >
        {pins.map(exp => {
          const coords = exp.places_enrichment!.coordinates!
          const isLiked = shortlist[exp.id] === 'liked'
          const isActive = exp.id === activeId

          return (
            <Marker
              key={exp.id}
              position={coords}
              onClick={() => setActiveId(isActive ? null : exp.id)}
              icon={pinSvg(
                isLiked ? '#f43f5e' : isActive ? '#1c1917' : '#ffffff',
                isLiked ? '#e11d48' : isActive ? '#1c1917' : '#78716c',
                isActive ? 1.4 : 1,
              )}
            />
          )
        })}

        {activePin && activePin.places_enrichment?.coordinates && (
          <InfoWindow
            position={activePin.places_enrichment.coordinates}
            onCloseClick={() => setActiveId(null)}
            pixelOffset={[0, -14]}
          >
            <InfoCard
              exp={activePin}
              status={shortlist[activePin.id] as ShortlistStatus | undefined}
              onSelect={() => { setActiveId(null); onSelect(activePin) }}
              onLike={() => onLike(activePin.id)}
              onDismiss={() => onDismiss(activePin.id)}
            />
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  )
}

function InfoCard({ exp, status, onSelect, onLike, onDismiss }: {
  exp: MappableExp
  status: ShortlistStatus | undefined
  onSelect: () => void
  onLike: () => void
  onDismiss: () => void
}) {
  const isLiked = status === 'liked'
  const isDismissed = status === 'dismissed'
  const photo = exp.places_enrichment?.photo_url

  return (
    <div className="w-52 text-xs" style={{ fontFamily: 'inherit' }}>
      {photo && (
        <div className="-mx-3 -mt-3 mb-2 rounded-t overflow-hidden" style={{ height: 80 }}>
          <img src={photo} alt={exp.name} className="w-full h-full object-cover" />
        </div>
      )}
      <p className="font-semibold text-stone-900 leading-tight mb-0.5">{exp.name}</p>
      <p className="text-stone-500 leading-snug line-clamp-2 mb-2">{exp.short_description}</p>
      <p className="text-stone-400 mb-2">{exp.themeName} · {exp.duration}</p>
      <div className="flex items-center justify-between">
        <button onClick={onSelect} className="text-stone-400 hover:text-stone-700 underline underline-offset-2">
          Learn more
        </button>
        <div className="flex gap-1">
          <button
            onClick={onDismiss}
            className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
              isDismissed ? 'bg-stone-200 border-stone-300 text-stone-500' : 'border-stone-300 text-stone-400 hover:bg-stone-100'
            }`}
          >✕</button>
          <button
            onClick={onLike}
            className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
              isLiked ? 'bg-rose-500 border-rose-500 text-white' : 'border-stone-300 text-stone-400 hover:bg-rose-50 hover:border-rose-300'
            }`}
          >♥</button>
        </div>
      </div>
    </div>
  )
}
