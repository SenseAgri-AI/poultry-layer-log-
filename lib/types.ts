export type Entry = {
  date: string;
  houseId: string;
  small: number;
  medium: number;
  large: number;
  xl: number;
  j: number;
  damaged: number;
  mortality: number;
  notes: string;
  waterPh: number | null;
  eggYolkColor: number | null;
  avgHenWeightKg: number | null;
  waterIntakeMl: number | null;
  feedType: string;
  waterAdditives: string;
  avgEggWeightG: number | null;
};

export type EntryWithRow = Entry & { rowNumber: number };

export type House = {
  id: string;
  name: string;
  startDate: string;
  startAgeDays: number;
  startingHens: number;
};

export type HouseWithRow = House & { rowNumber: number };
