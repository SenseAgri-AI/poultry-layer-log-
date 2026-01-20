import { describe, expect, it } from 'vitest';
import { averageEggWeight, qualityFromAverage, totalEggs, totalWeight } from '../lib/eggMath';

const entry = {
  small: 10,
  medium: 20,
  large: 30,
  xl: 40,
  j: 50
};

describe('egg math', () => {
  it('calculates total eggs', () => {
    expect(totalEggs(entry)).toBe(150);
  });

  it('calculates total weight', () => {
    expect(totalWeight(entry)).toBeCloseTo(
      10 * 46.5 + 20 * 53.5 + 30 * 60.5 + 40 * 67.5 + 50 * 72.0,
      5
    );
  });

  it('calculates average egg weight', () => {
    const avg = averageEggWeight(entry);
    const expected = totalWeight(entry) / totalEggs(entry);
    expect(avg).toBeCloseTo(expected, 5);
  });

  it('normalizes quality score', () => {
    expect(qualityFromAverage(43)).toBe(0);
    expect(qualityFromAverage(71)).toBe(1);
    expect(qualityFromAverage(57)).toBeGreaterThan(0);
    expect(qualityFromAverage(57)).toBeLessThan(1);
  });
});
