import { NextRequest, NextResponse } from "next/server"
import { cacheStatus, listCachedDestinations, pruneOldBoards, boardCacheKey } from "@/lib/cache"

/** GET /api/cache?destination=Kyoto  →  status for one destination */
/** GET /api/cache                    →  list all cached destinations */
export async function GET(req: NextRequest) {
  const dest = req.nextUrl.searchParams.get("destination")

  if (dest) {
    return NextResponse.json(cacheStatus(dest))
  }

  return NextResponse.json({
    current_prompt_hash: boardCacheKey(),
    destinations: listCachedDestinations(),
  })
}

/** DELETE /api/cache?destination=Kyoto  →  prune stale boards for a destination */
export async function DELETE(req: NextRequest) {
  const dest = req.nextUrl.searchParams.get("destination")
  if (!dest) return NextResponse.json({ error: "destination is required" }, { status: 400 })
  pruneOldBoards(dest)
  return NextResponse.json({ ok: true, message: `Pruned stale boards for: ${dest}` })
}
