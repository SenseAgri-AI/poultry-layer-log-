import { google } from 'googleapis';
import type { drive_v3, sheets_v4 } from 'googleapis';
import { getGoogleAuth } from '@/lib/googleAuth';
import { readSheetConfig, writeSheetConfig } from '@/lib/sheetConfig';
import {
  DRIVE_FOLDER_ID,
  HOUSES_HEADER_ROW,
  HOUSES_SHEET_NAME,
  SHEET_TITLE
} from '@/lib/serverConfig';
import type { House, HouseWithRow } from '@/lib/types';

const CACHE_TTL_MS = 15_000;
let housesCache: { houses: HouseWithRow[]; fetchedAt: number } | null = null;
let cachedSpreadsheetId: string | null = null;
let cachedHouseTabId: number | null = null;
const LEGACY_HEADER_ROW = ['House ID', 'Name', 'Start Date', 'Start Age (weeks)', 'Starting Hens'];

function toRow(house: House): Array<string | number> {
  return [house.id, house.name, house.startDate, house.startAgeDays, house.startingHens];
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
      sheets: [{ properties: { title: HOUSES_SHEET_NAME } }]
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

async function ensureHousesSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  if (cachedHouseTabId) return cachedHouseTabId;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties'
  });
  const existing = meta.data.sheets?.find((sheet) => sheet.properties?.title === HOUSES_SHEET_NAME);
  if (existing?.properties?.sheetId != null) {
    cachedHouseTabId = existing.properties.sheetId;
    return existing.properties.sheetId;
  }

  const created = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: HOUSES_SHEET_NAME } } }]
    }
  });

  const sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (sheetId == null) {
    throw new Error('Failed to create Houses tab');
  }

  cachedHouseTabId = sheetId;
  return sheetId;
}

async function ensureHeader(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${HOUSES_SHEET_NAME}!1:1`
  });
  const current = res.data.values?.[0] ?? [];
  const currentKey = current.join('|');
  const matches = HOUSES_HEADER_ROW.join('|') === currentKey;
  if (matches) return;

  if (currentKey === LEGACY_HEADER_ROW.join('|')) {
    const ageRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${HOUSES_SHEET_NAME}!D2:D`
    });
    const ages = ageRes.data.values ?? [];
    if (ages.length > 0) {
      const converted = ages.map((row) => {
        const value = row?.[0];
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return [''];
        return [Math.round(parsed * 7)];
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${HOUSES_SHEET_NAME}!D2:D${ages.length + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: converted }
      });
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${HOUSES_SHEET_NAME}!1:1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HOUSES_HEADER_ROW] }
  });
}

async function getSheetContext() {
  const { sheets, drive } = await getClients();
  const spreadsheetId = await resolveSpreadsheetId(sheets, drive);
  if (cachedSpreadsheetId && cachedSpreadsheetId !== spreadsheetId) {
    cachedHouseTabId = null;
  }
  await ensureHousesSheet(sheets, spreadsheetId);
  await ensureHeader(sheets, spreadsheetId);
  return { sheets, spreadsheetId };
}

function parseRow(row: Array<string | number>, rowNumber: number): HouseWithRow | null {
  const id = String(row[0] ?? '').trim();
  if (!id) return null;

  return {
    id,
    name: String(row[1] ?? id).trim(),
    startDate: String(row[2] ?? ''),
    startAgeDays: Number(row[3] ?? 0),
    startingHens: Number(row[4] ?? 0),
    rowNumber
  };
}

export async function listHouses(): Promise<House[]> {
  const houses = await listHousesWithRows();
  return houses.map(({ rowNumber, ...rest }) => rest);
}

async function listHousesWithRows(): Promise<HouseWithRow[]> {
  if (housesCache && Date.now() - housesCache.fetchedAt < CACHE_TTL_MS) {
    return housesCache.houses;
  }

  const { sheets, spreadsheetId } = await getSheetContext();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${HOUSES_SHEET_NAME}!A2:E`
  });
  const rows = res.data.values ?? [];
  const houses = rows
    .map((row, index) => parseRow(row, index + 2))
    .filter((row): row is HouseWithRow => row != null);

  housesCache = { houses, fetchedAt: Date.now() };
  return houses;
}

function invalidateCache() {
  housesCache = null;
}

export async function upsertHouse(house: House): Promise<House> {
  const { sheets, spreadsheetId } = await getSheetContext();
  const houses = await listHousesWithRows();
  const existing = houses.find((row) => row.id === house.id);

  if (existing) {
    const range = `${HOUSES_SHEET_NAME}!A${existing.rowNumber}:E${existing.rowNumber}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [toRow(house)] }
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${HOUSES_SHEET_NAME}!A2:E`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [toRow(house)] }
    });
  }

  invalidateCache();
  return house;
}

export async function archiveHouse(id: string): Promise<House | null> {
  const { sheets, spreadsheetId } = await getSheetContext();
  const houses = await listHousesWithRows();
  const existing = houses.find((row) => row.id === id);
  if (!existing) return null;

  const suffix = '-archive';
  const name = existing.name.endsWith(suffix) ? existing.name : `${existing.name}${suffix}`;
  const updated: House = {
    id: existing.id,
    name,
    startDate: existing.startDate,
    startAgeDays: existing.startAgeDays,
    startingHens: existing.startingHens
  };

  const range = `${HOUSES_SHEET_NAME}!A${existing.rowNumber}:E${existing.rowNumber}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [toRow(updated)] }
  });

  invalidateCache();
  return updated;
}
