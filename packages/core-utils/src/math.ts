import { range } from 'lodash';

export function linspace(a: number, b: number, n: number): number[] {
  const step = (b - a) / (n - 1);
  const space = range(a, b, step);
  if (space.length !== n) {
    space.push(b);
  }
  return space;
}

export function logspace(a: number, b: number, n: number): number[] {
  return linspace(a, b, n).map((x) => Math.pow(10, x));
}
