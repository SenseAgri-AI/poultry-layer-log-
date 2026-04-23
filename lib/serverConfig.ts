export const SHEET_TITLE = 'Poultry Daily Log';
export const SHEET_NAME = 'DailyLog';
export const HEADER_ROW = [
  'Date',
  'House',
  'Small',
  'Medium',
  'Large',
  'XL',
  'J',
  'Damaged',
  'Mortality',
  'Notes',
  'Avg Egg Weight (g)',
  'Water pH',
  'Egg Yolk Color',
  'Avg Hen Weight (kg)',
  'Water Intake (ml)',
  'Feed Type',
  'Water Additives'
];

export const HOUSES_SHEET_NAME = 'Houses';
export const HOUSES_HEADER_ROW = ['House ID', 'Name', 'Start Date', 'Start Age (days)', 'Starting Hens'];

export const DRIVE_FOLDER_ID =
  process.env.GOOGLE_DRIVE_FOLDER_ID || '1iJlirSU4h0C-xADAl8ZnAF94yinnYFYU';

export const LOCAL_SHEET_CONFIG_PATH = 'data/sheet.json';
