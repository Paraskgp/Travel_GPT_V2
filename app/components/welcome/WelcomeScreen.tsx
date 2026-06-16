'use client'

import {
  DESTINATION_CATEGORY_LABELS,
  DESTINATION_OPTIONS,
  type DestinationCategory,
  type DestinationOption,
} from '@/lib/destinations/catalog'

interface Props {
  onSelectDestination: (destination: DestinationOption) => void
}

const CATEGORY_ORDER: DestinationCategory[] = ['city', 'national_park', 'unesco']

export default function WelcomeScreen({ onSelectDestination }: Props) {
  return (
    <main className="min-h-screen bg-[#f7f4ed] px-4 py-6 text-stone-950 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 border-b border-stone-300 pb-5 lg:flex-row lg:items-end">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">TravelGPT</p>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
              Pick a destination with a point of view.
            </h1>
          </div>
          <p className="max-w-sm text-sm leading-6 text-stone-600 lg:text-right">
            Cities, parks, and heritage sites that reward a real plan.
          </p>
        </header>

        <div className="space-y-8">
          {CATEGORY_ORDER.map(category => {
            const destinations = DESTINATION_OPTIONS.filter(destination => destination.category === category)
            return (
              <section key={category} className="space-y-3">
                <div className="flex items-center justify-between border-b border-stone-300/70 pb-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-700">
                    {DESTINATION_CATEGORY_LABELS[category]}
                  </h2>
                  <span className="text-xs font-medium text-stone-500">{destinations.length}</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {destinations.map(destination => (
                    <button
                      key={destination.id}
                      type="button"
                      onClick={() => onSelectDestination(destination)}
                      className="group flex min-h-[410px] flex-col overflow-hidden rounded-lg border border-stone-300 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-stone-950 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-stone-950 focus:ring-offset-2 focus:ring-offset-[#f7f4ed]"
                    >
                      <div className="relative h-52 bg-stone-100">
                        <img
                          src={destination.imageUrl}
                          alt={destination.imageAlt}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <span className="absolute left-3 top-3 rounded border border-white/60 bg-white/90 px-2 py-1 text-[11px] font-semibold text-stone-800">
                          {destination.planningBias}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">{destination.region}</p>
                          <h3 className="mt-1 text-xl font-semibold leading-tight text-stone-950">{destination.name}</h3>
                        </div>

                        <p className="text-sm font-medium leading-5 text-stone-800">{destination.headline}</p>
                        <p className="text-sm leading-6 text-stone-600">{destination.pointOfView}</p>

                        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                          {destination.bestFor.map(tag => (
                            <span key={tag} className="rounded border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600">
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-sm font-semibold text-stone-950">
                          <span>Choose destination</span>
                          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">-&gt;</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </main>
  )
}
