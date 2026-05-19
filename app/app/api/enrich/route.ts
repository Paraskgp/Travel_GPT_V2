import { NextRequest, NextResponse } from "next/server"
import { enrichExperience } from "@/lib/places/client"
import { Experience, PlacesEnrichment } from "@/lib/types"

interface EnrichRequest {
  destination: string
  experiences: Array<Pick<Experience, "id" | "name" | "location_hint" | "is_mappable">>
}

interface EnrichResponse {
  enriched: Array<{
    id: string
    places_enrichment: PlacesEnrichment | null
  }>
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<EnrichResponse | { error: string }>> {
  let body: EnrichRequest

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { destination, experiences } = body

  if (!destination || !Array.isArray(experiences)) {
    return NextResponse.json({ error: "destination and experiences[] are required" }, { status: 400 })
  }

  // Only enrich mappable experiences
  const mappable = experiences.filter(e => e.is_mappable)

  // Run all lookups in parallel
  const results = await Promise.allSettled(
    mappable.map(async (exp) => ({
      id: exp.id,
      places_enrichment: await enrichExperience(exp.name, exp.location_hint, destination),
    }))
  )

  const enriched: EnrichResponse["enriched"] = []

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      enriched.push(result.value)
    } else {
      console.warn(`[/api/enrich] failed for "${mappable[i].name}":`, result.reason)
      enriched.push({ id: mappable[i].id, places_enrichment: null })
    }
  })

  // Also include non-mappable experiences with null enrichment (so client gets a complete list)
  const nonMappable = experiences
    .filter(e => !e.is_mappable)
    .map(e => ({ id: e.id, places_enrichment: null }))

  return NextResponse.json({ enriched: [...enriched, ...nonMappable] })
}
