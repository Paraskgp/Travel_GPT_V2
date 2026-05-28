# Theme: Signature Experiences

## Purpose
Surface the experiences that define this destination — the things a traveler would regret not doing, not because they are the most popular, but because they are the most representative of what makes this place itself.

## Non-negotiable rule for iconic destinations
**The most visually iconic, globally recognized features of a destination MUST appear in Signature.** These are not optional, and they do not belong in other themes just because they technically fit there. If Grand Prismatic Spring is at Yellowstone, it belongs here — not in Nature & Scenic. If Antelope Canyon is the defining image of Page, Arizona, it belongs here — not in Adventure. If the Eiffel Tower defines Paris's silhouette, the experience of seeing it belongs here.

Ask yourself: what are the 2–3 images that define this destination's global identity? Those experiences belong in Signature. Do not reassign them to other themes to make room — this is the theme that earns the traveler's trust.

## What belongs here
- The visually iconic, bucket-list features that travelers come specifically for
- Experiences that are unique to or best done at this destination
- A mix of famous must-dos AND lesser-known things that separate a good trip from a great one
- Not just top-reviewed tourist attractions — include the experiences that give the place its identity

## What does NOT belong here
- Generic activities available anywhere
- Things that are famous but genuinely not worth the effort — if something has a poor experience-to-hype ratio, say so in `watch_out_for` rather than omitting it
- Do NOT move an iconic feature to a "more fitting" theme just to make this theme feel varied — iconic features anchor Signature, full stop

## Card guidance
- `why_worth_it` must explain why this experience defines THIS destination specifically, not just what it is
- `local_tip` must be hyper-specific — the one piece of knowledge that separates a traveler who did their research from one who didn't. "Arrive early" is not a tip. "The Fairy Falls overlook spur (1.6 miles in, left branch) is the only place to see Grand Prismatic from above — most visitors never find it" is a tip.
- `watch_out_for` should be honest — if something is crowded, overpriced, or requires careful timing, say so plainly
- Rank by: most essential and broadly relevant first, more conditional or niche later
- Aim for 6–10 cards. For destinations with rich depth (major national parks, world-class cities), go to 10.

## Party type lens — apply BEFORE selecting experiences

If `party_type` is specified in Traveler Preferences, generate Signature through that lens from the start — not by filtering a generic list afterward.

**family_young**: The iconic experiences of this destination still belong on the board so the traveler knows what the destination is famous for. But for each iconic experience that is strenuous or inaccessible, also include its accessible equivalent in the same card or as a companion card. The traveler with a toddler needs to know: "Here is what this destination is known for, and here is the version of it that actually works for your family."

Required coverage for `family_young` — your Signature cards MUST include at least:
1. One accessible/paved short walk or boardwalk that gives a real sense of the destination (not just a "nice stroll" — the specific trail or path that is the best low-effort window into this place)
2. One drive-to or drive-through experience (scenic road, tunnel, overlook) that requires no walking
3. One indoor/visitor center experience for rest and context

These are in addition to the iconic experiences. Do not replace the iconic experiences with only easy ones — surface both.

**older_parents**: Same approach as family_young for the accessibility companion experiences.

**solo / couple / family_teens**: No change — standard Signature generation.

## Self-check before returning

Before returning your response, ask two questions:
1. What are the 3–5 experiences that define this destination's global identity — the ones that would appear on the cover of a travel magazine or documentary about this place? Every single one of them must appear somewhere on the board. If any are missing from your response, add them now.
2. If `party_type` is `family_young` or `older_parents`: is there at least one paved/accessible walk, one drive-to experience, and one indoor experience in this Signature list? If not, add them.
