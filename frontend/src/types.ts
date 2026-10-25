export type Category = 'food' | 'transport' | 'shopping' | 'housing' | 'health' | 'entertainment' | 'other';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR' | 'CAD' | 'AUD';

export interface User {
  id: string;
  name: string;
  email: string;
  currency: Currency;
}

export interface ExpenseInput {
  description: string;
  amount: string;
  category: Category;
  date: string;
  notes: string;
}

export interface Expense extends ExpenseInput {
  id: string;
  created_at: string;
}

export interface ExpensePage {
  items: Expense[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardData {
  month: string;
  month_total: string;
  previous_month_total: string;
  change_percent: string | null;
  today_total: string;
  daily_average: string;
  expense_count: number;
  daily: { date: string; total: string }[];
  categories: { category: Category; total: string; count: number }[];
}

export interface ExpenseFilters {
  date_from: string;
  date_to: string;
  category?: Category;
  search?: string;
}
