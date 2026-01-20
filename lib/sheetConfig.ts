import fs from 'fs';
import path from 'path';
import { LOCAL_SHEET_CONFIG_PATH } from '@/lib/serverConfig';

export type SheetConfig = {
  sheetId: string;
};

export function readSheetConfig(): SheetConfig | null {
  const filePath = path.join(process.cwd(), LOCAL_SHEET_CONFIG_PATH);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as SheetConfig;
    if (parsed.sheetId) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function writeSheetConfig(config: SheetConfig): void {
  const filePath = path.join(process.cwd(), LOCAL_SHEET_CONFIG_PATH);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}
