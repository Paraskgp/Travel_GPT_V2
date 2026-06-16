import { cacheRead, cacheWrite, candidateEnrichmentPromptHash, TTL } from "../cache"
import { candidateEnrichmentSystemPrompt, candidateEnrichmentUserPrompt } from "../claude/prompts"
import { callLLM, Provider } from "../llm/client"
import { enrichExperience } from "../places/client"
import { tavilyBatchSearch } from "../tavily/client"
import { DestinationContext, GroundedExperience, PlacesEnrichment } from "../types"
import { parseJSON } from "../utils/parse-json"
import { CuratedExperienceAuditEntry, CuratedExperienceResult } from "./experience-curation"
import { resolveSearchResultContent } from "./experiences"

export interface CandidateEnrichmentAuditEntry {
  name: string
  status: "enriched" | "cached" | "skipped" | "failed"
  reason: string | null
  added_facts: number
  added_source_urls: number
  queries: string[]
  google_rating: number | null
  google_review_count: number | null
  official_website: string | null
}

export interface CandidateEnrichmentStats {
  input_count: number
  selected_count: number
  enriched_count: number
  cached_count: number
  failed_count: number
  skipped_count: number
}

export interface CandidateEnrichmentResult {
  experiences: GroundedExperience[]
  audit: CandidateEnrichmentAuditEntry[]
  stats: CandidateEnrichmentStats
}

interface CandidateEnrichmentPatch {
  key_facts: string[]
  source_urls: string[]
  queries: string[]
  google_rating: number | null
  google_review_count: number | null
  official_website: string | null
}

type CandidateEnrichmentCache = Record<string, CandidateEnrichmentPatch>

type EnrichmentTarget = {
  experience: GroundedExperience
  audit: CuratedExperienceAuditEntry
  priority: number
  isFood: boolean
  isUncertainExcluded: boolean
}

type EnrichmentExtraction = {
  key_facts: string[]
}

// Cost guard: each target can spend 1 Places lookup, 2 Tavily queries, and 1 cheap
// extraction LLM call. This keeps pre-board research focused on candidates whose
// inclusion/exclusion could materially change the board.
const MAX_ENRICHMENT_TARGETS = 36
const MAX_FOOD_TARGETS = 12
const MAX_UNCERTAIN_EXCLUDED_TARGETS = 12
const MAX_TARGETED_QUERIES_PER_EXPERIENCE = 2
const MAX_RESULTS_PER_QUERY = 2
const MAX_TARGETED_DOCS = 4
const TARGET_DOC_MAX_CHARS = 4_500
const MAX_FACTS_FROM_GOOGLE = 6
const MAX_FACTS_FROM_TARGETED_RESEARCH = 8
const ENRICHMENT_CONCURRENCY = 3

const UNCERTAIN_EXCLUSION_REASONS = new Set(["not_trip_worthy", "low_signal_fragment", "no_matching_board_theme"])

/**
 * Enrich promising board candidates before final curation and board ranking.
 *
 * This function reuses the existing Places, Tavily, prompt, parsing, and cache
 * modules. It is non-fatal: failures preserve the original `GroundedExperience`
 * record and appear only in the returned audit.
 */
export async function enrichPromisingCandidatesForBoard(
  experiences: GroundedExperience[],
  initialCuration: CuratedExperienceResult,
  destination: string,
  destContext: DestinationContext,
  provider: Provider = "openai"
): Promise<CandidateEnrichmentResult> {
  const promptHash = candidateEnrichmentPromptHash()
  const cache = cacheRead<CandidateEnrichmentCache>(destination, "candidate_enrichment", promptHash) ?? {}
  const targets = selectTargets(initialCuration, destContext)
  const enrichedByName = new Map(experiences.map(exp => [normalizeName(exp.name), exp]))
  const audit: CandidateEnrichmentAuditEntry[] = []
  let cacheChanged = false

  const settled = await runWithConcurrency(targets, ENRICHMENT_CONCURRENCY, async target => {
    const key = normalizeName(target.experience.name)
    const cached = cache[key]
    if (cached) {
      const merged = mergePatch(target.experience, cached)
      return {
        key,
        experience: merged,
        audit: auditEntry(target.experience.name, "cached", null, cached),
      }
    }

    const patch = await buildEnrichmentPatch(target.experience, destination, provider)
    if (!patch || (patch.key_facts.length === 0 && patch.source_urls.length === 0)) {
      return {
        key,
        experience: target.experience,
        audit: emptyAuditEntry(target.experience.name, "failed", "no_enrichment_facts_found"),
      }
    }

    cache[key] = patch
    cacheChanged = true
    return {
      key,
      experience: mergePatch(target.experience, patch),
      audit: auditEntry(target.experience.name, "enriched", null, patch),
    }
  })

  for (const result of settled) {
    if (result.status === "fulfilled") {
      enrichedByName.set(result.value.key, result.value.experience)
      audit.push(result.value.audit)
    } else {
      audit.push(emptyAuditEntry("unknown", "failed", String(result.reason).slice(0, 200)))
    }
  }

  if (cacheChanged) {
    cacheWrite(destination, "candidate_enrichment", cache, TTL.CANDIDATE_ENRICHMENT, promptHash)
  }

  const skipped = experiences.length - targets.length
  return {
    experiences: experiences.map(exp => enrichedByName.get(normalizeName(exp.name)) ?? exp),
    audit,
    stats: {
      input_count: experiences.length,
      selected_count: targets.length,
      enriched_count: audit.filter(a => a.status === "enriched").length,
      cached_count: audit.filter(a => a.status === "cached").length,
      failed_count: audit.filter(a => a.status === "failed").length,
      skipped_count: skipped,
    },
  }
}

function selectTargets(
  curation: CuratedExperienceResult,
  destContext: DestinationContext
): EnrichmentTarget[] {
  const promptCandidateNames = new Set(
    Object.values(curation.byTheme)
      .flat()
      .map(exp => normalizeName(exp.name))
  )

  const targets: EnrichmentTarget[] = []
  for (const entry of curation.audit) {
    const key = normalizeName(entry.experience.name)
    const isFood = entry.matching_themes.includes("food")
    const isMustCover = isMustCoverExperience(entry.experience, destContext)
    const isPromptCandidate = promptCandidateNames.has(key)
    const isUncertainExcluded = entry.status === "excluded_from_board"
      && UNCERTAIN_EXCLUSION_REASONS.has(entry.reason ?? "")

    if (entry.status === "fold_into_parent") continue
    if (entry.reason === "infrastructure_or_service") continue
    if (!isPromptCandidate && !isUncertainExcluded && !isMustCover) continue

    targets.push({
      experience: entry.experience,
      audit: entry,
      priority: enrichmentPriority(entry, isPromptCandidate, isMustCover, isUncertainExcluded),
      isFood,
      isUncertainExcluded,
    })
  }

  const selected: EnrichmentTarget[] = []
  let foodCount = 0
  let uncertainExcludedCount = 0

  for (const target of targets.sort((a, b) => b.priority - a.priority)) {
    if (selected.length >= MAX_ENRICHMENT_TARGETS) break
    if (target.isFood && foodCount >= MAX_FOOD_TARGETS) continue
    if (target.isUncertainExcluded && uncertainExcludedCount >= MAX_UNCERTAIN_EXCLUDED_TARGETS) continue

    selected.push(target)
    if (target.isFood) foodCount += 1
    if (target.isUncertainExcluded) uncertainExcludedCount += 1
  }

  return selected
}

function enrichmentPriority(
  entry: CuratedExperienceAuditEntry,
  isPromptCandidate: boolean,
  isMustCover: boolean,
  isUncertainExcluded: boolean
): number {
  const facts = entry.experience.key_facts?.length ?? 0
  const sources = entry.experience.source_urls?.length ?? 0
  let priority = entry.score
  if (isMustCover) priority += 200
  if (isPromptCandidate) priority += 80
  if (isUncertainExcluded) priority += 60
  if (facts <= 2) priority += 30
  if (sources <= 1) priority += 20
  priority += Math.min(entry.matching_themes.length, 4) * 8
  return priority
}

async function buildEnrichmentPatch(
  experience: GroundedExperience,
  destination: string,
  provider: Provider
): Promise<CandidateEnrichmentPatch | null> {
  const places = process.env.GOOGLE_PLACES_API_KEY
    ? await enrichExperience(experience.name, experience.location, destination)
    : null
  const googleFacts = googleFactsFor(places)
  const queries = targetedQueries(experience, destination, places)

  let docs: Array<{ query: string; url: string; title: string; content: string }> = []
  if (process.env.TAVILY_API_KEY) {
    try {
      const results = await tavilyBatchSearch(queries, MAX_RESULTS_PER_QUERY, true)
      const resolved = await Promise.all(results.slice(0, MAX_TARGETED_DOCS).map(async result => ({
        query: result.query ?? "",
        url: result.url,
        title: result.title,
        content: (await resolveSearchResultContent(result)).slice(0, TARGET_DOC_MAX_CHARS),
      })))
      docs = resolved.filter(doc => doc.content.length >= 80)
    } catch {
      docs = []
    }
  }

  const llmFacts = docs.length > 0 || googleFacts.length > 0
    ? await extractTargetedFacts(destination, experience, googleFacts, docs, provider)
    : []

  const sourceUrls = new Set<string>()
  if (places?.website) sourceUrls.add(places.website)
  if (places?.maps_url) sourceUrls.add(places.maps_url)
  for (const doc of docs) sourceUrls.add(doc.url)

  const keyFacts = uniqueFacts([
    ...googleFacts.slice(0, MAX_FACTS_FROM_GOOGLE),
    ...llmFacts.slice(0, MAX_FACTS_FROM_TARGETED_RESEARCH),
  ])

  return {
    key_facts: keyFacts,
    source_urls: Array.from(sourceUrls),
    queries,
    google_rating: places?.rating ?? null,
    google_review_count: places?.review_count ?? null,
    official_website: places?.website ?? null,
  }
}

async function extractTargetedFacts(
  destination: string,
  experience: GroundedExperience,
  googleFacts: string[],
  docs: Array<{ query: string; url: string; title: string; content: string }>,
  provider: Provider
): Promise<string[]> {
  try {
    const raw = await callLLM(
      candidateEnrichmentSystemPrompt(),
      candidateEnrichmentUserPrompt(destination, experience, googleFacts, docs),
      provider,
      "experience_extractor"
    )
    const parsed = parseJSON<EnrichmentExtraction>(raw)
    return Array.isArray(parsed.key_facts) ? parsed.key_facts.filter(Boolean) : []
  } catch {
    return []
  }
}

function targetedQueries(
  experience: GroundedExperience,
  destination: string,
  places: PlacesEnrichment | null
): string[] {
  const base = `"${experience.name}" "${destination}"`
  const queries = [
    `${base} official website hours tickets highlights`,
    `${base} reviews rating visit duration tips`,
  ]

  if (places?.website) {
    queries[0] = `${base} ${domainFor(places.website)} official hours tickets`
  }

  return queries.slice(0, MAX_TARGETED_QUERIES_PER_EXPERIENCE)
}

function googleFactsFor(places: PlacesEnrichment | null): string[] {
  if (!places) return []
  const facts: string[] = []

  if (places.rating !== null && places.review_count !== null) {
    facts.push(`Google Places rating ${places.rating} from ${places.review_count.toLocaleString()} reviews.`)
  } else if (places.rating !== null) {
    facts.push(`Google Places rating ${places.rating}.`)
  }
  if (places.website) facts.push(`Official website: ${places.website}`)
  if (places.business_status) facts.push(`Google business status: ${places.business_status}.`)
  if (places.opening_hours?.weekday_text?.length) {
    facts.push(`Published opening hours include: ${places.opening_hours.weekday_text.slice(0, 2).join("; ")}.`)
  }
  if (places.editorial_summary) facts.push(`Google editorial summary: ${places.editorial_summary}`)
  if (places.primary_type) facts.push(`Google primary place type: ${places.primary_type}.`)
  if (places.reviews?.length) {
    const reviewSignals = places.reviews
      .filter(r => r.text)
      .slice(0, 2)
      .map(r => `${r.rating}/5 review mentions ${r.text.slice(0, 140)}`)
    facts.push(...reviewSignals)
  }

  return facts
}

function mergePatch(experience: GroundedExperience, patch: CandidateEnrichmentPatch): GroundedExperience {
  return {
    ...experience,
    key_facts: uniqueFacts([...(experience.key_facts ?? []), ...patch.key_facts]),
    source_urls: Array.from(new Set([...(experience.source_urls ?? []), ...patch.source_urls])),
  }
}

function auditEntry(
  name: string,
  status: "enriched" | "cached",
  reason: string | null,
  patch: CandidateEnrichmentPatch
): CandidateEnrichmentAuditEntry {
  return {
    name,
    status,
    reason,
    added_facts: patch.key_facts.length,
    added_source_urls: patch.source_urls.length,
    queries: patch.queries,
    google_rating: patch.google_rating,
    google_review_count: patch.google_review_count,
    official_website: patch.official_website,
  }
}

function emptyAuditEntry(
  name: string,
  status: "skipped" | "failed",
  reason: string | null
): CandidateEnrichmentAuditEntry {
  return {
    name,
    status,
    reason,
    added_facts: 0,
    added_source_urls: 0,
    queries: [],
    google_rating: null,
    google_review_count: null,
    official_website: null,
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    results.push(...await Promise.allSettled(batch.map(fn)))
  }
  return results
}

function uniqueFacts(facts: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const fact of facts.map(f => f.trim()).filter(Boolean)) {
    const key = normalizeName(fact)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(fact)
  }
  return out
}

function isMustCoverExperience(experience: GroundedExperience, destContext: DestinationContext): boolean {
  const name = normalizeName(`${experience.name} ${experience.location}`)
  return (destContext.must_cover ?? []).some(anchor => {
    const normalizedAnchor = normalizeName(anchor)
    return name.includes(normalizedAnchor) || normalizedAnchor.includes(normalizeName(experience.name))
  })
}

function domainFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[''""]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
