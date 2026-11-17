import { describe, it, expect } from 'vitest';
import { deepClone } from '../src/utils/helpers';

describe('deepClone', () => {
  it('preserves structure and creates a new object', () => {
    const original = { a: 1, b: { c: [1, 2, 3] } };
    const clone = deepClone(original);
    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
    expect(clone.b).not.toBe(original.b);
    expect(clone.b.c).not.toBe(original.b.c);
  });

  it('clones arrays at top level', () => {
    const arr = [1, { x: 2 }];
    const clone = deepClone(arr);
    expect(clone).toEqual(arr);
    expect(clone[1]).not.toBe(arr[1]);
  });
});
