'use client'

import { Itinerary, ItineraryDay, ItineraryRow } from '@/lib/types'

interface Props {
  itinerary: Itinerary | null
  loading: boolean
}

function fmt12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function rowIcon(type: ItineraryRow['type']): string {
  if (type === 'travel') return '→'
  if (type === 'meal')   return '☕'
  return '📍'
}

function rowBg(type: ItineraryRow['type']): string {
  if (type === 'travel') return 'bg-stone-50'
  if (type === 'meal')   return 'bg-amber-50'
  return 'bg-white'
}

function DayTable({ day }: { day: ItineraryDay }) {
  const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Day {day.day_number}</span>
        <span className="text-sm font-semibold text-stone-900">{day.day_title}</span>
        <span className="text-xs text-stone-400 ml-auto">{dateLabel}</span>
      </div>

      <div className="rounded-lg border border-stone-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-stone-100 text-stone-500">
              <th className="text-left px-3 py-2 font-medium w-20">Start</th>
              <th className="text-left px-3 py-2 font-medium w-20">End</th>
              <th className="text-left px-3 py-2 font-medium">Activity</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Notes</th>
              <th className="px-3 py-2 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody>
            {day.rows.map((row, i) => (
              <tr key={i} className={`border-t border-stone-100 ${rowBg(row.type)}`}>
                <td className="px-3 py-2 tabular-nums text-stone-500 whitespace-nowrap">{fmt12(row.start_time)}</td>
                <td className="px-3 py-2 tabular-nums text-stone-500 whitespace-nowrap">{fmt12(row.end_time)}</td>
                <td className="px-3 py-2">
                  <span className="mr-1">{rowIcon(row.type)}</span>
                  <span className={row.type === 'travel' ? 'text-stone-400 italic' : 'text-stone-900 font-medium'}>
                    {row.title}
                  </span>
                </td>
                <td className="px-3 py-2 text-stone-500 hidden sm:table-cell max-w-xs leading-snug">
                  {row.notes}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.maps_url && (
                    <a
                      href={row.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stone-400 hover:text-stone-700 transition-colors"
                      title="Open in Google Maps"
                    >
                      ↗
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ItineraryView({ itinerary, loading }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
        <p className="text-sm text-stone-400">Building your itinerary…</p>
      </div>
    )
  }

  if (!itinerary) return null

  return (
    <div>
      <p className="text-xs text-stone-400 mb-4">
        {new Date(itinerary.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        {' – '}
        {new Date(itinerary.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        {' · '}{itinerary.days.length} days · times are estimates
      </p>
      {itinerary.days.map(day => (
        <DayTable key={day.day_number} day={day} />
      ))}
    </div>
  )
}
