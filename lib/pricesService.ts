import { google } from 'googleapis';
import type { drive_v3, sheets_v4 } from 'googleapis';
import { getGoogleAuth } from '@/lib/googleAuth';
import { readSheetConfig, writeSheetConfig } from '@/lib/sheetConfig';
import { DRIVE_FOLDER_ID, PRICES_SHEET_NAME, PRICES_HEADER_ROW, SHEET_TITLE } from '@/lib/serverConfig';
import type { Price } from '@/lib/types';

type PriceWithRow = Price & { rowNumber: number };

const CACHE_TTL_MS = 15_000;
let pricesCache: { prices: PriceWithRow[]; fetchedAt: number } | null = null;
let cachedSpreadsheetId: string | null = null;
let cachedPricesTabId: number | null = null;

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

async function resolveSpreadsheetId(sheets: sheets_v4.Sheets, drive: drive_v3.Drive): Promise<string> {
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
    requestBody: { properties: { title: SHEET_TITLE } }
  });
  const spreadsheetId = createRes.data.spreadsheetId;
  if (!spreadsheetId) throw new Error('Failed to create spreadsheet');
  cachedSpreadsheetId = spreadsheetId;
  return spreadsheetId;
}

async function ensurePricesSheet(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const existing = meta.data.sheets?.find((s) => s.properties?.title === PRICES_SHEET_NAME);

  if (!existing) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: PRICES_SHEET_NAME } } }] }
    });
    cachedPricesTabId = created.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
  } else if (cachedPricesTabId == null) {
    cachedPricesTabId = existing.properties?.sheetId ?? null;
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${PRICES_SHEET_NAME}!1:1`
  });
  const current = res.data.values?.[0] ?? [];
  if (current.join('|') !== PRICES_HEADER_ROW.join('|')) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PRICES_SHEET_NAME}!1:1`,
      valueInputOption: 'RAW',
      requestBody: { values: [PRICES_HEADER_ROW] }
    });
  }

  return cachedPricesTabId ?? 0;
}

async function getSheetContext() {
  const { sheets, drive } = await getClients();
  const spreadsheetId = await resolveSpreadsheetId(sheets, drive);
  const pricesTabId = await ensurePricesSheet(sheets, spreadsheetId);
  return { sheets, spreadsheetId, pricesTabId };
}

function parseRow(row: Array<string | number>, rowNumber: number): PriceWithRow | null {
  const date = String(row[0] ?? '').trim();
  if (!date) return null;
  return {
    effectiveDate: date,
    small: Number(row[1] ?? 0),
    medium: Number(row[2] ?? 0),
    large: Number(row[3] ?? 0),
    xl: Number(row[4] ?? 0),
    j: Number(row[5] ?? 0),
    rowNumber
  };
}

async function listPricesWithRows(): Promise<PriceWithRow[]> {
  if (pricesCache && Date.now() - pricesCache.fetchedAt < CACHE_TTL_MS) {
    return pricesCache.prices;
  }
  const { sheets, spreadsheetId } = await getSheetContext();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${PRICES_SHEET_NAME}!A2:F`
  });
  const rows = res.data.values ?? [];
  const prices = rows
    .map((row, index) => parseRow(row, index + 2))
    .filter((p): p is PriceWithRow => p !== null);
  pricesCache = { prices, fetchedAt: Date.now() };
  return prices;
}

export async function listPrices(): Promise<Price[]> {
  const prices = await listPricesWithRows();
  return prices.map(({ rowNumber: _, ...rest }) => rest);
}

export async function addPrice(price: Price): Promise<void> {
  const { sheets, spreadsheetId } = await getSheetContext();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${PRICES_SHEET_NAME}!A2:F`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[price.effectiveDate, price.small, price.medium, price.large, price.xl, price.j]]
    }
  });
  pricesCache = null;
}

export async function deletePriceForDate(effectiveDate: string): Promise<void> {
  const { sheets, spreadsheetId, pricesTabId } = await getSheetContext();
  const prices = await listPricesWithRows();
  const existing = prices.find((p) => p.effectiveDate === effectiveDate);
  if (!existing) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: pricesTabId,
              dimension: 'ROWS',
              startIndex: existing.rowNumber - 1,
              endIndex: existing.rowNumber
            }
          }
        }
      ]
    }
  });
  pricesCache = null;
}

export function priceForDate(prices: Price[], date: string): Price | null {
  const sorted = [...prices].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  let result: Price | null = null;
  for (const p of sorted) {
    if (p.effectiveDate <= date) result = p;
    else break;
  }
  return result;
}
