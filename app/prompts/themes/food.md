# Theme: Food & Drink

## Purpose
Help the traveler understand the destination through its food and drink — both what eating here *means* (iconic dishes, culinary rituals, regional specialties) and how to eat their way through it (markets, crawl routes, culinary neighborhoods). This is one theme, not two.

## What belongs here
- Iconic dishes, drinks, and culinary rituals that define the destination or region
- Specific food experiences worth seeking out: the dish, the stall, the bar, the ritual
- Farmers markets, night markets, food halls, covered markets, street food areas
- Culinary neighborhoods where the density of good eating makes wandering rewarding
- Self-guided food crawl routes (a street, a neighborhood, a market district)
- Producer experiences: coffee farm, fish market, sake brewery, spice market, cheese region
- Drinks that are central to the destination's identity: local wine, spirits, tea, coffee, beer
- Culinary workshops where the making and the eating are the same experience (soba-making class, sake brewery tour, miso fermentation visit)

## What does NOT belong here
- Generic restaurant recommendations without a specific experiential angle — "great restaurants in X" is not a card
- Destination-specific workshops where the craft is inseparable from the place (perfume in Paris, pottery in Kyoto, woodblock printing in Tokyo) — those go in `unique_local`
- Markets that are primarily shopping rather than food — those go in `shopping`

## Coverage tiers — include at least one card from each applicable tier

**Tier 1 — Quick / Casual** (street food, markets, food stalls, cafes, under 45 min, low cost)
Examples: street food stall, morning market, local bakery, roadside BBQ, quick-service noodle shop
Party type applicability: ALL — especially important for `family_young` (kids need flexible, fast options)

**Tier 2 — Sit-Down Meal** (restaurant, bistro, taverna — 1–2 hours, mid-range cost)
Examples: regional restaurant, local lunch spot, neighborhood izakaya, beach shack with full menu
Party type applicability: ALL

**Tier 3 — Immersive / Destination Experience** (cooking class, tasting menu, food tour, winery/distillery visit, producer visit — half day, premium cost)
Examples: soba-making class, sake brewery tour, farm-to-table long lunch, whisky distillery tasting
Party type applicability: `family_teens`, `couple`, `solo` — NOT `family_young`

**Tier 4 — Route / Crawl** (self-guided neighborhood crawl, market circuit, multi-stop eating route — 2–4 hours)
Examples: Tsukiji outer market circuit, Ameyoko crawl, night market loop, culinary neighborhood walk
Party type applicability: ALL — `family_young` only if the route is short and stroller-accessible

**Party type rules:**
- `family_young`: Tier 1 and Tier 2 only. `kid_friendly` dietary flag must appear on at least one card.
- For all others: include at least one per tier.

## Card guidance
- Every card must answer: why is this food or drink experience specifically worth having HERE?
- `dietary_flags` must be accurate — `vegetarian_friendly`, `vegan_friendly`, `meat_heavy`, `alcohol_centered`, `kid_friendly` as applicable
- `local_tip` should specify how to order, what to ask for, the best version, or the right time to go
- For crawl/route cards: `long_description` must explain HOW to do it — which direction to walk, what to eat in what order, how long it takes. `is_area_experience: true` and the stop-by-stop table apply.
- `best_time` matters especially for markets — many are morning-only, some evening-only, some peak specific days
- `cost_band` should reflect real local pricing, not tourist restaurant pricing
- `watch_out_for` should flag tourist traps, watered-down versions, or dishes that look iconic but underdeliver
- Rank by: most representative of the destination's food identity first

## Examples of strong food cards
- "Plate Lunch" in Hawaii — not a restaurant recommendation, but what plate lunch is, where to find the best versions, what it says about Hawaiian food culture, and what to order
- "Tsukiji Outer Market, Tokyo" — arrive by 7am, start at the tuna sashimi counter, work your way to tamagoyaki, which stalls are worth the queue, where tourists go that locals avoid
- "Pisco Sour in Lima" — not just naming the drink but explaining the ritual, the best bars, the debate between Peruvian and Chilean versions
