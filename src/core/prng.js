// Deterministic PRNG + coherent noise. Pure JS, no deps (node-testable).

// FNV-1a hash of a string -> unsigned 32-bit seed.
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: tiny, fast, reproducible PRNG.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded 2D value-noise with smooth interpolation (coherent, deterministic).
export function makeValueNoise2D(seed) {
  const rand = mulberry32(hashString('noise:' + seed));
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;

  function noise2(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const X = xi & 255;
    const Y = yi & 255;
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    // map lattice values from [0,255] to [-1,1] so interpolation is centered
    const toN = (v) => (v / 127.5) - 1;
    return lerp(lerp(toN(aa), toN(ba), u), lerp(toN(ab), toN(bb), u), v);
  }

  // Fractal Brownian motion in roughly [-1, 1].
  return function fbm(x, y, octaves = 4, persistence = 0.5, lacunarity = 2) {
    let total = 0;
    let amp = 1;
    let freq = 1;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      total += noise2(x * freq, y * freq) * amp;
      max += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return total / max;
  };
}

// Ridged noise: useful for mountain spines. Output in [-1, 1].
export function makeRidgedNoise2D(seed) {
  const base = makeValueNoise2D('ridge:' + seed);
  return function (x, y, octaves = 4, persistence = 0.5, lacunarity = 2) {
    let total = 0;
    let amp = 1;
    let freq = 1;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(base(x * freq, y * freq)); // ridge in [0,1]
      total += n * n * amp;
      max += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return total / max; // in [0,1]
  };
}
