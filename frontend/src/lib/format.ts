import type { Currency } from '../types';

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function monthRange(month: string): { date_from: string; date_to: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    date_from: `${month}-01`,
    date_to: `${month}-${new Date(year, monthNumber, 0).getDate()}`,
  };
}

export function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return localDate(new Date(year, monthNumber - 1 + offset, 1)).slice(0, 7);
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function dateLabel(date: string): string {
  const today = localDate();
  if (date === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === localDate(yesterday)) return 'Yesterday';
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function money(amount: string | number, currency: Currency, compact = false): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
  }).format(Number(amount));
}
