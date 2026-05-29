import { NextRequest, NextResponse } from "next/server"

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? ""

// Proxies Google Places v1 photo requests so the API key never reaches the client.
//
// Usage: /api/places-photo?name=<resource_name>&maxWidthPx=800
//
// `name` is the URL-encoded resource name from the Places v1 API, e.g.:
//   places/ChIJH_5e4bDxAGAR.../photos/AUjq9jlT...
//
// The v1 media endpoint: GET https://places.googleapis.com/v1/{name}/media
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")
  const maxWidthPx = req.nextUrl.searchParams.get("maxWidthPx") ?? "800"

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  if (!PLACES_API_KEY) {
    return NextResponse.json({ error: "Places API not configured" }, { status: 503 })
  }

  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidthPx}&key=${PLACES_API_KEY}`

  try {
    const res = await fetch(url, { redirect: "follow" })
    if (!res.ok) {
      return NextResponse.json({ error: "Photo fetch failed" }, { status: 502 })
    }

    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get("content-type") ?? "image/jpeg"

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (err) {
    console.error("[places-photo]", err)
    return NextResponse.json({ error: "Failed to fetch photo" }, { status: 500 })
  }
}
