import { createNoise2D as createSimplexNoise2D } from 'simplex-noise';

/**
 * Create a seeded 2D noise function using Simplex noise.
 * @param seed - Seed value for deterministic noise generation
 * @returns Function that takes (x, y) and returns noise value in [-1, 1] range
 */
export function createNoise2D(seed: number): (x: number, y: number) => number {
  // Create a simple seeded PRNG for simplex-noise
  const alea = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  };

  const noise2D = createSimplexNoise2D(alea(seed));

  // Return a function that takes x, y coordinates and returns noise in [-1, 1]
  return (x: number, y: number): number => {
    return noise2D(x, y);
  };
}
