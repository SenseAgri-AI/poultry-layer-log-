const FALLBACK_TZ = 'Africa/Johannesburg';

export function formatDateInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function getClientTimezone(): string {
  return process.env.NEXT_PUBLIC_TIMEZONE || FALLBACK_TZ;
}

export function getServerTimezone(): string {
  return process.env.TIMEZONE || process.env.NEXT_PUBLIC_TIMEZONE || FALLBACK_TZ;
}

export function todayInTz(timeZone: string): string {
  return formatDateInTz(new Date(), timeZone);
}

export function dateStringDaysAgo(days: number, timeZone: string): string {
  const ms = days * 24 * 60 * 60 * 1000;
  const target = new Date(Date.now() - ms);
  return formatDateInTz(target, timeZone);
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function daysBetween(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}
