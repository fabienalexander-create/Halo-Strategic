// UK mobile normalisation to E.164. Accepts 07xxxxxxxxx, +447xxxxxxxxx, 447xxxxxxxxx and
// 00447xxxxxxxxx, with spaces, dashes, dots or brackets. Anything else (landlines, non-UK, short
// or long numbers) returns null, so it is never texted.
export function normaliseUkMobile(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().replace(/[\s\-.()]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('0')) s = '44' + s.slice(1);
  // "+44 (0)7..." leaves a stray 0 after the country code.
  if (s.startsWith('440')) s = '44' + s.slice(3);
  return /^447\d{9}$/.test(s) ? `+${s}` : null;
}
