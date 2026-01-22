export type HenStandardPoint = { week: number; hdep: number };

export const HEN_STANDARD: HenStandardPoint[] = [
  { week: 18, hdep: 0.0 },
  { week: 19, hdep: 10.0 },
  { week: 20, hdep: 45.0 },
  { week: 21, hdep: 65.1 },
  { week: 22, hdep: 80.2 },
  { week: 23, hdep: 88.4 },
  { week: 24, hdep: 92.0 },
  { week: 25, hdep: 93.1 },
  { week: 26, hdep: 93.8 },
  { week: 27, hdep: 94.3 },
  { week: 28, hdep: 94.7 },
  { week: 29, hdep: 95.0 },
  { week: 30, hdep: 95.2 },
  { week: 31, hdep: 95.3 },
  { week: 32, hdep: 95.3 },
  { week: 33, hdep: 95.3 },
  { week: 34, hdep: 95.2 },
  { week: 35, hdep: 95.1 },
  { week: 36, hdep: 95.0 },
  { week: 37, hdep: 94.8 },
  { week: 38, hdep: 94.5 },
  { week: 39, hdep: 94.3 },
  { week: 40, hdep: 94.0 },
  { week: 41, hdep: 93.7 },
  { week: 42, hdep: 93.5 },
  { week: 43, hdep: 93.2 },
  { week: 44, hdep: 92.9 },
  { week: 45, hdep: 92.6 },
  { week: 46, hdep: 92.3 },
  { week: 47, hdep: 91.9 },
  { week: 48, hdep: 91.6 },
  { week: 49, hdep: 91.3 },
  { week: 50, hdep: 90.9 },
  { week: 51, hdep: 90.5 },
  { week: 52, hdep: 90.0 },
  { week: 53, hdep: 89.6 },
  { week: 54, hdep: 89.2 },
  { week: 55, hdep: 88.8 },
  { week: 56, hdep: 88.3 },
  { week: 57, hdep: 87.8 },
  { week: 58, hdep: 87.3 },
  { week: 59, hdep: 86.8 },
  { week: 60, hdep: 86.3 },
  { week: 61, hdep: 85.7 },
  { week: 62, hdep: 85.2 },
  { week: 63, hdep: 84.6 },
  { week: 64, hdep: 84.1 },
  { week: 65, hdep: 83.6 },
  { week: 66, hdep: 83.0 },
  { week: 67, hdep: 82.5 },
  { week: 68, hdep: 81.9 },
  { week: 69, hdep: 81.4 },
  { week: 70, hdep: 80.8 },
  { week: 71, hdep: 80.3 },
  { week: 72, hdep: 79.7 },
  { week: 73, hdep: 79.2 },
  { week: 74, hdep: 78.6 },
  { week: 75, hdep: 78.1 },
  { week: 76, hdep: 77.5 },
  { week: 77, hdep: 77.0 },
  { week: 78, hdep: 76.4 },
  { week: 79, hdep: 75.9 },
  { week: 80, hdep: 75.3 },
  { week: 81, hdep: 74.8 },
  { week: 82, hdep: 74.2 },
  { week: 83, hdep: 73.6 },
  { week: 84, hdep: 73.1 },
  { week: 85, hdep: 72.5 },
  { week: 86, hdep: 71.9 },
  { week: 87, hdep: 71.4 },
  { week: 88, hdep: 70.8 },
  { week: 89, hdep: 70.2 },
  { week: 90, hdep: 69.7 },
  { week: 91, hdep: 69.1 },
  { week: 92, hdep: 68.5 },
  { week: 93, hdep: 67.9 },
  { week: 94, hdep: 67.4 },
  { week: 95, hdep: 66.8 }
];

export function standardHdepForWeek(week: number): number | null {
  if (HEN_STANDARD.length === 0) return null;
  const sorted = HEN_STANDARD;
  if (week <= sorted[0].week) return sorted[0].hdep;
  if (week >= sorted[sorted.length - 1].week) return sorted[sorted.length - 1].hdep;

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (week >= current.week && week <= next.week) {
      const span = next.week - current.week;
      const t = span === 0 ? 0 : (week - current.week) / span;
      return current.hdep + t * (next.hdep - current.hdep);
    }
  }
  return null;
}
