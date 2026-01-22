import { google } from 'googleapis';
import type { drive_v3, sheets_v4 } from 'googleapis';
import { getGoogleAuth } from '@/lib/googleAuth';
import { readSheetConfig, writeSheetConfig } from '@/lib/sheetConfig';
import { DRIVE_FOLDER_ID, HEADER_ROW, SHEET_NAME, SHEET_TITLE } from '@/lib/serverConfig';
import type { Entry, EntryWithRow } from '@/lib/types';

const CACHE_TTL_MS = 15_000;
let entriesCache: { entries: EntryWithRow[]; fetchedAt: number } | null = null;
let cachedSpreadsheetId: string | null = null;
let cachedSheetTabId: number | null = null;

const LEGACY_HEADER_ROW = ['Date', 'Small', 'Medium', 'Large', 'XL', 'J', 'Damaged', 'Mortality', 'Notes'];
const LAST_COLUMN = columnLetter(HEADER_ROW.length);

function toRow(entry: Entry): Array<string | number> {
  return [
    entry.date,
    entry.houseId,
    entry.small,
    entry.medium,
    entry.large,
    entry.xl,
    entry.j,
    entry.damaged,
    entry.mortality,
    entry.notes,
    entry.waterPh ?? '',
    entry.eggYolkColor ?? '',
    entry.avgHenWeightKg ?? '',
    entry.waterIntakeMl ?? '',
    entry.feedType ?? '',
    entry.waterAdditives ?? ''
  ];
}

async function getClients() {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });
  return { sheets, drive };
}

async function findSheetInFolder(drive: drive_v3.Drive): Promise<string | null> {
  const res = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name='${SHEET_TITLE}' and trashed=false`,
    fields: 'files(id, name)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });
  return res.data.files?.[0]?.id ?? null;
}

async function moveSheetToFolder(drive: drive_v3.Drive, sheetId: string): Promise<void> {
  const file = await drive.files.get({
    fileId: sheetId,
    fields: 'parents',
    supportsAllDrives: true
  });
  const previousParents = file.data.parents?.join(',');
  const params: drive_v3.Params$Resource$Files$Update = {
    fileId: sheetId,
    addParents: DRIVE_FOLDER_ID,
    fields: 'id, parents',
    supportsAllDrives: true
  };
  if (previousParents) {
    params.removeParents = previousParents;
  }
  await drive.files.update(params);
}

async function resolveSpreadsheetId(
  sheets: sheets_v4.Sheets,
  drive: drive_v3.Drive
): Promise<string> {
  if (process.env.GOOGLE_SHEET_ID) {
    cachedSpreadsheetId = process.env.GOOGLE_SHEET_ID;
    return process.env.GOOGLE_SHEET_ID;
  }

  if (cachedSpreadsheetId) return cachedSpreadsheetId;

  const config = readSheetConfig();
  if (config?.sheetId) {
    cachedSpreadsheetId = config.sheetId;
    return config.sheetId;
  }

  const existingId = await findSheetInFolder(drive);
  if (existingId) {
    writeSheetConfig({ sheetId: existingId });
    cachedSpreadsheetId = existingId;
    return existingId;
  }

  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: SHEET_TITLE },
      sheets: [{ properties: { title: SHEET_NAME } }]
    }
  });

  const spreadsheetId = createRes.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('Failed to create spreadsheet');
  }

  await moveSheetToFolder(drive, spreadsheetId);
  writeSheetConfig({ sheetId: spreadsheetId });
  cachedSpreadsheetId = spreadsheetId;

  return spreadsheetId;
}

async function ensureDailyLogSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  if (cachedSheetTabId) return cachedSheetTabId;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties'
  });
  const existing = meta.data.sheets?.find((sheet) => sheet.properties?.title === SHEET_NAME);
  if (existing?.properties?.sheetId != null) {
    cachedSheetTabId = existing.properties.sheetId;
    return existing.properties.sheetId;
  }

  const created = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: SHEET_NAME } } }]
    }
  });

  const sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (sheetId == null) {
    throw new Error('Failed to create DailyLog tab');
  }

  cachedSheetTabId = sheetId;
  return sheetId;
}

async function ensureHeader(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTabId: number
): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!1:1`
  });
  const current = res.data.values?.[0] ?? [];
  const currentKey = current.join('|');
  const matches = HEADER_ROW.join('|') === currentKey;
  if (matches) return;

  if (currentKey === LEGACY_HEADER_ROW.join('|')) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: sheetTabId,
                dimension: 'COLUMNS',
                startIndex: 1,
                endIndex: 2
              },
              inheritFromBefore: false
            }
          }
        ]
      }
    });

    const dateRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A2:A`
    });
    const rowCount = dateRes.data.values?.length ?? 0;
    if (rowCount > 0) {
      const houseValues = Array.from({ length: rowCount }, () => ['House 1']);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!B2:B${rowCount + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: houseValues }
      });
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!1:1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADER_ROW] }
  });
}

async function getSheetContext() {
  const { sheets, drive } = await getClients();
  const spreadsheetId = await resolveSpreadsheetId(sheets, drive);
  if (cachedSpreadsheetId && cachedSpreadsheetId !== spreadsheetId) {
    cachedSheetTabId = null;
  }
  const sheetTabId = await ensureDailyLogSheet(sheets, spreadsheetId);
  await ensureHeader(sheets, spreadsheetId, sheetTabId);
  return { sheets, drive, spreadsheetId, sheetTabId };
}

function parseRow(row: Array<string | number>, rowNumber: number): EntryWithRow | null {
  const date = String(row[0] ?? '').trim();
  if (!date) return null;

  const houseId = String(row[1] ?? '').trim() || 'House 1';

  return {
    date,
    houseId,
    small: Number(row[2] ?? 0),
    medium: Number(row[3] ?? 0),
    large: Number(row[4] ?? 0),
    xl: Number(row[5] ?? 0),
    j: Number(row[6] ?? 0),
    damaged: Number(row[7] ?? 0),
    mortality: Number(row[8] ?? 0),
    notes: String(row[9] ?? ''),
    waterPh: row[10] === '' || row[10] == null ? null : Number(row[10]),
    eggYolkColor: row[11] === '' || row[11] == null ? null : Number(row[11]),
    avgHenWeightKg: row[12] === '' || row[12] == null ? null : Number(row[12]),
    waterIntakeMl: row[13] === '' || row[13] == null ? null : Number(row[13]),
    feedType: String(row[14] ?? ''),
    waterAdditives: String(row[15] ?? ''),
    rowNumber
  };
}

export async function listEntries(): Promise<Entry[]> {
  const entries = await listEntriesWithRows();
  return entries.map(({ rowNumber, ...rest }) => rest);
}

async function listEntriesWithRows(): Promise<EntryWithRow[]> {
  if (entriesCache && Date.now() - entriesCache.fetchedAt < CACHE_TTL_MS) {
    return entriesCache.entries;
  }

  const { sheets, spreadsheetId } = await getSheetContext();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:${LAST_COLUMN}`
  });
  const rows = res.data.values ?? [];
  const entries = rows
    .map((row, index) => parseRow(row, index + 2))
    .filter((row): row is EntryWithRow => row != null);

  entriesCache = { entries, fetchedAt: Date.now() };
  return entries;
}

function invalidateCache() {
  entriesCache = null;
}

export async function upsertEntry(entry: Entry): Promise<Entry> {
  const { sheets, spreadsheetId } = await getSheetContext();
  const entries = await listEntriesWithRows();
  const existing = entries.find((row) => row.date === entry.date && row.houseId === entry.houseId);

  if (existing) {
    const range = `${SHEET_NAME}!A${existing.rowNumber}:${LAST_COLUMN}${existing.rowNumber}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [toRow(entry)] }
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAME}!A2:${LAST_COLUMN}`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [toRow(entry)] }
    });
  }

  invalidateCache();
  return entry;
}

export async function deleteEntry(date: string, houseId: string): Promise<void> {
  const { sheets, spreadsheetId, sheetTabId } = await getSheetContext();
  const entries = await listEntriesWithRows();
  const existing = entries.find((row) => row.date === date && row.houseId === houseId);
  if (!existing) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetTabId,
              dimension: 'ROWS',
              startIndex: existing.rowNumber - 1,
              endIndex: existing.rowNumber
            }
          }
        }
      ]
    }
  });

  invalidateCache();
}


function columnLetter(index: number): string {
  let letters = '';
  let value = index;
  while (value > 0) {
    const mod = (value - 1) % 26;
    letters = String.fromCharCode(65 + mod) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}
