'use client'

export type ShortlistStatus = 'liked' | 'dismissed'
export type Shortlist = Record<string, ShortlistStatus>

const KEY = 'travelgpt_shortlist'

export function loadShortlist(): Shortlist {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveShortlist(list: Shortlist): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function setStatus(list: Shortlist, id: string, status: ShortlistStatus | null): Shortlist {
  const next = { ...list }
  if (status === null) {
    delete next[id]
  } else {
    next[id] = status
  }
  return next
}
