export type Entry = {
  date: string;
  small: number;
  medium: number;
  large: number;
  xl: number;
  j: number;
  damaged: number;
  mortality: number;
  notes: string;
};

export type EntryWithRow = Entry & { rowNumber: number };
