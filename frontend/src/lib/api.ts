import type { DashboardData, Expense, ExpenseFilters, ExpenseInput, ExpensePage, User } from '../types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<ResponseData>(path: string, options: RequestInit = {}): Promise<ResponseData> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      credentials: 'same-origin',
      signal: options.signal ?? AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Unable to reach Daybook. Check your connection and try again.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((issue: { loc: string[]; msg: string }) => `${issue.loc.at(-1)}: ${issue.msg}`).join('. ')
        : 'Something went wrong. Please try again.';
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as ResponseData;
  return response.json() as Promise<ResponseData>;
}

export function filterQuery(filters: ExpenseFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export const api = {
  me: async (signal?: AbortSignal): Promise<User | null> => {
    try {
      return await request<User>('/auth/me', { signal });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  login: (email: string, password: string) => request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data: { name: string; email: string; password: string; currency: string }) => request<User>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  expenses: (filters: ExpenseFilters, page: number, signal?: AbortSignal) => request<ExpensePage>(`/expenses?${filterQuery(filters)}&page=${page}&page_size=8`, { signal }),
  dashboard: (month: string, today: string, signal?: AbortSignal) => request<DashboardData>(`/dashboard?month=${month}&today=${today}`, { signal }),
  create: (data: ExpenseInput) => request<Expense>('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: ExpenseInput) => request<Expense>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request<void>(`/expenses/${id}`, { method: 'DELETE' }),
};
