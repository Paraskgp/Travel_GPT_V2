import { DestinationContext, GroundedExperience } from "../types"

export type CurationStatus = "candidate" | "excluded_from_board" | "fold_into_parent"

export interface CuratedExperienceAuditEntry {
  experience: GroundedExperience
  status: CurationStatus
  reason: string | null
  parent_name: string | null
  score: number
  matching_themes: string[]
}

export interface CuratedExperienceStats {
  input_count: number
  exact_deduped_count: number
  candidate_count: number
  excluded_from_board_count: number
  folded_into_parent_count: number
  by_theme: Record<string, number>
}

export interface CuratedExperienceResult {
  byTheme: Record<string, GroundedExperience[]>
  audit: CuratedExperienceAuditEntry[]
  stats: CuratedExperienceStats
}

type ScoredCandidate = {
  experience: GroundedExperience
  score: number
  matchingThemes: string[]
  isFood: boolean
  isRestaurant: boolean
  isMustCover: boolean
}

type MutableExperience = GroundedExperience & { key_facts: string[]; source_urls: string[] }

// Prompt budget policy, not a destination policy: most themes only need enough
// candidates for the LLM to choose 5-10 strong cards without drowning in noise.
const DEFAULT_THEME_CANDIDATE_TARGET = 25
const DEFAULT_THEME_CANDIDATE_MAX = 30

// Food remains broader until the dedicated restaurant-by-cuisine-by-cluster
// pipeline exists. Restaurants need more inventory for dietary and geography needs.
const FOOD_CANDIDATE_MAX = 80

const MIN_TRIP_WORTHY_SCORE = 18
const THEME_PROMPT_CHAR_BUDGET = 24_000
const FOOD_PROMPT_CHAR_BUDGET = 48_000

const FOOD_RE =
  /\b(restaurant|ramen|sushi|izakaya|yakitori|tonkatsu|tempura|kaiseki|omakase|cafe|coffee|bar|pub|brewery|distillery|market|food|culinary|cooking|bakery|dessert|tea house|tea ceremony|street food|dining|yakiniku|sukiyaki|shabu|noodle|seafood)\b/i

const RESTAURANT_RE =
  /\b(restaurant|ramen|sushi|izakaya|yakitori|tonkatsu|tempura|kaiseki|omakase|dining|bistro|trattoria|curry|yakiniku|sukiyaki|shabu|noodle|seafood)\b/i

const INFRASTRUCTURE_RE =
  /\b(parking|transportation|transport|station|airport|pass|ticket|ticketing|service|app|package|operator|hotel|apartment hotel|line|facility|rental|transfer|gate|exit)\b/i

const CONTAINER_CATEGORY_RE =
  /\b(theme park|amusement park|museum|park|garden|market|district|neighborhood|complex|resort|zoo|aquarium|palace|shrine|temple|island)\b/i

const CHILD_CATEGORY_RE =
  /\b(theme park area|park entrance|exhibition|show|pass|service|facility|wing|room|gate|lounge|greenhouse)\b/i

const THEME_KEYWORDS: Record<string, string[]> = {
  signature: ["landmark", "viewpoint", "observation", "tower", "temple", "shrine", "market", "district", "museum", "theme", "park", "garden", "crossing", "palace", "waterfront", "island"],
  unique_local: ["workshop", "craft", "local", "neighborhood", "district", "market", "street", "traditional", "class", "tour", "temple", "shrine", "bathhouse", "onsen", "tram", "flea", "book", "record"],
  food: ["restaurant", "food", "drink", "market", "ramen", "sushi", "izakaya", "cafe", "bar", "brewery", "distillery", "culinary", "cooking", "bakery"],
  adventure: ["hike", "trail", "climb", "cycling", "biking", "kayak", "canoe", "rafting", "paragliding", "running", "bouldering", "adventure", "mountain", "river", "lake"],
  outdoor: ["park", "garden", "trail", "hike", "mount", "mountain", "valley", "river", "lake", "island", "beach", "nature", "forest", "waterfall", "outdoor", "cycling"],
  culture: ["museum", "temple", "shrine", "palace", "history", "historic", "heritage", "theatre", "theater", "kabuki", "sumo", "cultural", "traditional", "architecture", "garden", "district", "monument"],
  arts: ["art", "gallery", "museum", "exhibition", "workshop", "studio", "craft", "design", "cinema", "theatre", "theater", "music", "performance", "anime", "manga"],
  shopping: ["shopping", "market", "street", "department", "mall", "complex", "store", "bookstore", "record", "vintage", "thrift", "fashion", "kitchenware", "souvenir"],
  nightlife: ["nightlife", "bar", "pub", "club", "jazz", "karaoke", "izakaya", "evening", "night", "rooftop", "show", "cocktail"],
  day_trips: ["day trip", "island", "lake", "mount", "mountain", "outside", "prefecture", "onsen", "hot spring", "theme park", "amusement park", "historical town", "village", "valley", "gorge", "beach", "coast"],
  seasonal: ["festival", "event", "seasonal", "cherry", "sakura", "autumn", "foliage", "fireworks", "matsuri", "sumo", "tournament", "holiday", "illumination", "spring", "summer", "winter"],
}

/**
 * Curate the verified search-grounded experience pool into compact per-theme
 * candidate sets for board generation.
 *
 * The full input pool is never deleted. Every exact-deduped entry receives an
 * audit status: candidate, excluded_from_board, or fold_into_parent. Child
 * entries contribute facts to the parent candidate; excluded entries retain
 * reasons for reviewer inspection. This function is deterministic and does not
 * call external services or throw for ordinary low-quality input.
 */
export function curateExperiencesForBoard(
  experiences: GroundedExperience[],
  destContext: DestinationContext,
  themeIds: string[]
): CuratedExperienceResult {
  const deduped = dedupeByExactName(experiences)
  const mutable = deduped.map(toMutableExperience)
  const parentByName = buildParentIndex(mutable)
  const audit: CuratedExperienceAuditEntry[] = []
  const candidates: ScoredCandidate[] = []

  for (const experience of mutable) {
    const parent = findParent(experience, parentByName)
    const score = boardWorthinessScore(experience, destContext)
    const isFood = FOOD_RE.test(identityText(experience))
    const isRestaurant = RESTAURANT_RE.test(identityText(experience))
    const isMustCover = isMustCoverExperience(experience, destContext)
    const matchingThemes = matchThemes(experience, themeIds, isFood)

    if (parent) {
      foldFactsIntoParent(experience, parent)
      audit.push({
        experience,
        status: "fold_into_parent",
        reason: "detail_or_subarea_of_stronger_parent",
        parent_name: parent.name,
        score,
        matching_themes: matchingThemes,
      })
      continue
    }

    const exclusionReason = exclusionReasonFor(experience, destContext, score, isFood, matchingThemes)
    if (exclusionReason && !isMustCover) {
      audit.push({
        experience,
        status: "excluded_from_board",
        reason: exclusionReason,
        parent_name: null,
        score,
        matching_themes: matchingThemes,
      })
      continue
    }

    audit.push({
      experience,
      status: "candidate",
      reason: null,
      parent_name: null,
      score,
      matching_themes: matchingThemes,
    })
    candidates.push({ experience, score, matchingThemes, isFood, isRestaurant, isMustCover })
  }

  const byTheme: Record<string, GroundedExperience[]> = {}
  for (const themeId of themeIds) {
    byTheme[themeId] = selectThemeCandidates(candidates, themeId)
  }

  return {
    byTheme,
    audit,
    stats: {
      input_count: experiences.length,
      exact_deduped_count: deduped.length,
      candidate_count: audit.filter(e => e.status === "candidate").length,
      excluded_from_board_count: audit.filter(e => e.status === "excluded_from_board").length,
      folded_into_parent_count: audit.filter(e => e.status === "fold_into_parent").length,
      by_theme: Object.fromEntries(Object.entries(byTheme).map(([theme, list]) => [theme, list.length])),
    },
  }
}

function selectThemeCandidates(candidates: ScoredCandidate[], themeId: string): GroundedExperience[] {
  const max = themeId === "food" ? FOOD_CANDIDATE_MAX : DEFAULT_THEME_CANDIDATE_MAX
  const charBudget = themeId === "food" ? FOOD_PROMPT_CHAR_BUDGET : THEME_PROMPT_CHAR_BUDGET
  const themeCandidates = candidates
    .filter(candidate => candidate.matchingThemes.includes(themeId) || (themeId === "signature" && candidate.isMustCover))
    .map(candidate => ({
      ...candidate,
      score: candidate.score + themeFitScore(candidate.experience, themeId, candidate),
    }))
    .sort(compareScored)

  const selected: GroundedExperience[] = []
  let chars = 0

  for (const candidate of themeCandidates) {
    const candidateChars = promptFootprint(candidate.experience)
    if (selected.length >= DEFAULT_THEME_CANDIDATE_TARGET && chars + candidateChars > charBudget) break
    if (selected.length >= max) break
    selected.push(candidate.experience)
    chars += candidateChars
  }

  return selected
}

function boardWorthinessScore(experience: GroundedExperience, destContext: DestinationContext): number {
  const facts = experience.key_facts?.length ?? 0
  const sources = experience.source_urls?.length ?? 0
  const isMustCover = isMustCoverExperience(experience, destContext)
  const isFood = FOOD_RE.test(identityText(experience))

  let score = 0
  score += Math.min(sources, 5) * 8
  score += Math.min(facts, 10) * 2
  if (sources >= 3) score += 8
  if (facts >= 5) score += 6
  if (isMustCover) score += 80
  if (isFood) score += 8
  if (INFRASTRUCTURE_RE.test(identityText(experience))) score -= 50
  if (facts === 0) score -= 12
  if (facts === 0 && sources <= 1) score -= 16
  if (isLikelyTinyFragment(experience)) score -= 20

  return score
}

function themeFitScore(
  experience: GroundedExperience,
  themeId: string,
  candidate: ScoredCandidate
): number {
  let score = 0
  if (candidate.isMustCover && themeId === "signature") score += 40
  if (themeId === "food" && candidate.isFood) score += 45
  if (themeId === "food" && candidate.isRestaurant) score += 15
  if (themeId !== "food" && themeId !== "nightlife" && candidate.isRestaurant) score -= 40
  if (candidate.matchingThemes.includes(themeId)) score += 35
  return score
}

function exclusionReasonFor(
  experience: GroundedExperience,
  destContext: DestinationContext,
  score: number,
  isFood: boolean,
  matchingThemes: string[]
): string | null {
  const offDestinationReason = offDestinationLeakageReason(experience, destContext)
  if (offDestinationReason) return offDestinationReason
  if (INFRASTRUCTURE_RE.test(identityText(experience))) return "infrastructure_or_service"
  if (score < MIN_TRIP_WORTHY_SCORE && !isFood) return "not_trip_worthy"
  if (score < 0) return "low_signal_fragment"
  if (matchingThemes.length === 0) return "no_matching_board_theme"
  return null
}

function offDestinationLeakageReason(
  experience: GroundedExperience,
  destContext: DestinationContext
): string | null {
  const destination = normalizeName(destContext.destination)
  const text = identityText(experience)

  if (destination.includes("tokyo")) {
    const farDestination = /\b(kyoto|arashiyama|osaka|nara|kobe)\b/i.test(text)
    const acceptedTokyoExcursion = /\b(fuji|hakone|kamakura|nikko|nikkō|yokohama|kawagoe|enoshima|takao|kawaguchi|yamanashi|chichibu|okutama)\b/i.test(text)
    if (farDestination && !acceptedTokyoExcursion) return "off_destination_leakage"
  }

  return null
}

function matchThemes(experience: GroundedExperience, themeIds: string[], isFood: boolean): string[] {
  const identity = searchableIdentityText(experience)
  const seasonalText = searchableFullText(experience)
  const matches = new Set<string>()

  for (const themeId of themeIds) {
    if (themeDisqualifies(experience, themeId)) continue
    const keywords = THEME_KEYWORDS[themeId] ?? themeId.split(/[_\s-]+/)
    const text = themeId === "seasonal" ? seasonalText : identity
    if (keywords.some(keyword => keywordMatches(text, keyword))) {
      matches.add(themeId)
    }
  }

  if (isFood && themeIds.includes("food")) matches.add("food")
  if (isMustCoverLikeSignature(experience) && themeIds.includes("signature")) matches.add("signature")
  return Array.from(matches)
}

function themeDisqualifies(experience: GroundedExperience, themeId: string): boolean {
  const identity = identityText(experience)

  if (themeId === "outdoor") {
    return /\b(theme park|amusement park|shopping|mall|department store|cinema|theatre|theater|museum|aquarium|zoo|restaurant|bar|cafe)\b/i.test(identity)
  }

  if (themeId === "day_trips") {
    const isTripScale = /\b(day trip|island|lake|mount|mountain|outside|prefecture|onsen|hot spring|theme park|amusement park|historical town|village|valley|gorge|beach|coast|national park)\b/i.test(identity)
    if (!isTripScale) return true
    return /\b(shopping|food court|mall|department store|observation deck|viewpoint)\b/i.test(identity)
  }

  return false
}

function isMustCoverLikeSignature(experience: GroundedExperience): boolean {
  return /\b(landmark|viewpoint|observation|tower|temple|shrine|museum|park|garden|market|district|theme park|amusement park|palace|island)\b/i.test(identityText(experience))
}

function buildParentIndex(experiences: MutableExperience[]): Map<string, MutableExperience> {
  const index = new Map<string, MutableExperience>()
  for (const experience of experiences) {
    if (CONTAINER_CATEGORY_RE.test(identityText(experience)) && !INFRASTRUCTURE_RE.test(identityText(experience))) {
      index.set(normalizeName(experience.name), experience)
    }
  }
  return index
}

function findParent(
  experience: MutableExperience,
  parentByName: Map<string, MutableExperience>
): MutableExperience | null {
  if (!CHILD_CATEGORY_RE.test(identityText(experience))) return null

  const normalizedName = normalizeName(experience.name)
  const normalizedLocation = normalizeName(experience.location)

  let best: MutableExperience | null = null
  for (const [parentName, parent] of parentByName.entries()) {
    if (parentName === normalizedName) continue
    if (!normalizedLocation.includes(parentName)) continue
    if (!best || parentName.length > normalizeName(best.name).length) best = parent
  }

  return best
}

function foldFactsIntoParent(child: GroundedExperience, parent: MutableExperience): void {
  const parentFacts = new Set(parent.key_facts)
  const childFacts = child.key_facts.length > 0
    ? child.key_facts
    : [`Includes ${child.name} as a named detail or sub-area.`]

  for (const fact of childFacts.slice(0, 4)) {
    const foldedFact = `${child.name}: ${fact}`
    if (!parentFacts.has(foldedFact)) {
      parent.key_facts.push(foldedFact)
      parentFacts.add(foldedFact)
    }
  }

  parent.source_urls = Array.from(new Set([...parent.source_urls, ...child.source_urls]))
}

function dedupeByExactName(experiences: GroundedExperience[]): GroundedExperience[] {
  const bestByName = new Map<string, GroundedExperience>()

  for (const experience of experiences) {
    const key = normalizeName(experience.name)
    const current = bestByName.get(key)
    if (!current || richnessScore(experience) > richnessScore(current)) {
      bestByName.set(key, experience)
    }
  }

  return Array.from(bestByName.values())
}

function richnessScore(experience: GroundedExperience): number {
  return (experience.source_urls?.length ?? 0) * 10 + (experience.key_facts?.length ?? 0)
}

function isMustCoverExperience(experience: GroundedExperience, destContext: DestinationContext): boolean {
  return (destContext.must_cover ?? []).some(anchor => isLikelySameExperience(experience, anchor))
}

function isLikelySameExperience(experience: GroundedExperience, anchor: string): boolean {
  const expName = normalizeName(experience.name)
  const expText = normalizeName(`${experience.name} ${experience.location}`)
  const anchorName = normalizeName(anchor)

  if (!expName || !anchorName) return false
  if (expName.includes(anchorName) || anchorName.includes(expName)) return true

  const expTokens = new Set(expName.split(" ").filter(t => t.length > 2))
  const anchorTokens = anchorName.split(" ").filter(t => t.length > 2)
  if (anchorTokens.length === 0) return false

  const overlap = anchorTokens.filter(t => expTokens.has(t) || expText.includes(t)).length
  return overlap / anchorTokens.length >= 0.67
}

function isLikelyTinyFragment(experience: GroundedExperience): boolean {
  return /\b(room|lobby|gate|exit|counter|desk|floor|shop|store|app|pass)\b/i.test(identityText(experience))
}

function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.score !== a.score) return b.score - a.score
  const bSources = b.experience.source_urls?.length ?? 0
  const aSources = a.experience.source_urls?.length ?? 0
  if (bSources !== aSources) return bSources - aSources
  const bFacts = b.experience.key_facts?.length ?? 0
  const aFacts = a.experience.key_facts?.length ?? 0
  return bFacts - aFacts
}

function promptFootprint(experience: GroundedExperience): number {
  return [
    experience.name,
    experience.location,
    experience.category,
    ...(experience.key_facts ?? []),
  ].join("\n").length
}

function toMutableExperience(experience: GroundedExperience): MutableExperience {
  return {
    ...experience,
    key_facts: [...(experience.key_facts ?? [])],
    source_urls: [...(experience.source_urls ?? [])],
  }
}

function searchableFullText(experience: GroundedExperience): string {
  return normalizeName([
    experience.name,
    experience.category,
    ...(experience.key_facts ?? []).slice(0, 8),
  ].join(" "))
}

function searchableIdentityText(experience: GroundedExperience): string {
  return normalizeName(identityText(experience))
}

function keywordMatches(text: string, keyword: string): boolean {
  const normalizedKeyword = normalizeName(keyword)
  if (normalizedKeyword.includes(" ")) return text.includes(normalizedKeyword)
  return text.split(" ").includes(normalizedKeyword)
}

function identityText(experience: GroundedExperience): string {
  return [
    experience.name,
    experience.category,
  ].join(" ")
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[''""]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
