import type { Entry } from '@/lib/types';
import { isIsoDate } from '@/lib/date';

const COUNT_FIELDS: Array<
  keyof Omit<
    Entry,
    | 'date'
    | 'houseId'
    | 'notes'
    | 'waterPh'
    | 'eggYolkColor'
    | 'avgHenWeightKg'
    | 'waterIntakeMl'
    | 'feedType'
    | 'waterAdditives'
  >
> = [
  'small',
  'medium',
  'large',
  'xl',
  'j',
  'damaged',
  'mortality'
];

function parseOptionalNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error('Invalid optional numeric value');
  }
  return parsed;
}

export function normalizeEntry(payload: Partial<Entry>): Entry {
  if (!payload.date || !isIsoDate(payload.date)) {
    throw new Error('Date is required in YYYY-MM-DD format');
  }
  const houseId = String(payload.houseId ?? '').trim();
  if (!houseId) {
    throw new Error('House is required');
  }

  const normalized: Entry = {
    date: payload.date,
    houseId,
    small: Number(payload.small ?? 0),
    medium: Number(payload.medium ?? 0),
    large: Number(payload.large ?? 0),
    xl: Number(payload.xl ?? 0),
    j: Number(payload.j ?? 0),
    damaged: Number(payload.damaged ?? 0),
    mortality: Number(payload.mortality ?? 0),
    notes: String(payload.notes ?? ''),
    waterPh: parseOptionalNumber(payload.waterPh),
    eggYolkColor: parseOptionalNumber(payload.eggYolkColor),
    avgHenWeightKg: parseOptionalNumber(payload.avgHenWeightKg),
    waterIntakeMl: parseOptionalNumber(payload.waterIntakeMl),
    feedType: String(payload.feedType ?? ''),
    waterAdditives: String(payload.waterAdditives ?? '')
  };

  for (const key of COUNT_FIELDS) {
    const value = normalized[key];
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid value for ${key}`);
    }
  }

  const optionalNumericKeys: Array<keyof Entry> = [
    'waterPh',
    'eggYolkColor',
    'avgHenWeightKg',
    'waterIntakeMl'
  ];
  for (const key of optionalNumericKeys) {
    const value = normalized[key];
    if (value == null) continue;
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      throw new Error(`Invalid value for ${key}`);
    }
  }

  return normalized;
}
