/**
 * Destination cache — file-based, keyed by destination slug.
 *
 * Philosophy:
 *   - Destination facts (context, weather, experiences, board) are universal.
 *     They do NOT depend on party_type, user dates, or preferences.
 *   - Party type / preferences are applied at itinerary planning time only.
 *   - Cache keys: destination slug + optional discriminator (month for weather,
 *     prompt hash for board).
 *
 * Directory layout:
 *   cache/destinations/{slug}/destination_context.json
 *   cache/destinations/{slug}/weather_{month}.json
 *   cache/destinations/{slug}/experiences.json        ← added with search grounding
 *   cache/destinations/{slug}/board_{prompt_hash}.json
 *   cache/_index.json  ← registry of what's cached
 */

import fs from "fs"
import path from "path"
import crypto from "crypto"

// ─── Paths ────────────────────────────────────────────────────────────────────

const CACHE_ROOT = path.join(process.cwd(), "cache")
const DESTINATIONS_DIR = path.join(CACHE_ROOT, "destinations")
const INDEX_FILE = path.join(CACHE_ROOT, "_index.json")
const PROMPTS_DIR = path.join(process.cwd(), "prompts")

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T
  generated_at: string     // ISO timestamp
  ttl_days: number         // -1 = never expires
  prompt_hash?: string     // hash of prompt files — used for board invalidation
}

export type CacheKey =
  | "canonical_name"                // raw input → canonical destination name
  | "destination_context"
  | `weather_${string}`             // e.g. "weather_november"
  | "search_results"                // raw Tavily results (no travel month)
  | `search_results_${string}`      // e.g. "search_results_september" — month-scoped
  | "experiences"                   // search-grounded experience list (no travel month)
  | `experiences_${string}`         // e.g. "experiences_september" — month-scoped with event queries
  | `board_${string}`               // e.g. "board_abc123de" (prompt hash suffix)

// ─── Slug ─────────────────────────────────────────────────────────────────────

export function destinationSlug(destination: string): string {
  return destination
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

// ─── Prompt hash ──────────────────────────────────────────────────────────────

let _cachedPromptHash: string | null = null

/**
 * MD5 of all prompt .md files. Changes when any prompt is edited.
 * Cached in memory — process restart clears it (picks up new hash).
 */
export function promptHash(): string {
  if (_cachedPromptHash) return _cachedPromptHash

  const hash = crypto.createHash("md5")

  function hashDir(dir: string) {
    if (!fs.existsSync(dir)) return
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        hashDir(fullPath)
      } else if (entry.name.endsWith(".md")) {
        hash.update(entry.name)
        hash.update(fs.readFileSync(fullPath))
      }
    }
  }

  hashDir(PROMPTS_DIR)
  _cachedPromptHash = hash.digest("hex").slice(0, 8)
  return _cachedPromptHash
}

/** Cache key for the board — includes board-only prompt hash so stale boards auto-miss.
 *  Only system.md, themes/, tip-enhancement.md, and board-eval.md affect this key. */
export function boardCacheKey(): `board_${string}` {
  return `board_${boardPromptHash()}`
}

// ─── Per-stage prompt hashes ──────────────────────────────────────────────────
// Each pipeline stage hashes only its own prompt files so that changing an
// unrelated prompt does not invalidate unrelated caches.

const _stageHashCache = new Map<string, string>()

/**
 * MD5 of specific prompt files and/or directories (relative to prompts/). Memoized per entry set.
 * If an entry is a directory, all .md files inside it are included sorted.
 */
function stageHash(entries: string[]): string {
  const key = entries.slice().sort().join("|")
  const cached = _stageHashCache.get(key)
  if (cached) return cached

  const hash = crypto.createHash("md5")

  function hashEntry(entry: string) {
    const fullPath = path.join(PROMPTS_DIR, entry)
    if (!fs.existsSync(fullPath)) return
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      const files = fs.readdirSync(fullPath).filter(f => f.endsWith(".md")).sort()
      for (const file of files) {
        hash.update(file)
        hash.update(fs.readFileSync(path.join(fullPath, file)))
      }
    } else {
      hash.update(entry)
      hash.update(fs.readFileSync(fullPath))
    }
  }

  for (const entry of entries.slice().sort()) {
    hashEntry(entry)
  }

  const result = hash.digest("hex").slice(0, 8)
  _stageHashCache.set(key, result)
  return result
}

/** Hash of board-relevant prompts only: system.md + themes/ + tip-enhancement.md + board-eval.md.
 *  Changing destination-context, weather, or extractor prompts does NOT invalidate the board. */
export function boardPromptHash(): string {
  return stageHash(["system.md", "themes", "tip-enhancement.md", "board-eval.md"])
}

/** Hash of the destination-context prompt. Invalidates destination_context cache when the prompt changes. */
export function contextPromptHash(): string {
  return stageHash(["destination-context.md"])
}

/** Hash of the weather-context prompt. Invalidates weather_{month} cache when the prompt changes. */
export function weatherPromptHash(): string {
  return stageHash(["weather-context.md"])
}

/** Hash of the experience extractor + dedup prompts. Invalidates experiences cache when either prompt changes. */
export function experiencesPromptHash(): string {
  return stageHash(["experience-extractor-page.md", "experience-dedup.md"])
}

// ─── TTL constants (days) ─────────────────────────────────────────────────────

export const TTL = {
  CANONICAL_NAME: -1,        // canonical names never change — permanent
  DESTINATION_CONTEXT: 180,  // spirit of a place is stable
  WEATHER: -1,               // climate averages never change — permanent
  SEARCH_RESULTS: 90,        // raw Tavily results — re-run within 90 days costs 0 Tavily credits
  EXPERIENCES: 90,           // trails/restaurants change over months
  BOARD: -1,                 // no TTL — invalidated only by prompt hash change
} as const

// ─── Core read / write ────────────────────────────────────────────────────────

function entryPath(slug: string, key: string): string {
  return path.join(DESTINATIONS_DIR, slug, `${key}.json`)
}

function ensureDir(slug: string) {
  const dir = path.join(DESTINATIONS_DIR, slug)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

/**
 * Read a cache entry. Returns null on miss, expired TTL, stale prompt hash, or read error.
 *
 * @param expectedHash - When provided, the entry is rejected if it has a stored prompt_hash
 *   that differs from expectedHash. Entries with no stored hash are kept (backward compatible).
 *   Pass the result of contextPromptHash() / weatherPromptHash() / experiencesPromptHash().
 */
export function cacheRead<T>(destination: string, key: CacheKey, expectedHash?: string): T | null {
  const slug = destinationSlug(destination)
  const filePath = entryPath(slug, key)

  if (!fs.existsSync(filePath)) return null

  try {
    const raw = fs.readFileSync(filePath, "utf-8")
    const entry: CacheEntry<T> = JSON.parse(raw)

    if (entry.ttl_days !== -1) {
      const ageDays = (Date.now() - new Date(entry.generated_at).getTime()) / (1000 * 60 * 60 * 24)
      if (ageDays > entry.ttl_days) {
        console.log(`[cache] EXPIRED  ${slug}/${key} (age: ${ageDays.toFixed(1)}d, ttl: ${entry.ttl_days}d)`)
        return null
      }
    }

    // Prompt hash validation — only reject if BOTH hashes are present AND differ.
    // Entries without a stored hash are kept (backward compatible).
    if (expectedHash && entry.prompt_hash && entry.prompt_hash !== expectedHash) {
      console.log(`[cache] STALE    ${slug}/${key} (prompt changed: ${entry.prompt_hash} → ${expectedHash})`)
      return null
    }

    console.log(`[cache] HIT      ${slug}/${key}`)
    return entry.data
  } catch (err) {
    console.warn(`[cache] READ ERR ${slug}/${key}:`, err)
    return null
  }
}

/** Write data to cache. Overwrites any existing entry. Non-fatal on error. */
export function cacheWrite<T>(
  destination: string,
  key: CacheKey,
  data: T,
  ttlDays: number,
  currentPromptHash?: string
): void {
  const slug = destinationSlug(destination)
  try {
    ensureDir(slug)
    const entry: CacheEntry<T> = {
      data,
      generated_at: new Date().toISOString(),
      ttl_days: ttlDays,
      ...(currentPromptHash ? { prompt_hash: currentPromptHash } : {}),
    }
    fs.writeFileSync(entryPath(slug, key), JSON.stringify(entry, null, 2))
    console.log(`[cache] WRITE    ${slug}/${key}`)
    _updateIndex(destination, slug, key)
  } catch (err) {
    // Non-fatal — cache write failure must not break the request
    console.warn(`[cache] WRITE ERR ${slug}/${key}:`, err)
  }
}

/** Delete all stale board_* files for a destination, keeping only the current hash. */
export function pruneOldBoards(destination: string): void {
  const slug = destinationSlug(destination)
  const dir = path.join(DESTINATIONS_DIR, slug)
  if (!fs.existsSync(dir)) return

  const current = `${boardCacheKey()}.json`
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith("board_") && file !== current) {
      fs.unlinkSync(path.join(dir, file))
      console.log(`[cache] PRUNED   ${slug}/${file}`)
    }
  }
}

// ─── Cache status ─────────────────────────────────────────────────────────────

export interface DestinationCacheStatus {
  destination: string
  slug: string
  has_context: boolean
  has_board: boolean
  board_current: boolean    // true if cached board matches current prompt hash
  board_prompt_hash: string | null
  weather_months: string[]  // e.g. ["november", "april"]
  has_experiences: boolean
  generated_at: string | null
}

export function cacheStatus(destination: string): DestinationCacheStatus {
  const slug = destinationSlug(destination)
  const dir = path.join(DESTINATIONS_DIR, slug)
  const current = boardCacheKey()

  if (!fs.existsSync(dir)) {
    return {
      destination, slug,
      has_context: false, has_board: false, board_current: false,
      board_prompt_hash: null, weather_months: [], has_experiences: false, generated_at: null,
    }
  }

  const files = fs.readdirSync(dir)
  const boardFiles = files.filter(f => f.startsWith("board_"))
  const weatherMonths = files
    .filter(f => f.startsWith("weather_"))
    .map(f => f.replace("weather_", "").replace(".json", ""))

  let boardHash: string | null = null
  let generatedAt: string | null = null
  const currentBoardFile = `${current}.json`

  const boardFileToRead = files.find(f => f === currentBoardFile) ?? boardFiles[0]
  if (boardFileToRead) {
    try {
      const entry = JSON.parse(fs.readFileSync(path.join(dir, boardFileToRead), "utf-8"))
      boardHash = entry.prompt_hash ?? null
      generatedAt = entry.generated_at ?? null
    } catch { /* ignore */ }
  }

  return {
    destination, slug,
    has_context: files.includes("destination_context.json"),
    has_board: boardFiles.length > 0,
    board_current: files.includes(currentBoardFile),
    board_prompt_hash: boardHash,
    weather_months: weatherMonths,
    has_experiences: files.includes("experiences.json"),
    generated_at: generatedAt,
  }
}

export function listCachedDestinations(): DestinationCacheStatus[] {
  if (!fs.existsSync(DESTINATIONS_DIR)) return []
  const index = _readIndex()
  return fs.readdirSync(DESTINATIONS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== ".gitkeep")
    .map(e => {
      const dest = Object.keys(index).find(d => destinationSlug(d) === e.name) ?? e.name
      return cacheStatus(dest)
    })
}

// ─── Index (internal) ─────────────────────────────────────────────────────────

interface CacheIndex {
  [destination: string]: { slug: string; last_updated: string; keys: string[] }
}

function _readIndex(): CacheIndex {
  try {
    if (fs.existsSync(INDEX_FILE)) return JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"))
  } catch { /* ignore */ }
  return {}
}

function _updateIndex(destination: string, slug: string, key: string): void {
  try {
    const index = _readIndex()
    if (!index[destination]) index[destination] = { slug, last_updated: "", keys: [] }
    index[destination].last_updated = new Date().toISOString()
    if (!index[destination].keys.includes(key)) index[destination].keys.push(key)
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2))
  } catch { /* non-fatal */ }
}
