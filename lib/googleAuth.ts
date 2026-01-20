import fs from 'fs';
import { google } from 'googleapis';

export function getGoogleAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  }

  let credentials: Record<string, string>;
  if (raw.trim().startsWith('{')) {
    credentials = JSON.parse(raw);
  } else {
    const file = fs.readFileSync(raw, 'utf8');
    credentials = JSON.parse(file);
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  });
}
