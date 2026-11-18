export type OwnershipStatus = 'confirmed' | 'denied' | 'unconfirmed';

// Normalizes whatever Make/Meta actually send for the ownership question into one of three
// states, rather than the two-valued (true/false) field this used to be. Meta's raw Instant Form
// answer is an array (e.g. ["yes"] or ["no"]) -- unwrapped here defensively instead of requiring
// Make's formula editor to do it with a nested if/get/get/map formula (Fabien, 2026-11-18: that
// formula was too fragile to enter reliably through Make's UI; extraction stays in Make,
// interpretation moves here, in app/api/integrations/meta-homeowner-leads/route.ts).
//
// Only an exact, case-insensitive "yes" (after trimming whitespace) becomes `confirmed`. An exact
// "no" becomes `denied` -- the existing renter/manual-review path, unchanged. Everything else --
// missing, `null`, an empty array, an unrecognized string, a non-string/non-array value -- becomes
// `unconfirmed`. `unconfirmed` is never promoted to `confirmed` (an absent or garbled answer is
// never ownership confirmation) and is never conflated with `denied` either (Fabien's explicit
// instruction: "don't let missing or unrecognized answers silently become indistinguishable from
// an explicit no") -- "we don't know" and "they told us no" are different facts a reviewer needs
// to be able to tell apart.
export function normalizeOwnershipAnswer(raw: unknown): OwnershipStatus {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return 'unconfirmed';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'yes') return 'confirmed';
  if (normalized === 'no') return 'denied';
  return 'unconfirmed';
}
