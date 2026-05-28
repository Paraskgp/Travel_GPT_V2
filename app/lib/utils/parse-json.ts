/**
 * Strip markdown code fences and parse JSON.
 * LLMs occasionally wrap JSON responses in ```json ... ``` — this handles that.
 */
export function parseJSON<T>(raw: string): T {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  return JSON.parse(stripped) as T
}
