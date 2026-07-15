/** Deterministic helpers so scores, IDs, and seed data are fully reproducible. */

/** FNV-1a 32-bit hash of a string. */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic UUID-shaped identifier derived from a stable seed string. */
export function stableId(seed: string): string {
  const a = hash32(seed);
  const b = hash32(seed + "|b");
  const c = hash32(seed + "|c");
  const d = hash32(seed + "|d");
  const hex = (n: number) => n.toString(16).padStart(8, "0");
  const full = hex(a) + hex(b) + hex(c) + hex(d);
  return [
    full.slice(0, 8),
    full.slice(8, 12),
    "4" + full.slice(13, 16),
    ((parseInt(full.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + full.slice(17, 20),
    full.slice(20, 32),
  ].join("-");
}

/** Mulberry32 seeded PRNG — deterministic float stream in [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
