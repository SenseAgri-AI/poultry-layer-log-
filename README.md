# Poultry Layer Daily Log

A mobile-first Next.js app for logging daily poultry layer numbers. Data is stored in a Google Sheet inside the shared Drive folder and used for analytics.

## Features
- Fast daily entry with validation and duplicate-date prompts.
- Optional daily checks for water pH, yolk color, hen weight, water intake, feed type, and water additives.
- Google Sheets + Drive sync with idempotent sheet creation.
- Analytics dashboard with KPI cards and time-series charts.
- Multi-house setup with cycle start details and standard HDEP target line.
- Basic tests for egg weight and quality calculations.

## Setup

### 1) Google Cloud project
1. Create a Google Cloud project.
2. Enable APIs:
   - Google Sheets API
   - Google Drive API
3. Create a **Service Account** and download the JSON key.
4. Share the Drive folder with the service account email.
   - Folder ID: `1iJlirSU4h0C-xADAl8ZnAF94yinnYFYU`

### 2) Environment variables
Create a `.env.local` file in the project root:

```
GOOGLE_SERVICE_ACCOUNT_JSON=/absolute/path/to/service-account.json
GOOGLE_DRIVE_FOLDER_ID=1iJlirSU4h0C-xADAl8ZnAF94yinnYFYU
GOOGLE_SHEET_ID=
TIMEZONE=Africa/Johannesburg
NEXT_PUBLIC_TIMEZONE=Africa/Johannesburg
APP_AUTH_USER=your-username
APP_AUTH_PASS=your-password
```

Notes:
- `GOOGLE_SERVICE_ACCOUNT_JSON` can be a **stringified JSON** or a **path** to the JSON file.
- If `GOOGLE_SHEET_ID` is missing, the app will look for a spreadsheet named **“Poultry Daily Log”** inside the Drive folder. If not found, it will create one and store the ID in `data/sheet.json`.
- For serverless deployments (like Vercel), set `GOOGLE_SHEET_ID` so the ID is not stored on disk.
- `APP_AUTH_USER` and `APP_AUTH_PASS` enable the basic password gate.

### 3) Install + run
```
npm install
npm run dev
```

Open `http://localhost:3000`.

## Routes
- `/entry` Daily data capture and recent entries.
- `/analytics` Dashboard + charts.

## Google Sheet format
- Spreadsheet title: **Poultry Daily Log**
- Sheet tab: **DailyLog**
- Header row:
  `Date | House | Small | Medium | Large | XL | J | Damaged | Mortality | Notes | Water pH | Egg Yolk Color | Avg Hen Weight (kg) | Water Intake (ml) | Feed Type | Water Additives`
- Dates stored as `YYYY-MM-DD` strings.
- Houses are stored in a separate tab: **Houses**
  `House ID | Name | Start Date | Start Age (days) | Starting Hens`

## Tests
```
npm run test
```

## Deployment notes

### Vercel
- Add environment variables in Vercel Project Settings.
- **Set `GOOGLE_SHEET_ID`** to avoid relying on the local config file.
- Ensure the service account email has access to the Drive folder.

### Docker (optional)
- Add the same environment variables via Docker secrets or environment flags.
- Mount the service account JSON file or provide the JSON string directly.

## Local config file
When `GOOGLE_SHEET_ID` is not provided, the app writes `data/sheet.json` with the resolved spreadsheet ID. Keep this file out of source control.
