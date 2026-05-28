/**
 * Prefetch / cache-warm script
 *
 * Pre-populates the destination cache (destination_context, weather, board)
 * for a list of destinations so live requests skip all LLM calls.
 *
 * Usage:
 *   npx tsx scripts/prefetch.ts                         # uses built-in destination list
 *   npx tsx scripts/prefetch.ts "Kyoto" "Zion National Park"   # specific destinations
 *   npx tsx scripts/prefetch.ts --month april           # override travel month
 *   npx tsx scripts/prefetch.ts --status                # show cache status, no generation
 *   npx tsx scripts/prefetch.ts --invalidate "Kyoto"    # clear cache for a destination
 *
 * The script calls the running dev server at http://localhost:3000/api/generate.
 * Make sure `npm run dev` is running before executing.
 */

import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

// Load .env.local manually (tsx doesn't auto-load it)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, "../.env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

// Import cache utilities (direct file import — no server needed for status/invalidate)
// Dynamic import — tsx resolves without extension at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cacheModule: any = await import("../lib/cache/index")
const { listCachedDestinations, cacheStatus, destinationSlug } = cacheModule

// ─── Built-in destination lists ───────────────────────────────────────────────

const NATIONAL_PARKS = [
  "Yellowstone National Park",
  "Zion National Park",
  "Grand Canyon National Park, South Rim",
  "Yosemite National Park",
  "Glacier National Park",
  "Acadia National Park",
  "Rocky Mountain National Park",
  "Olympic National Park",
  "Joshua Tree National Park",
  "Arches National Park",
  "Bryce Canyon National Park",
  "Canyonlands National Park",
  "Capitol Reef National Park",
  "Great Smoky Mountains National Park",
]

const TOP_CITIES = [
  "Kyoto",
  "Tokyo",
  "Paris",
  "Rome",
  "Barcelona",
  "Amsterdam",
  "Prague",
  "Lisbon",
  "Istanbul",
  "New York City",
  "San Francisco",
  "New Orleans",
  "Chicago",
  "Mexico City",
]

const UNESCO_AND_LANDMARK = [
  "Machu Picchu, Peru",
  "Angkor Wat, Cambodia",
  "Petra, Jordan",
  "Serengeti National Park, Tanzania",
  "Galápagos Islands, Ecuador",
  "Amalfi Coast, Italy",
  "Cinque Terre, Italy",
  "Santorini, Greece",
  "Ha Long Bay, Vietnam",
  "Bali, Indonesia",
]

const DEFAULT_DESTINATIONS = [
  ...NATIONAL_PARKS,
  ...TOP_CITIES,
  ...UNESCO_AND_LANDMARK,
]

// Default month when no specific travel dates are provided (used for weather caching)
const DEFAULT_MONTH = "june"

// ─── CLI argument parsing ──────────────────────────────────────────────────────

const args = process.argv.slice(2)
const showStatus = args.includes("--status")
const doInvalidate = args.includes("--invalidate")
const monthIdx = args.indexOf("--month")
const travelMonth = monthIdx >= 0 ? args[monthIdx + 1] : DEFAULT_MONTH

const positional = args.filter(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--month" && args[args.indexOf(a) - 1] !== "--invalidate")
const destinations = positional.length > 0 ? positional : DEFAULT_DESTINATIONS

// ─── Status mode ──────────────────────────────────────────────────────────────

if (showStatus) {
  const all = listCachedDestinations()
  if (all.length === 0) {
    console.log("Cache is empty. Run without --status to populate it.")
    process.exit(0)
  }

  console.log(`\n${"Destination".padEnd(45)} ${"Context".padEnd(10)} ${"Board".padEnd(10)} ${"Current?".padEnd(10)} ${"Weather months"}`)
  console.log("─".repeat(110))
  for (const s of all) {
    console.log(
      s.destination.padEnd(45),
      (s.has_context ? "✅" : "❌").padEnd(10),
      (s.has_board ? "✅" : "❌").padEnd(10),
      (s.board_current ? "✅ yes" : "⚠️ stale").padEnd(10),
      s.weather_months.join(", ")
    )
  }
  console.log(`\nTotal cached: ${all.length} destinations`)
  process.exit(0)
}

// ─── Invalidate mode ──────────────────────────────────────────────────────────

if (doInvalidate) {
  const toInvalidate = positional.length > 0 ? positional : []
  if (toInvalidate.length === 0) {
    console.error("Specify destinations to invalidate: npx tsx scripts/prefetch.ts --invalidate \"Kyoto\"")
    process.exit(1)
  }
  for (const dest of toInvalidate) {
    const slug = destinationSlug(dest)
    const dir = path.join(__dirname, "../cache/destinations", slug)
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
      console.log(`🗑  Cleared cache for: ${dest} (${dir})`)
    } else {
      console.log(`⚠  No cache found for: ${dest}`)
    }
  }
  process.exit(0)
}

// ─── Prefetch mode ────────────────────────────────────────────────────────────

const BASE_URL = process.env.PREFETCH_BASE_URL ?? "http://localhost:3000"

async function prefetchOne(destination: string, month: string): Promise<void> {
  const status = cacheStatus(destination)

  // Check what's already warm
  const contextWarm = status.has_context
  const weatherWarm = status.weather_months.includes(month)
  const boardWarm = status.board_current

  if (contextWarm && weatherWarm && boardWarm) {
    console.log(`  ✅ All warm — skipping ${destination}`)
    return
  }

  const missing = [
    !contextWarm && "context",
    !weatherWarm && `weather/${month}`,
    !boardWarm && "board",
  ].filter(Boolean).join(", ")

  console.log(`  🔄 Fetching ${destination} (missing: ${missing})...`)

  const startMs = Date.now()
  try {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination,
        start_date: `2026-${monthToNum(month)}-15`,  // mid-month — triggers weather cache for this month
        end_date:   `2026-${monthToNum(month)}-22`,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.log(`  ❌ ${destination}: HTTP ${res.status} — ${err.slice(0, 120)}`)
      return
    }

    const json = await res.json()
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1)
    const themeCount = json.board?.themes?.length ?? 0
    const expCount = json.board?.themes?.reduce((n: number, t: { experiences: unknown[] }) => n + t.experiences.length, 0) ?? 0

    console.log(`  ✅ ${destination} — ${themeCount} themes, ${expCount} experiences (${elapsed}s)`)
  } catch (err) {
    console.log(`  ❌ ${destination}: ${err}`)
  }
}

function monthToNum(month: string): string {
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  }
  return months[month.toLowerCase()] ?? "06"
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n🌍 TravelGPT Prefetch — ${destinations.length} destinations, month: ${travelMonth}`)
console.log(`   Base URL: ${BASE_URL}`)
console.log(`   Cache: cache/destinations/\n`)

let done = 0
let skipped = 0
let failed = 0

for (const dest of destinations) {
  process.stdout.write(`[${String(done + skipped + 1).padStart(3)}/${destinations.length}] ${dest}\n`)
  const before = cacheStatus(dest)
  await prefetchOne(dest, travelMonth)
  const after = cacheStatus(dest)
  if (after.has_board && !before.has_board) done++
  else if (after.board_current && before.board_current) skipped++
  else if (!after.has_board) failed++
  else skipped++
}

console.log(`\n── Summary ──────────────────────────────`)
console.log(`  Generated : ${done}`)
console.log(`  Skipped   : ${skipped} (already warm)`)
console.log(`  Failed    : ${failed}`)
console.log(`\nRun with --status to inspect cache state.`)
