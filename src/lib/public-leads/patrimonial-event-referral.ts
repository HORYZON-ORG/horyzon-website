// An absent code keeps the old v2 payload/hash byte-for-byte compatible.
// Malformed/duplicate parameters must never silently become a direct request.
export function eventReferralFromSearch(search: string): string | null | undefined {
  const codes = new URLSearchParams(search).getAll('ref');
  if (!codes.length) return undefined;
  return codes.length === 1 && /^[0-9a-f]{32}$/.test(codes[0]) ? codes[0] : null;
}
