import fs from "fs"
import path from "path"
import { Preferences, DestinationContext, WeatherContext, Board, Experience, ClusterResult, Itinerary, GroundedExperience, ExperienceCluster, ClusterTravelPair } from "../types"

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
  applicableThemes: string[],
  travelMonth: string | null = null
): string {
  const eventBlock = travelMonth
    ? [
        "",
        `Travel month: **${travelMonth}** — add 4 event-specific queries for this month (sports tournaments, music festivals, cultural events, public holidays). See the "when a travel month is provided" section in the system prompt.`,
      ].join("\n")
    : ""

  const baseQueryCount = applicableThemes.length * 3 + 5
  const totalExpected = travelMonth ? baseQueryCount + 4 : baseQueryCount

  return [
    `Destination: **${destination}**`,
    "",
    `Applicable themes (${applicableThemes.length}): ${applicableThemes.join(", ")}`,
    "",
    `Generate exactly 3 queries per theme (${applicableThemes.length * 3} theme queries) plus the 5 required cross-cutting queries.`,
    `Total expected: ~${totalExpected} queries.`,
    eventBlock,
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
  candidates: Array<{ name: string; location: string; category: string }>,
  destination: string
): string {
  return [
    `Destination: **${destination}**`,
    "",
    `Merge and deduplicate these ${candidates.length} candidate experiences extracted from multiple web sources.`,
    "key_facts and source_urls are tracked separately — do NOT include them in your output.",
    "",
    JSON.stringify(candidates),
    "",
    "Return ONLY the merged JSON array. Each object: { name, location, category }. No key_facts, no source_urls.",
  ].join("\n")
}

// ─── Stage 0.9: Candidate Enrichment — targeted pre-board research ──────────

export function candidateEnrichmentSystemPrompt(): string {
  return load("candidate-enrichment.md")
}

export function candidateEnrichmentUserPrompt(
  destination: string,
  experience: GroundedExperience,
  googleFacts: string[],
  targetedDocs: Array<{ query: string; url: string; title: string; content: string }>
): string {
  const googleBlock = googleFacts.length
    ? googleFacts.map(f => `- ${f}`).join("\n")
    : "No Google Places facts available."

  const docsBlock = targetedDocs.map((doc, i) => [
    `### Source ${i + 1}`,
    `Query: ${doc.query}`,
    `Title: ${doc.title}`,
    `URL: ${doc.url}`,
    "",
    doc.content,
  ].join("\n")).join("\n\n")

  return [
    `Destination: **${destination}**`,
    "",
    "Experience:",
    JSON.stringify(experience, null, 2),
    "",
    "Google Places facts:",
    googleBlock,
    "",
    "Targeted research sources:",
    docsBlock || "No targeted web sources available.",
    "",
    "Return ONLY valid JSON matching the schema in the system prompt.",
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
  const mustCoverBlock = destContext.must_cover?.length
    ? `\n\n**Must cover (required — every board for this destination must have a card for each):**\n${destContext.must_cover.map((e, i) => `${i + 1}. ${e}`).join("\n")}`
    : ""

  parts.push(`## Destination Context\n\n**Destination:** ${destination}\n\n**Soul:**\n${destContext.soul}\n\n**Defining pillars:** ${destContext.defining_pillars.join(" · ")}\n\n**Best for:** ${destContext.best_for.join(", ")}\n\n**Honest notes:**\n${destContext.honest_notes.map(n => `- ${n}`).join("\n")}${mustCoverBlock}`)

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
    parts.push(`## Curated Board Candidates at ${destination}

These candidates are confirmed real by web search and pre-curated for the ${themeId} theme. When generating cards:
1. Prefer to build cards around these candidates where they fit the theme.
2. Treat child/detail facts as context for the parent candidate, not automatic standalone cards.
3. A standalone card must be worth real trip time: a traveler visiting from another city or country should reasonably spend 1-3 hours including travel overhead on it.
4. Do NOT create a card for a place that contradicts a real place on this list (e.g. don't invent "Emerald Pool Trail" if "Emerald Pools Trail" is on the list).
5. You may add other real experiences beyond this list only when necessary, but every card must be a real, verifiable place.

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

// ─── Node 3b: Board Completeness Eval ────────────────────────────────────────

export function boardEvalSystemPrompt(): string {
  return load("board-eval.md")
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

// ─── Geographic Cluster Assignment ────────────────────────────────────────────

export function clusterAssignmentSystemPrompt(): string {
  return load("distance-cluster.md")
}

export function clusterAssignmentUserPrompt(board: Pick<Board, "destination" | "themes">): string {
  const exps: Array<{ id: string; name: string; location: string }> = []
  for (const theme of board.themes) {
    for (const exp of theme.experiences) {
      exps.push({ id: exp.id, name: exp.name, location: exp.location_hint ?? board.destination })
    }
  }

  const expList = exps
    .map(e => `- id: ${e.id}\n  name: ${e.name}\n  location: ${e.location}`)
    .join("\n\n")

  return `## Destination\n\n${board.destination}\n\n## Experiences (${exps.length} total)\n\n${expList}\n\n## Your Task\n\nAssign every experience listed above to exactly one geographic cluster. Every input id must appear exactly once. Do not estimate travel times. Follow the output format in the system prompt exactly.`
}

// Backwards-compatible aliases for older scripts/imports.
export const clusterSystemPrompt = clusterAssignmentSystemPrompt
export const clusterUserPrompt = clusterAssignmentUserPrompt

// ─── Cluster Travel Estimates ────────────────────────────────────────────────

export function clusterTravelSystemPrompt(): string {
  return load("cluster-travel.md")
}

export function clusterTravelUserPrompt(
  destination: string,
  clusters: ExperienceCluster[],
  pairRequests: Array<Pick<ClusterTravelPair, "from_cluster_id" | "to_cluster_id">>
): string {
  const clusterLines = clusters.map(c =>
    `- id: ${c.id}\n  name: ${c.name}\n  zone: ${c.zone}\n  anchor_id: ${c.anchor_id}\n  experience_ids: [${c.experience_ids.join(", ")}]${c.cluster_note ? `\n  note: ${c.cluster_note}` : ""}`
  ).join("\n\n")

  const pairLines = pairRequests.map((p, i) =>
    `${i + 1}. from_cluster_id: ${p.from_cluster_id}\n   to_cluster_id: ${p.to_cluster_id}`
  ).join("\n")

  return `## Destination\n\n${destination}\n\n## Clusters (${clusters.length})\n\n${clusterLines}\n\n## Required Cluster Pairs (${pairRequests.length})\n\n${pairLines}\n\n## Your Task\n\nFill travel estimates for every required cluster pair above. Return the same ${pairRequests.length} pairs with the same from/to ids.`
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

  // ── Pre-flight violations (deterministic TypeScript checks) ──────────────────
  // These are computed reliably in code so the LLM doesn't have to count rows.
  // Injected as "must fix" directives — the reviewer is required to address each one.
  const preflightLines: string[] = []

  if (preferences?.party_type === "family_young") {
    // Max 2 activities per day check
    for (const day of draft.days) {
      const activityRows = day.rows.filter(r => r.type === "activity")
      if (activityRows.length > 2) {
        const excess = activityRows.slice(2).map(r => `"${r.title}"`).join(", ")
        preflightLines.push(`⚠️ Day ${day.day_number} (${day.date}): ${activityRows.length} activity rows — VIOLATION. Must remove ${activityRows.length - 2} activity row(s). Least essential: ${excess}`)
      }
    }
  }

  if (preflightLines.length > 0) {
    parts.push(`## Pre-flight Violations (computed, must fix)\n\nThe following violations were detected by code before you received this itinerary. You MUST fix every one of them in your output. Fixing means removing or modifying the actual rows in the JSON — not just adding a note.\n\n${preflightLines.join("\n")}`)
  }

  // ── Seasonal conditions (same block as Pass 1) ─────────────────────────────
  // The reviewer needs sunset time for Check 8 and cold-water month for Check 10.
  if (board.weather_context) {
    const wc = board.weather_context
    const travelMonth = wc.travel_month
    const w = travelMonth ? wc.months[travelMonth] : null
    const hasSunset = w?.sunset && w.sunset !== "null"
    const coldMonths = ["november", "december", "january", "february", "march", "april"]
    const isColMonth = coldMonths.some(m => (travelMonth ?? "").toLowerCase().includes(m))
    const coldWaterWarning = isColMonth
      ? `\n⚠️ COLD WATER MONTH: ${travelMonth} river temperatures are 35–55°F. Any wading hike without a drysuit/wetsuit warning in its planning_note is a Check 10 violation.`
      : ""

    if (travelMonth && hasSunset) {
      parts.push(`## Seasonal Conditions — ${travelMonth}

Sunrise: ${w!.sunrise} | Sunset: ${w!.sunset} (${w!.daylight_hours} hrs daylight)

⚠️ HARD CONSTRAINT — SUNSET: No activity may end after ${w!.sunset}. Any outdoor activity ending after ${w!.sunset} is a Check 8 violation → MOVE or REMOVE.${coldWaterWarning}

Travel implications for ${travelMonth}:
${wc.travel_implications.map(i => `- ${i}`).join("\n")}`)
    } else if (travelMonth && wc.travel_implications.length > 0) {
      parts.push(`## Seasonal Conditions — ${travelMonth}${coldWaterWarning}

Travel implications for ${travelMonth}:
${wc.travel_implications.map(i => `- ${i}`).join("\n")}`)
    }
  }

  // ── Strenuous activities (needed for couple back-to-back check) ──────────────
  // The itinerary JSON rows don't include effort level. Provide a list of known
  // strenuous activities so the reviewer can identify back-to-back violations.
  const strenuousExps = board.themes
    .flatMap(t => t.experiences)
    .filter(e => e.effort === "strenuous")
    .map(e => e.name)
  if (strenuousExps.length > 0) {
    parts.push(`## Strenuous Activities (for Check 1 — back-to-back strenuous detection)\n\nThe following experiences from the board are effort: strenuous. If any two of these appear on consecutive days in the itinerary, that is a back-to-back strenuous violation for couple party type.\n\n${strenuousExps.map(n => `- ${n}`).join("\n")}`)
  }

  // Summarise clusters for the reviewer
  const clusterSummary = clusters.clusters.map(c =>
    `- ${c.name} (${c.id}): ${c.experience_ids.join(", ")}${c.cluster_note ? ` — NOTE: ${c.cluster_note}` : ""}`
  ).join("\n")
  parts.push(`## Geographic Clusters\n\n${clusterSummary}`)

  const clusterTravelSummary = clusters.pairs
    .filter(p => p.drive_min <= 90)
    .sort((a, b) => a.drive_min - b.drive_min)
    .slice(0, 60)
    .map(p => `- ${p.from_cluster_id} → ${p.to_cluster_id}: ${p.mode === "walk" ? `walk ${p.walk_min} min` : `${p.mode} ${p.drive_min} min`}${p.note ? ` — ${p.note}` : ""}`)
    .join("\n")
  if (clusterTravelSummary) {
    parts.push(`## Cluster Travel Times\n\nUse these to evaluate geographic conflicts. Experiences in the same cluster should not need a travel row unless the cluster note says otherwise.\n\n${clusterTravelSummary}`)
  }

  parts.push(`## Your Task\n\nReview the draft itinerary above against all 10 checks in the system prompt. Fix any violations. Return the complete corrected itinerary as valid JSON.`)

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

  // ── Seasonal conditions (from weather context) ─────────────────────────────
  // Injected so the planner knows sunset time, cold-water conditions, and
  // seasonal access restrictions BEFORE building the schedule.
  // Two tiers:
  //   Full block  — when month data has sunset/sunrise (emit sunset hard constraint)
  //   Partial block — when month fields are null but travel_implications exist
  if (board.weather_context) {
    const wc = board.weather_context
    const travelMonth = wc.travel_month
    const w = travelMonth ? wc.months[travelMonth] : null
    const hasSunset = w?.sunset && w.sunset !== "null"
    const coldMonths = ["november", "december", "january", "february", "march", "april"]
    const isColMonth = coldMonths.some(m => (travelMonth ?? "").toLowerCase().includes(m))
    const coldWaterWarning = isColMonth
      ? `\n⚠️ COLD WATER MONTH: ${travelMonth} river and stream temperatures are typically 35–55°F. Any wading hike planning_note MUST specify drysuit/wetsuit requirement and day-before gear rental. This is a safety rule, not a comfort note.`
      : ""

    if (travelMonth && hasSunset) {
      // Full block — sunset constraint is enforceable
      parts.push(`## Seasonal Conditions — ${travelMonth}

Sunrise: ${w!.sunrise} | Sunset: ${w!.sunset} (${w!.daylight_hours} hrs daylight)

⚠️ HARD CONSTRAINT — SUNSET: No activity may end after ${w!.sunset}. Every afternoon activity must end at least 30 minutes before sunset. Do not start any outdoor hike within 2 hours of ${w!.sunset}.${coldWaterWarning}

Travel implications for ${travelMonth}:
${wc.travel_implications.map(i => `- ${i}`).join("\n")}`)
    } else if (travelMonth && wc.travel_implications.length > 0) {
      // Partial block — no sunset data, but travel implications are useful
      parts.push(`## Seasonal Conditions — ${travelMonth}${coldWaterWarning}

Travel implications for ${travelMonth}:
${wc.travel_implications.map(i => `- ${i}`).join("\n")}`)
    }
  }

  if (preferences && Object.keys(preferences).length > 0) {
    parts.push(`## Traveler Preferences\n\n${formatPreferences(preferences)}`)
  }

  if (clusters) {
    const clusterBlock = clusters.clusters.map(c => {
      const noteStr = c.cluster_note ? `\n  note: ${c.cluster_note}` : ""
      return `- cluster_id: ${c.id}\n  name: ${c.name}\n  zone: ${c.zone}\n  anchor: ${c.anchor_id}\n  experiences: [${c.experience_ids.join(", ")}]${noteStr}`
    }).join("\n\n")
    parts.push(`## Geographic Clusters\n\nExperiences in the same cluster are within walking distance of each other. Plan each day around 1–2 clusters to minimise travel.\n\n${clusterBlock}`)

    // Include cluster travel pairs. These are coarse zone-to-zone estimates; experiences
    // inside the same cluster are assumed walkable unless cluster_note says otherwise.
    const shortPairs = clusters.pairs
      .filter(p => p.drive_min <= 60)
      .sort((a, b) => a.drive_min - b.drive_min)
      .slice(0, 40) // cap to avoid bloating the prompt
    if (shortPairs.length > 0) {
      const pairBlock = shortPairs.map(p =>
        `  ${p.from_cluster_id} → ${p.to_cluster_id}: ${p.mode === "walk" ? `walk ${p.walk_min} min` : `${p.mode} ${p.drive_min} min`}${p.note ? ` — ${p.note}` : ""}`
      ).join("\n")
      parts.push(`## Cluster Travel Times (drive/transit ≤ 60 min)\n\nUse these when combining 2 clusters in one day or adding travel rows between clusters. Do not add travel rows between experiences in the same cluster unless the cluster note says they are not practically walkable.\n\n${pairBlock}`)
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
