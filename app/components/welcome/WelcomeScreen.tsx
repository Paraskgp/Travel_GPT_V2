'use client'

interface Props {
  onStart: () => void
}

export default function WelcomeScreen({ onStart }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">TravelGPT</h1>
          <p className="mt-2 text-stone-500 text-sm">Destination intelligence, not another list of links.</p>
        </div>

        <div className="text-left bg-white border border-stone-200 rounded-xl p-5 space-y-3 text-sm text-stone-600">
          <p>Type a destination. Get a curated board of what's actually worth doing there — organized by theme, de-duplicated, with local timing and practical tips built in.</p>
          <ul className="space-y-1.5 text-stone-500">
            <li className="flex gap-2"><span className="text-stone-400">→</span> Experiences grouped by theme, not by operator listing</li>
            <li className="flex gap-2"><span className="text-stone-400">→</span> Food and drink as a first-class travel category</li>
            <li className="flex gap-2"><span className="text-stone-400">→</span> Local tips that tell you when, how, and what to bring</li>
            <li className="flex gap-2"><span className="text-stone-400">→</span> Heart or skip experiences to build your shortlist</li>
          </ul>
        </div>

        <button
          onClick={onStart}
          className="w-full bg-stone-900 text-white py-3 px-6 rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors"
        >
          Get Started →
        </button>
      </div>
    </div>
  )
}
