# TravelGPT — Architecture

---

## Phasing at a Glance

```
Phase 1.0  ──►  Phase 1.1  ──►  Phase 2  ──►  Phase 3
LLM only        + Google         + UI           + Database
                  Places
```

Each phase is strictly additive. Later phases do not require rewriting earlier ones.

---

## Phase 1.0 — System Architecture

No database. No external search. One API endpoint. One call to Claude.

```mermaid
graph LR
    Client["API Client\n(curl / Postman / future UI)"]
    API["POST /api/generate\n(Next.js Route Handler)"]
    Claude["Anthropic Claude\nclaude-sonnet-4-6"]

    Client -- "destination + preferences" --> API
    API -- "structured prompt" --> Claude
    Claude -- "JSON board" --> API
    API -- "board JSON" --> Client
```

---

## Phase 1.0 — Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as /api/generate
    participant Claude as Claude claude-sonnet-4-6

    C->>API: POST {destination, preferences?}
    API->>API: Build prompt from destination + preferences
    API->>Claude: System prompt + user prompt
    Claude-->>API: Structured JSON (themes + experience cards)
    API->>API: Validate + parse response
    API-->>C: Board JSON
```

**Target latency:** 5–15 seconds for a full board. Acceptable for alpha. Streaming added in Phase 2 if needed.

---

## Phase 1.0 — Prompt Pipeline

The quality of the product in Phase 1.0 lives entirely in the prompt design.

```mermaid
flowchart TD
    Input["User input\ndestination + preferences"]

    Input --> SysPrompt

    subgraph Prompt["Prompt Assembly"]
        SysPrompt["System prompt\n— role: expert travel curator\n— de-duplication rules\n— local intelligence rules\n— output schema definition\n— quality standards"]
        UserPrompt["User prompt\n— destination name\n— destination type inference\n— preference context block\n— theme selection instruction\n— card generation instruction"]
    end

    SysPrompt --> Claude
    UserPrompt --> Claude

    Claude["Claude claude-sonnet-4-6\n(tool-use / structured output mode)"]

    Claude --> Validate["Validate JSON schema"]
    Validate --> Response["Return board JSON"]
```

### Prompt responsibilities

**System prompt (cached — same for every request):**
- Role definition: expert travel curator, not a generic AI assistant
- De-duplication rule: one card per underlying experience, never per operator
- Local intelligence rule: tips must be specific and actionable, not generic
- Output schema with field definitions and types
- Quality floor: if Claude cannot generate a confident, specific card, omit it rather than padding

**User prompt (built per request):**
- Destination name and inferred type (city / island / national park / region)
- Formatted preference block when provided
- Instruction to select 6–10 relevant themes for this destination type
- Instruction to generate 10–15 cards per theme in ranked order
- Instruction to populate `personalization_note` for any card that conflicts with preferences

---

## Phase 1.1 — Adding Google Places Grounding

Phase 1.1 adds one new endpoint. The `/api/generate` endpoint is unchanged.

```mermaid
graph LR
    Client["API Client"]
    Generate["POST /api/generate\n(unchanged)"]
    Enrich["POST /api/enrich\n(new in 1.1)"]
    Claude["Claude"]
    Places["Google Places API"]

    Client -- "destination + preferences" --> Generate
    Generate --> Claude
    Claude --> Generate
    Generate -- "board JSON" --> Client

    Client -- "experience list" --> Enrich
    Enrich -- "name + destination per experience" --> Places
    Places -- "photos, rating, hours, coords" --> Enrich
    Enrich -- "enriched experience list" --> Client
```

### Enrichment flow per experience card

```mermaid
sequenceDiagram
    participant API as /api/enrich
    participant Places as Google Places API

    loop for each experience (parallel)
        API->>Places: Text Search "{name} {destination}"
        Places-->>API: place_id + top match
        API->>Places: Place Details (place_id) — fields: photos, rating, hours, geometry, url
        Places-->>API: detail payload
        API->>API: attach to experience card
    end

    API-->>Client: enriched experiences
```

Cards where Places returns no confident match get `places_enrichment: null`. They remain on the board — enrichment is additive, not required.

---

## Phase 2 — Stateless UI

Phase 2 adds a Next.js frontend. The backend is unchanged.

```mermaid
graph TD
    subgraph Browser["Browser"]
        UI["Next.js UI\n(App Router, Client Components)"]
        LS["localStorage\n(preferences, selections)"]
    end

    subgraph Server["Vercel (Next.js)"]
        Generate["POST /api/generate"]
        Enrich["POST /api/enrich"]
    end

    Claude["Claude"]
    Places["Google Places API"]

    UI -- "destination + prefs" --> Generate
    Generate --> Claude
    Claude --> Generate
    Generate --> UI

    UI -- "experience list" --> Enrich
    Enrich --> Places
    Places --> Enrich
    Enrich --> UI

    UI -- "save selections + prefs" --> LS
    LS -- "restore on reload" --> UI
```

### UI component structure

```mermaid
graph TD
    Home["Home Page\n(search input)"]
    Board["Board Page\n(/board?destination=...)"]
    Shortlist["Shortlist Panel\n(selected cards)"]

    subgraph BoardComponents["Board Components"]
        Header["BoardHeader\n(destination name + summary)"]
        ThemeNav["ThemeNav\n(chip scroll)"]
        ThemeSection["ThemeSection × N\n(one per theme)"]
        CardGrid["CardGrid\n(10–15 cards per theme)"]
        PreviewCard["PreviewCard"]
        DetailPanel["DetailPanel\n(slide-in on click)"]
    end

    subgraph CardParts["Card Parts"]
        Actions["CardActions\n(select / dismiss)"]
        LocalTip["LocalTip badge"]
        PrefFlag["PersonalizationFlag"]
        Enrichment["EnrichmentLayer\n(photos, rating — Phase 1.1)"]
    end

    Home --> Board
    Board --> Header
    Board --> ThemeNav
    Board --> ThemeSection
    Board --> Shortlist
    ThemeSection --> CardGrid
    CardGrid --> PreviewCard
    PreviewCard --> DetailPanel
    PreviewCard --> Actions
    PreviewCard --> LocalTip
    PreviewCard --> PrefFlag
    PreviewCard --> Enrichment
```

**Client state (localStorage only, no server):**
- User preferences
- Per-experience selection status (selected / dismissed / none)

---

## Phase 3 — Persistence

Phase 3 introduces Supabase. The API and UI from earlier phases are unchanged.

```mermaid
graph TD
    UI["Next.js UI"]
    Generate["POST /api/generate"]
    Enrich["POST /api/enrich"]
    Cache["Board cache check\n(new in Phase 3)"]

    subgraph Supabase["Supabase"]
        Auth["Auth\n(magic link)"]
        DB["PostgreSQL\n(boards, trips, preferences)"]
    end

    Claude["Claude"]
    Places["Google Places"]

    UI --> Auth
    UI -- "destination" --> Cache
    Cache -- "cached board exists" --> UI
    Cache -- "no cache" --> Generate
    Generate --> Claude
    Claude --> Generate
    Generate --> DB
    Generate --> UI

    UI -- "save trip / preferences" --> DB
    DB -- "restore on login" --> UI
```

**What Phase 3 adds:**
- Board caching (generated boards stored so Claude is not re-called on repeat visits)
- User accounts (magic link auth)
- Saved trips and shortlists
- Preference profiles across devices
- Shareable shortlist links
- Historical trip archive

The database schema for Phase 3 is designed but not built until Phases 1 and 2 are validated.

---

## Directory Structure (Phase 1.0)

```
travel-gpt/
├── app/
│   └── api/
│       ├── generate/
│       │   └── route.ts        # POST /api/generate
│       └── enrich/
│           └── route.ts        # POST /api/enrich (Phase 1.1)
├── lib/
│   ├── claude/
│   │   ├── client.ts           # Anthropic SDK setup
│   │   ├── prompts.ts          # System prompt + user prompt builders
│   │   └── schema.ts           # Output JSON schema definition
│   ├── places/
│   │   └── client.ts           # Google Places API wrapper (Phase 1.1)
│   └── types.ts                # Shared TypeScript types (Board, Theme, Experience)
└── .env.local
    # ANTHROPIC_API_KEY
    # GOOGLE_PLACES_API_KEY     (Phase 1.1)
```

Phase 2 adds `app/` pages and `components/`. Phase 3 adds `lib/supabase/` and `supabase/migrations/`.

---

## Tech Decisions

| Decision | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 App Router | Single repo for API + UI; simple deployment |
| AI model | claude-sonnet-4-6 | Strong structured output, large context window, prompt caching |
| Structured output | Claude tool-use mode | Guarantees JSON schema compliance on every call |
| Prompt caching | System prompt cached | System prompt is identical across all requests — ~40% token savings |
| Web research | None in Phase 1.0 | Claude's embedded knowledge is sufficient for destination discovery |
| Places grounding | Google Places API | Industry standard; best photo + review coverage; Phase 1.1 |
| Database | None until Phase 3 | Avoids premature complexity; validate product first |
| Deployment | Vercel | Zero-config Next.js |

---

## Key Risks

| Risk | Mitigation |
|---|---|
| Claude output doesn't match schema | Use tool-use / structured output mode; validate on server before returning |
| Generic output feels like ChatGPT | Prompt design is the whole product in Phase 1.0 — invest here first |
| Latency too high (15s+ response) | Add streaming in Phase 2; for Phase 1.0 it is acceptable |
| Places API finds wrong match | Confidence threshold on Places match; fall back to `null` enrichment |
| Knowledge cutoff misses recent changes | Phase 1.1 Places grounding catches closures/hours; acceptable trade-off for 1.0 |
