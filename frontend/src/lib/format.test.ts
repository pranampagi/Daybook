import { describe, expect, it } from 'vitest';
import { localDate, money, monthRange, shiftMonth } from './format';
import { filterQuery } from './api';

describe('calendar helpers', () => {
  it('uses local calendar dates rather than converting to UTC', () => {
    expect(localDate(new Date(2026, 9, 25, 23, 59))).toBe('2026-10-25');
  });
  it('finds the correct month boundaries including leap years', () => {
    expect(monthRange('2024-02')).toEqual({ date_from: '2024-02-01', date_to: '2024-02-29' });
    expect(monthRange('2026-02').date_to).toBe('2026-02-28');
    expect(monthRange('2026-10').date_to).toBe('2026-10-31');
  });
  it('moves between months across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('display and filters', () => {
  it('formats amounts to the cent', () => {
    expect(money('0.30', 'USD')).toContain('0.30');
  });
  it('encodes searches and skips empty filters', () => {
    const params = new URLSearchParams(filterQuery({ date_from: '2026-10-01', date_to: '2026-10-31', search: 'Coffee & tea', category: undefined }));
    expect(params.get('search')).toBe('Coffee & tea');
    expect(params.has('category')).toBe(false);
  });
});
