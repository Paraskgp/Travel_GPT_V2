'use client'

import { WeatherContext } from '@/lib/types'

interface Props {
  weather: WeatherContext
}

const MONTH_ORDER = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const SEASON_STYLE: Record<string, string> = {
  peak_season:     'bg-amber-50 text-amber-700',
  shoulder_season: 'bg-blue-50 text-blue-600',
  off_season:      'bg-stone-100 text-stone-500',
}
const SEASON_LABEL: Record<string, string> = {
  peak_season:     'Peak',
  shoulder_season: 'Shoulder',
  off_season:      'Off',
}

export default function WeatherTable({ weather }: Props) {
  const travelMonth = weather.travel_month

  return (
    <div className="p-4 space-y-4">
      {/* Annual summary */}
      <p className="text-sm text-stone-500 leading-relaxed max-w-2xl">{weather.annual_summary}</p>

      {/* Travel implications */}
      {travelMonth && weather.travel_implications?.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1">
          <p className="text-xs font-medium text-amber-700 mb-1.5">{travelMonth} travel notes</p>
          {weather.travel_implications.map((imp, i) => (
            <p key={i} className="text-xs text-amber-700 leading-snug">· {imp}</p>
          ))}
        </div>
      )}

      {/* Monthly table */}
      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-3 py-2 font-medium text-stone-500 w-14">Month</th>
              <th className="text-center px-2 py-2 font-medium text-stone-500">High</th>
              <th className="text-center px-2 py-2 font-medium text-stone-500">Low</th>
              <th className="text-center px-2 py-2 font-medium text-stone-500">Rain days</th>
              <th className="text-center px-2 py-2 font-medium text-stone-500">Humidity</th>
              <th className="text-center px-2 py-2 font-medium text-stone-500">UV</th>
              <th className="text-center px-2 py-2 font-medium text-stone-500">Daylight</th>
              <th className="text-center px-2 py-2 font-medium text-stone-500">Season</th>
            </tr>
          </thead>
          <tbody>
            {MONTH_ORDER.map((month, i) => {
              const m = weather.months?.[month]
              if (!m) return null
              const isTravel = month === travelMonth
              return (
                <tr
                  key={month}
                  className={`border-b border-stone-100 last:border-0 ${isTravel ? 'bg-stone-900 text-white' : 'hover:bg-stone-50'}`}
                >
                  <td className={`px-3 py-2 font-medium ${isTravel ? 'text-white' : 'text-stone-700'}`}>
                    {MONTH_SHORT[i]}
                    {isTravel && <span className="ml-1 text-stone-400">←</span>}
                  </td>
                  <td className={`text-center px-2 py-2 ${isTravel ? 'text-white' : 'text-stone-700'}`}>
                    {m.avg_high_c}°C
                  </td>
                  <td className={`text-center px-2 py-2 ${isTravel ? 'text-stone-300' : 'text-stone-500'}`}>
                    {m.avg_low_c}°C
                  </td>
                  <td className={`text-center px-2 py-2 ${isTravel ? 'text-stone-300' : 'text-stone-500'}`}>
                    {m.rainy_days_estimate}d
                  </td>
                  <td className={`text-center px-2 py-2 ${isTravel ? 'text-stone-300' : 'text-stone-500'}`}>
                    {m.humidity_pct}%
                  </td>
                  <td className={`text-center px-2 py-2 ${isTravel ? 'text-stone-300' : 'text-stone-500'}`}>
                    {m.uv_index}
                  </td>
                  <td className={`text-center px-2 py-2 ${isTravel ? 'text-stone-300' : 'text-stone-500'}`}>
                    {m.daylight_hours}h
                  </td>
                  <td className="text-center px-2 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${isTravel ? 'bg-white/20 text-white' : (SEASON_STYLE[m.season_type] ?? 'bg-stone-100 text-stone-500')}`}>
                      {SEASON_LABEL[m.season_type] ?? m.season_type}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
