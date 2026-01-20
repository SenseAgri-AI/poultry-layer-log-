import type { Entry } from '@/lib/types';
import { isIsoDate } from '@/lib/date';

const COUNT_FIELDS: Array<keyof Omit<Entry, 'date' | 'notes'>> = [
  'small',
  'medium',
  'large',
  'xl',
  'j',
  'damaged',
  'mortality'
];

export function normalizeEntry(payload: Partial<Entry>): Entry {
  if (!payload.date || !isIsoDate(payload.date)) {
    throw new Error('Date is required in YYYY-MM-DD format');
  }

  const normalized: Entry = {
    date: payload.date,
    small: Number(payload.small ?? 0),
    medium: Number(payload.medium ?? 0),
    large: Number(payload.large ?? 0),
    xl: Number(payload.xl ?? 0),
    j: Number(payload.j ?? 0),
    damaged: Number(payload.damaged ?? 0),
    mortality: Number(payload.mortality ?? 0),
    notes: String(payload.notes ?? '')
  };

  for (const key of COUNT_FIELDS) {
    const value = normalized[key];
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid value for ${key}`);
    }
  }

  return normalized;
}
