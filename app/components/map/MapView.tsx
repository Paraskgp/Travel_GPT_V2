'use client'

import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps'
import { useState, useMemo, useEffect } from 'react'
import { Experience, Theme } from '@/lib/types'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

interface Props {
  themes: Theme[]
  onSelect: (exp: Experience) => void
}

interface MappableExp extends Experience {
  themeName: string
}

export default function MapView({ themes, onSelect }: Props) {
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
        className="w-full h-full"
        gestureHandling="greedy"
        disableDefaultUI={false}
      >
        {pins.map(exp => {
          const coords = exp.places_enrichment!.coordinates!
          const isActive = exp.id === activeId

          return (
            <Marker
              key={exp.id}
              position={coords}
              onClick={() => setActiveId(isActive ? null : exp.id)}
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
              onSelect={() => { setActiveId(null); onSelect(activePin) }}
            />
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  )
}

function InfoCard({ exp, onSelect }: { exp: MappableExp; onSelect: () => void }) {
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
      <button onClick={onSelect} className="text-stone-400 hover:text-stone-700 underline underline-offset-2">
        Learn more
      </button>
    </div>
  )
}
