# Module: Weather Context

## What it does

Generates a full 12-month climate profile for a destination, plus specific travel implications for the traveler's target month. Used by board generation to surface seasonally relevant experiences, by the itinerary planner to schedule around weather windows, and displayed directly to the user in the board UI.

## Inputs

- Destination name
- Travel month label (e.g. "November 2026") — optional; if provided, implications are month-specific

## Outputs

- **Annual summary** — one paragraph on the overall climate character
- **Monthly data** — for all 12 months: high/low temps (°F and °C), rainfall, rainy days, wind, humidity, UV index, sunrise/sunset, daylight hours, season type, season notes
- **Travel implications** — 3–5 actionable notes specific to the travel month (or general if no month given)

## Success criteria

- All 12 months present with complete numeric data
- Season type accurately classified (`off_season`, `shoulder_season`, `peak_season`) for each month
- Travel implications are actionable and month-specific — not generic advice applicable to any destination
- Output is valid JSON matching the `WeatherContext` type

## Evaluation criteria

- Numeric plausibility: temperatures and rainfall within realistic ranges for the region and season
- Implication quality: do the travel implications change how you'd plan the trip? Generic ("bring layers") scores 0; specific ("Angels Landing chains may have ice — bring microspikes") scores high
- Season type accuracy: peak/shoulder/off correctly reflects real travel patterns, not just temperature

## Simplifying assumptions

- Generated from LLM climate knowledge — not live weather data or historical APIs
- Climate averages are stable enough to cache permanently (TTL = -1, never expires)
- One set of data per month regardless of year (November 2026 = November any year)

## Open items

- No live weather integration (e.g. weather.gov, OpenWeatherMap) — current data is LLM averages
- Flash flood risk and wildfire smoke (relevant for Zion, Yellowstone) not explicitly modelled in the schema
