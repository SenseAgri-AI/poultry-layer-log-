import type { Entry } from '@/lib/types';

export const WEIGHTS = {
  small: 46.5,
  medium: 53.5,
  large: 60.5,
  xl: 67.5,
  j: 72.0
};

export function totalEggs(entry: Pick<Entry, 'small' | 'medium' | 'large' | 'xl' | 'j'>): number {
  return entry.small + entry.medium + entry.large + entry.xl + entry.j;
}

export function totalWeight(entry: Pick<Entry, 'small' | 'medium' | 'large' | 'xl' | 'j'>): number {
  return (
    entry.small * WEIGHTS.small +
    entry.medium * WEIGHTS.medium +
    entry.large * WEIGHTS.large +
    entry.xl * WEIGHTS.xl +
    entry.j * WEIGHTS.j
  );
}

export function averageEggWeight(entry: Pick<Entry, 'small' | 'medium' | 'large' | 'xl' | 'j'>): number {
  const eggs = totalEggs(entry);
  if (eggs <= 0) return 0;
  return totalWeight(entry) / eggs;
}

export function qualityFromAverage(avgWeight: number): number {
  const min = 43;
  const max = 71;
  const normalized = (avgWeight - min) / (max - min);
  if (normalized < 0) return 0;
  if (normalized > 1) return 1;
  return normalized;
}
