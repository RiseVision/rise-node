import { range } from 'lodash';

/**
 * Generate a linearly spaced array of N points from [a, b] (inclusive range).
 *
 * Equivalent to the similarly named MATLAB function.
 *
 * @param a start of the range
 * @param b end of the range
 * @param n number of points to return
 * @returns an array of N points
 */
export function linspace(a: number, b: number, n: number): number[] {
  const step = (b - a) / (n - 1);
  const space = range(a, b, step);
  if (space.length !== n) {
    space.push(b);
  }
  return space;
}

/**
 * Generate a logarithmically spaced array of N points from [a, b] (inclusive range).
 *
 * Equivalent to the similarly named MATLAB function.
 *
 * @param a start of the range
 * @param b end of the range
 * @param n number of points to return
 * @returns an array of N points
 */
export function logspace(a: number, b: number, n: number): number[] {
  return linspace(a, b, n).map((x) => Math.pow(10, x));
}
