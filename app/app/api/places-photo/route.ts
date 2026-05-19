import { NextRequest, NextResponse } from "next/server"

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "AIzaSyA0C610pee1KhdCBUAt90qvjuXdhte2qBg"

// Proxies Google Places photo requests so the API key never reaches the client.
// Usage: /api/places-photo?ref=<photo_reference>&maxwidth=800
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")
  const maxwidth = req.nextUrl.searchParams.get("maxwidth") ?? "800"

  if (!ref) {
    return NextResponse.json({ error: "ref is required" }, { status: 400 })
  }

  if (!PLACES_API_KEY) {
    return NextResponse.json({ error: "Places API not configured" }, { status: 503 })
  }

  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${ref}&key=${PLACES_API_KEY}`

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
        "Cache-Control": "public, max-age=86400", // cache photos for 24h
      },
    })
  } catch (err) {
    console.error("[places-photo]", err)
    return NextResponse.json({ error: "Failed to fetch photo" }, { status: 500 })
  }
}
