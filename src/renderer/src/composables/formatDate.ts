/**
 * Strip the time portion of an ISO date / datetime string.
 *
 * PocketBase serializes both `date` and `datetime` fields with a full ISO
 * timestamp (e.g. "2026-04-30 00:00:00.000Z"). When we just want the
 * calendar day on the screen, this trims everything from the first space
 * or 'T' onwards. Returns an empty string for empty/nullish input.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  return String(value).split(/[\sT]/)[0]
}
