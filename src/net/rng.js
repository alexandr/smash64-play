// Deterministic randomness for netplay: while the simulation steps, Math.random is replaced by a
// room-seeded generator so every phone rolls the same numbers (rendering keeps the native one).
export class SeededRandom {
  constructor(seed) { this.s = seed >>> 0 || 1; }
  next() { let t = (this.s = (this.s + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  run(fn) {
    const native = Math.random;
    Math.random = () => this.next();
    try { return fn(); } finally { Math.random = native; }
  }
}
