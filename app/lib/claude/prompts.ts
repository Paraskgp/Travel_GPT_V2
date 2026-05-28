import fs from "fs"
import path from "path"
import { Preferences, DestinationContext, WeatherContext, Board, Experience, ClusterResult, Itinerary, GroundedExperience } from "../types"

const PROMPTS_DIR = path.join(process.cwd(), "prompts")

function load(relativePath: string): string {
  return fs.readFileSync(path.join(PROMPTS_DIR, relativePath), "utf-8")
}

function loadTheme(themeId: string): string {
  const p = path.join(PROMPTS_DIR, "themes", `${themeId}.md`)
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : ""
}

// ─── Node 0: Destination Normalization ───────────────────────────────────────

export function destinationNormalizationSystemPrompt(): string {
  return load("destination-normalization.md")
}

export function destinationNormalizationUserPrompt(raw: string): string {
  return raw
}

// ─── Node 1: Destination Context ─────────────────────────────────────────────

export function destinationContextSystemPrompt(): string {
  return load("destination-context.md")
}

export function destinationContextUserPrompt(destination: string): string {
  return `Generate the destination context for: **${destination}**`
}

// ─── Node 2: Weather Context ──────────────────────────────────────────────────

export function weatherContextSystemPrompt(): string {
  return load("weather-context.md")
}

export function weatherContextUserPrompt(destination: string, travelMonth: string | null): string {
  const monthLine = travelMonth ? `\nTravel month: **${travelMonth}** (highlight this in travel_implications)` : ""
  return `Generate the full 12-month weather context for: **${destination}**${monthLine}`
}

// ─── Stage 0.5: Query Generator ──────────────────────────────────────────────

export function queryGeneratorSystemPrompt(): string {
  return load("query-generator.md")
}

export function queryGeneratorUserPrompt(
  destination: string,
  applicableThemes: string[]
): string {
  return [
    `Destination: **${destination}**`,
    "",
    `Applicable themes (${applicableThemes.length}): ${applicableThemes.join(", ")}`,
    "",
    `Generate exactly 3 queries per theme (${applicableThemes.length * 3} theme queries) plus the 5 required cross-cutting queries.`,
    "Total expected: ~" + (applicableThemes.length * 3 + 5) + " queries.",
    "",
    "Return ONLY the flat JSON array of query strings.",
  ].join("\n")
}

// ─── Stage 0.7a: Experience Extractor — single page (map phase) ──────────────

export function extractFromPageSystemPrompt(): string {
  return load("experience-extractor-page.md")
}

export function extractFromPageUserPrompt(
  destination: string,
  query: string,
  url: string,
  content: string
): string {
  return [
    `**Destination we are building a travel board for:** ${destination}`,
    `**Search query that found this page:** ${query}`,
    `**URL:** ${url}`,
    "",
    "**Page content:**",
    content,
    "",
    `Extract all clearly named real experiences relevant to visiting ${destination}. Return ONLY the JSON array.`,
  ].join("\n")
}

// ─── Stage 0.7b: Experience Deduplicator (reduce phase) ──────────────────────

export function dedupSystemPrompt(): string {
  return load("experience-dedup.md")
}

export function dedupUserPrompt(
  candidates: Array<{ name: string; location: string; category: string; key_facts: string[] }>,
  destination: string
): string {
  return [
    `Destination: **${destination}**`,
    "",
    `Merge and deduplicate these ${candidates.length} candidate experiences extracted from multiple web sources.`,
    "Note: source_urls are tracked separately — do NOT include them in your output.",
    "",
    JSON.stringify(candidates, null, 2),
    "",
    "Return ONLY the merged JSON array. Each object: { name, location, category, key_facts }. No source_urls field.",
  ].join("\n")
}

// ─── Node 3+: Theme Experience Generation ────────────────────────────────────

export function themeSystemPrompt(): string {
  return load("system.md")
}

export function themeUserPrompt(
  themeId: string,
  destination: string,
  destContext: DestinationContext,
  weatherContext: WeatherContext | null,
  preferences?: Preferences,
  usedExperiences?: Array<{ name: string; location_hint?: string | null }>,
  groundedExperiences?: GroundedExperience[]
): string {
  const parts: string[] = []

  // ── Destination context block ──────────────────────────────────────────────
  parts.push(`## Destination Context\n\n**Destination:** ${destination}\n\n**Soul:**\n${destContext.soul}\n\n**Defining pillars:** ${destContext.defining_pillars.join(" · ")}\n\n**Best for:** ${destContext.best_for.join(", ")}\n\n**Honest notes:**\n${destContext.honest_notes.map(n => `- ${n}`).join("\n")}`)

  // ── Weather context block ──────────────────────────────────────────────────
  if (weatherContext) {
    const travelMonth = weatherContext.travel_month
    const w = travelMonth ? weatherContext.months[travelMonth] : null

    if (travelMonth && w) {
      parts.push(`## Travel Month Weather — ${travelMonth}

**Season:** ${w.season_type.replace(/_/g, " ")} — ${w.season_notes}
**Temperature:** ${w.avg_high_f}°F high / ${w.avg_low_f}°F low (${w.avg_high_c}°C / ${w.avg_low_c}°C)
**Rain:** ~${w.avg_rainfall_inches}" over ~${w.rainy_days_estimate} rainy days
**Wind:** ~${w.avg_wind_mph} mph · **Humidity:** ${w.humidity_pct}% · **UV:** ${w.uv_index}
**Daylight:** ${w.sunrise} – ${w.sunset} (${w.daylight_hours} hrs)

**What this means for planning:**
${weatherContext.travel_implications.map(i => `- ${i}`).join("\n")}`)
    } else {
      parts.push(`## Climate Overview\n\n${weatherContext.annual_summary}`)
    }
  }

  // ── Preferences ────────────────────────────────────────────────────────────
  if (preferences && Object.keys(preferences).length > 0) {
    parts.push(`## Traveler Preferences\n${formatPreferences(preferences)}`)
  }

  // ── Grounded experiences (search-verified real places) ─────────────────────
  // These come from Tavily search. Use them as the foundation — don't invent
  // experiences that contradict or duplicate real places on this list.
  if (groundedExperiences && groundedExperiences.length > 0) {
    const lines = groundedExperiences.map(e => {
      const facts = e.key_facts.map(f => `    - ${f}`).join("\n")
      return `- **${e.name}** (${e.category})\n  Location: ${e.location}\n${facts}`
    })
    parts.push(`## ✅ Known Verified Experiences at ${destination}

These experiences are confirmed real by web search. When generating cards for the ${themeId} theme:
1. PREFER to build cards around these verified experiences where they fit the theme
2. Do NOT create a card for a place that contradicts a real place on this list (e.g. don't invent "Emerald Pool Trail" if "Emerald Pools Trail" is on the list)
3. You may add other real experiences beyond this list — but every card must be a real, verifiable place

${lines.join("\n\n")}`)
  }

  // ── Already-used experiences (from Wave 1 signature call) ──────────────────
  if (usedExperiences && usedExperiences.length > 0) {
    const lines = usedExperiences.map(e =>
      e.location_hint ? `- ${e.name} (at: ${e.location_hint})` : `- ${e.name}`
    )
    parts.push(`## ⛔ Already Assigned — Do Not Repeat\n\nThe following experiences have already been assigned to the Signature theme. Do NOT generate a card for any of these, and do NOT create a card anchored to the same named place (even under a different activity name):\n\n${lines.join("\n")}\n\nIf a location here is genuinely the best place to do something in your theme, skip it entirely — it is covered.`)
  }

  // ── Theme task ─────────────────────────────────────────────────────────────
  const themeGuide = loadTheme(themeId)
  parts.push(`## Your Task\n\nGenerate experiences for the **${themeId}** theme at ${destination}.\n\n${themeGuide}\n\nReturn only valid JSON matching the output format in the system prompt.`)

  return parts.join("\n\n")
}

// ─── Node 4: Tip Enhancement ──────────────────────────────────────────────────

export function tipEnhancementSystemPrompt(): string {
  return load("tip-enhancement.md")
}

export function tipEnhancementUserPrompt(
  name: string,
  locationHint: string,
  destination: string,
  theme: string,
  currentTip: string
): string {
  return `Write the best possible local_tip for this experience.

Experience: ${name}
Location: ${locationHint}
Destination: ${destination}
Theme: ${theme}
Current tip (likely too generic — do better): "${currentTip}"`
}

// ─── Itinerary Planning ───────────────────────────────────────────────────────

// ─── Distance + Cluster ───────────────────────────────────────────────────────

export function clusterSystemPrompt(): string {
  return load("distance-cluster.md")
}

export function clusterUserPrompt(board: Board): string {
  const exps: Array<{ id: string; name: string; location: string }> = []
  for (const theme of board.themes) {
    for (const exp of theme.experiences) {
      exps.push({ id: exp.id, name: exp.name, location: exp.location_hint ?? board.destination })
    }
  }

  const expList = exps
    .map(e => `- id: ${e.id}\n  name: ${e.name}\n  location: ${e.location}`)
    .join("\n\n")

  return `## Destination\n\n${board.destination}\n\n## Experiences (${exps.length} total)\n\n${expList}\n\n## Your Task\n\nGenerate the distance matrix and clusters for all ${exps.length} experiences listed above. Follow the output format in the system prompt exactly.`
}

// ─── Itinerary Review (Pass 2) ────────────────────────────────────────────────

export function reviewSystemPrompt(): string {
  return load("itinerary-review.md")
}

export function reviewUserPrompt(
  draft: Itinerary,
  board: Board,
  clusters: ClusterResult,
  preferences?: Preferences
): string {
  const parts: string[] = []

  parts.push(`## Draft Itinerary to Review\n\n${JSON.stringify(draft, null, 2)}`)

  if (preferences && Object.keys(preferences).length > 0) {
    parts.push(`## Traveler Preferences\n\n${formatPreferences(preferences)}`)
  }

  // Summarise clusters for the reviewer
  const clusterSummary = clusters.clusters.map(c =>
    `- ${c.name} (${c.id}): ${c.experience_ids.join(", ")}${c.cluster_note ? ` — NOTE: ${c.cluster_note}` : ""}`
  ).join("\n")
  parts.push(`## Geographic Clusters\n\n${clusterSummary}`)

  parts.push(`## Your Task\n\nReview the draft itinerary above against all checks in the system prompt. Fix any violations. Return the complete corrected itinerary as valid JSON.`)

  return parts.join("\n\n")
}

// ─── Itinerary Planning (Pass 1) ──────────────────────────────────────────────

export function itinerarySystemPrompt(): string {
  return load("itinerary.md")
}

export function itineraryUserPrompt(
  board: Board,
  startDate: string,
  endDate: string,
  arrivalTime?: string,
  departureTime?: string,
  stayArea?: string,
  preferences?: Preferences,
  forcedIds: string[] = [],
  skippedIds: string[] = [],
  clusters?: ClusterResult
): string {
  const skippedSet = new Set(skippedIds)
  const forcedSet = new Set(forcedIds)

  // Build a lookup of experience → cluster for the card list
  const expToCluster: Record<string, string> = {}
  if (clusters) {
    for (const c of clusters.clusters) {
      for (const eid of c.experience_ids) {
        expToCluster[eid] = c.id
      }
    }
  }

  const allExps: Array<Experience & { theme_name: string }> = []
  const foodDrinkExps: Array<Experience & { theme_name: string }> = []

  for (const theme of board.themes) {
    for (const exp of theme.experiences) {
      if (skippedSet.has(exp.id)) continue
      const tagged = { ...exp, theme_name: theme.name }
      allExps.push(tagged)
      if (theme.id === "food_drink" || theme.id === "food_crawls") foodDrinkExps.push(tagged)
    }
  }

  const days = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1

  const expList = allExps.map(e => {
    const forced = forcedSet.has(e.id) ? " [MUST INCLUDE]" : ""
    const clusterRef = expToCluster[e.id] ? `\n  cluster: ${expToCluster[e.id]}` : ""
    return `- id: ${e.id}${forced}\n  name: ${e.name}\n  theme: ${e.theme_name}\n  effort: ${e.effort}\n  location: ${e.location_hint}\n  duration: ${e.duration}\n  best_time: ${e.best_time}\n  local_tip: ${e.local_tip}${clusterRef}`
  }).join("\n\n")

  const foodList = foodDrinkExps.length > 0
    ? foodDrinkExps.map(e =>
        `- id: ${e.id}\n  name: ${e.name}\n  location: ${e.location_hint}\n  tip: ${e.local_tip}`
      ).join("\n\n")
    : "None on board — use your knowledge of well-known local options."

  const parts: string[] = []

  parts.push(`## Trip Details

Destination: ${board.destination}
Accommodation base: ${stayArea ?? board.destination_context.recommended_stay_area ?? board.destination}
Start date: ${startDate} — arrival time: ${arrivalTime ?? "09:00"}
End date: ${endDate} — departure time: ${departureTime ?? "12:00"}
Total days: ${days}

Every day starts and ends at the accommodation base above. The first travel row of each day should route from the accommodation to the first activity. The last activity of each day should end near the accommodation (or dinner nearby).`)

  parts.push(`## Destination Context\n\n${board.destination_context.soul}\n\nDefining pillars: ${board.destination_context.defining_pillars.join(" · ")}`)

  if (preferences && Object.keys(preferences).length > 0) {
    parts.push(`## Traveler Preferences\n\n${formatPreferences(preferences)}`)
  }

  if (clusters) {
    const clusterBlock = clusters.clusters.map(c => {
      const noteStr = c.cluster_note ? `\n  note: ${c.cluster_note}` : ""
      return `- cluster_id: ${c.id}\n  name: ${c.name}\n  zone: ${c.zone}\n  anchor: ${c.anchor_id}\n  experiences: [${c.experience_ids.join(", ")}]${noteStr}`
    }).join("\n\n")
    parts.push(`## Geographic Clusters\n\nExperiences in the same cluster are within walking distance of each other. Plan each day around 1–2 clusters to minimise travel.\n\n${clusterBlock}`)

    // Include key travel pairs (only short ones are actionable for planning — long ones are just context)
    const shortPairs = clusters.pairs
      .filter(p => p.drive_min <= 60)
      .sort((a, b) => a.drive_min - b.drive_min)
      .slice(0, 40) // cap to avoid bloating the prompt
    if (shortPairs.length > 0) {
      const pairBlock = shortPairs.map(p =>
        `  ${p.from_id} → ${p.to_id}: ${p.mode === "walk" ? `walk ${p.walk_min} min` : `drive ${p.drive_min} min`}`
      ).join("\n")
      parts.push(`## Key Travel Times (drive ≤ 60 min)\n\n${pairBlock}`)
    }
  }

  parts.push(`## All Available Experiences (${allExps.length} — select the best fit for ${days} days)\n\nEach card includes its cluster reference. Experiences marked [MUST INCLUDE] must appear in the itinerary.\n\n${expList}`)

  parts.push(`## Food & Drink Options (for meal slots)\n\n${foodList}`)

  parts.push(`## Your Task

Build the complete ${days}-day itinerary. Use clusters to group experiences geographically — pick 1–2 clusters per day. Select experiences that best use the traveler's time. Any [MUST INCLUDE] experience must be scheduled. Fill all meal slots with real named places. Every activity row must have a specific, user-facing \`planning_note\`.`)

  return parts.join("\n\n")
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPreferences(prefs: Preferences): string {
  const lines: string[] = []
  if (prefs.dietary?.length)    lines.push(`- Dietary: ${prefs.dietary.join(", ")}`)
  if (prefs.interests?.length)  lines.push(`- Interests: ${prefs.interests.join(", ")}`)
  if (prefs.party_type)         lines.push(`- Party type: ${prefs.party_type}`)
  if (prefs.pace)               lines.push(`- Pace: ${prefs.pace}`)
  if (prefs.budget)             lines.push(`- Budget: ${prefs.budget}`)
  if (prefs.duration_days)      lines.push(`- Trip length: ${prefs.duration_days} days`)
  if (prefs.avoid?.length)      lines.push(`- Wants to avoid: ${prefs.avoid.join(", ")}`)
  return lines.join("\n")
}
