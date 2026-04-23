import type { Entry } from '@/lib/types';

export const WEIGHTS = {
  small: 39.0,  // < 43g, midpoint ~39g
  medium: 47.0, // 43–51g
  large: 55.0,  // 51–59g
  xl: 62.5,     // 59–66g
  j: 70.0       // > 66g
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
  const min = 39;
  const max = 70;
  const normalized = (avgWeight - min) / (max - min);
  if (normalized < 0) return 0;
  if (normalized > 1) return 1;
  return normalized;
}
