import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Download, LayoutDashboard, LoaderCircle, LogOut, Pencil, Plus, ReceiptText, Search, Sparkles, Trash2, TrendingUp, Wallet, X } from 'lucide-react';
import { api, ApiError, filterQuery } from './lib/api';
import { setSession } from './lib/session';
import { dateLabel, localDate, money, monthLabel, monthRange, shiftMonth } from './lib/format';
import type { Category, Expense, ExpenseInput, User } from './types';
import { Auth } from './components/Auth';
import { categories, categoryKeys } from './components/categories';
import { CategoryChart, SpendingChart } from './components/Charts';
import { ExpenseForm } from './components/ExpenseForm';
import { Modal } from './components/Modal';

function LoadingScreen() {
  return <div className="loading-screen"><span className="brand-mark"><Wallet size={24} /></span><LoaderCircle size={22} className="animate-spin text-violet-500" /><span>Getting your Daybook ready…</span></div>;
}

export default function App() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: ({ signal }) => api.me(signal), retry: false, staleTime: 60000 });
  if (me.isPending) return <LoadingScreen />;
  if (me.isError) return <div className="loading-screen"><Wallet size={32} /><h1>We couldn’t connect.</h1><p>{me.error.message}</p><button className="button primary" onClick={() => void me.refetch()}>Try again</button></div>;
  if (!me.data) return <Auth onSuccess={(user) => setSession(queryClient, user)} />;
  return <Dashboard user={me.data} />;
}

function Dashboard({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'overview' | 'expenses'>('overview');
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const today = localDate();
  const filters = { ...monthRange(month), category: category || undefined, search: debouncedSearch };
  const summary = useQuery({ queryKey: ['dashboard', month, today], queryFn: ({ signal }) => api.dashboard(month, today, signal) });
  const expenses = useQuery({ queryKey: ['expenses', filters, page], queryFn: ({ signal }) => api.expenses(filters, page, signal) });

  useEffect(() => {
    const timeout = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(timeout);
  }, [search]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    for (const error of [summary.error, expenses.error]) {
      if (error instanceof ApiError && error.status === 401) {
        setSession(queryClient, null);
      }
    }
  }, [summary.error, expenses.error, queryClient]);

  function changeMonth(value: string) {
    if (!value || !/^\d{4}-\d{2}$/.test(value) || value < '1900-01' || value > '9998-12') return;
    setMonth(value);
    setPage(1);
  }
  async function invalidate() {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['expenses'] }), queryClient.invalidateQueries({ queryKey: ['dashboard'] })]);
  }
  async function saveExpense(data: ExpenseInput) {
    if (editing && editing !== 'new') await api.update(editing.id, data);
    else await api.create(data);
    setEditing(null);
    setToast({ message: editing === 'new' ? 'Expense added. A little more clarity.' : 'Expense updated.' });
    changeMonth(data.date.slice(0, 7));
    await invalidate();
  }
  async function removeExpense() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.remove(deleting.id);
      setDeleting(null);
      if (expenses.data?.items.length === 1 && page > 1) setPage(page - 1);
      setToast({ message: 'Expense deleted.' });
      await invalidate();
    } catch (failure) { setToast({ message: failure instanceof Error ? failure.message : 'Unable to delete expense.', error: true }); }
    finally { setDeleteBusy(false); }
  }
  async function logout() {
    setLogoutBusy(true);
    try {
      await api.logout();
      setSession(queryClient, null);
    } catch (failure) { setToast({ message: failure instanceof Error ? failure.message : 'Unable to sign out.', error: true }); }
    finally { setLogoutBusy(false); }
  }
  const totalPages = Math.max(1, Math.ceil((expenses.data?.total ?? 0) / 8));
  const data = summary.data;
  const change = data?.change_percent == null ? null : Number(data.change_percent);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/"><span className="brand-mark"><Wallet size={22} strokeWidth={2.3} /></span>daybook<span className="brand-dot">.</span></a>
        <div className="sidebar-section-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation"><button className={view === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setView('overview')}><LayoutDashboard size={19} />Overview<span className="active-dot" /></button><button className={view === 'expenses' ? 'nav-item active' : 'nav-item'} onClick={() => setView('expenses')}><ReceiptText size={19} />Expenses</button></nav>
        <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-icon"><Sparkles size={19} /></span><h3>Little steps, better habits.</h3><p>A minute a day is all it takes to understand your spending.</p><button onClick={() => setEditing('new')}>Log today’s expense<ArrowUpRight size={15} /></button></div><button className="nav-item help-link" onClick={() => setHelp(true)}><CircleHelp size={18} />A little help</button><div className="profile"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><span>Personal account · {user.currency}</span></div><button className="icon-button" onClick={() => void logout()} disabled={logoutBusy} aria-label="Sign out" title="Sign out">{logoutBusy ? <LoaderCircle size={17} className="animate-spin" /> : <LogOut size={17} />}</button></div></div>
      </aside>

      <div className="main-shell">
        <header className="topbar"><div><span className="breadcrumb">Workspace</span><ChevronRight size={14} /><strong>{view === 'overview' ? 'Overview' : 'Expenses'}</strong></div><div className="topbar-right"><span className="live-badge"><span />Your personal spending space</span><span className="avatar small">{user.name.slice(0, 1).toUpperCase()}</span><button className="icon-button mobile-logout" onClick={() => void logout()} disabled={logoutBusy} aria-label="Sign out"><LogOut size={17} /></button></div></header>
        <main className="dashboard-content">
          <div className="page-heading"><div><div className="greeting">A LITTLE CLARITY, EVERY DAY</div><h1>{view === 'overview' ? 'Your spending, understood.' : 'Every expense, in one place.'}<span className="heading-dot">.</span></h1><p>{view === 'overview' ? `Here’s the big picture, ${user.name.split(' ')[0]}. Let’s make every day count.` : 'The everyday things. The occasional treats. Keep track of it all.'}</p></div><button className="button primary" onClick={() => setEditing('new')}><Plus size={18} />Add expense</button></div>
          <div className="period-toolbar"><span className="section-eyebrow">{view === 'overview' ? 'MONTHLY OVERVIEW' : 'YOUR EXPENSE HISTORY'}</span><div className="month-picker"><button className="icon-button" aria-label="Previous month" disabled={month === '1900-01'} onClick={() => changeMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /></button><label><CalendarDays size={16} /><span>{monthLabel(month)}</span><input type="month" aria-label="Choose month" min="1900-01" max="9998-12" value={month} onChange={(event) => changeMonth(event.target.value)} /></label><button className="icon-button" aria-label="Next month" disabled={month === '9998-12'} onClick={() => changeMonth(shiftMonth(month, 1))}><ChevronRight size={16} /></button></div></div>

          {summary.isError && <div className="error-message" role="alert">{summary.error.message}<button onClick={() => void summary.refetch()}>Try again</button></div>}
          {view === 'overview' && <>
            <div className="stat-grid" aria-busy={summary.isPending}>
              <section className="stat-card"><div className="stat-label">Total this month<span className="stat-icon violet"><Wallet size={18} /></span></div><strong className="stat-value">{data ? money(data.month_total, user.currency) : '—'}</strong><div className={`stat-foot ${change !== null && change < 0 ? 'positive' : ''}`}>{change === null ? <><span className="neutral-pill">Fresh perspective</span><span>No previous month to compare</span></> : <><span className={`change-pill ${change < 0 ? 'down' : 'up'}`}>{change < 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{Math.abs(change)}%</span><span>vs. last month’s total</span></>}</div></section>
              <section className="stat-card"><div className="stat-label">Spent today<span className="stat-icon peach"><ArrowDownLeft size={19} /></span></div><strong className="stat-value">{data ? money(data.today_total, user.currency) : '—'}</strong><div className="stat-foot"><span className="tiny-dot orange" />{new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div></section>
              <section className="stat-card"><div className="stat-label">Daily average<span className="stat-icon mint"><TrendingUp size={18} /></span></div><strong className="stat-value">{data ? money(data.daily_average, user.currency) : '—'}</strong><div className="stat-foot"><span className="tiny-dot green" />Per elapsed day in this month</div></section>
              <section className="stat-card"><div className="stat-label">Expenses logged<span className="stat-icon blue"><ReceiptText size={18} /></span></div><strong className="stat-value">{data?.expense_count ?? '—'}<span className="stat-unit">expenses</span></strong><div className="stat-foot"><span className="tiny-dot blue-dot" />Every little thing, accounted for</div></section>
            </div>
            {data ? <div className="charts-grid"><SpendingChart data={data} currency={user.currency} /><CategoryChart data={data} currency={user.currency} /></div> : <div className="chart-skeleton panel"><LoaderCircle size={24} className="animate-spin text-violet-400" /><span>Bringing your spending into focus…</span></div>}
          </>}

          <section className="panel expenses-panel">
            <div className="panel-heading expense-heading"><div><h2>{view === 'overview' ? 'Recent expenses' : 'Expense history'}<span className="count-badge">{expenses.data?.total ?? '—'}</span></h2><p>The small details behind the big picture</p></div><a className="button secondary export-button" href={`/api/v1/expenses/export?${filterQuery(filters)}`}><Download size={16} />Export CSV</a></div>
            <div className="expense-filters"><label className="search-field"><Search size={17} /><input aria-label="Search expenses" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses…" maxLength={200} />{search && <button className="icon-button" aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}</label><select aria-label="Filter by category" value={category} onChange={(event) => { setCategory(event.target.value as Category | ''); setPage(1); }}><option value="">All categories</option>{categoryKeys.map((key) => <option key={key} value={key}>{categories[key].label}</option>)}</select><span className="filtered-month">{monthLabel(month)}</span></div>
            {expenses.isError ? <div className="table-empty"><p role="alert">{expenses.error.message}</p><button className="button secondary" onClick={() => void expenses.refetch()}>Try again</button></div> : expenses.isPending ? <div className="table-empty"><LoaderCircle size={24} className="animate-spin text-violet-400" /><p>Finding your expenses…</p></div> : !expenses.data.items.length ? <div className="table-empty"><span className="empty-icon"><ReceiptText size={28} /></span><h3>{search || category ? 'No matching expenses' : 'A clean slate. A clearer picture.'}</h3><p>{search || category ? 'Try another search or category.' : `You haven’t logged any expenses for ${monthLabel(month)} yet.`}</p><button className="button secondary" onClick={() => { if (search || category) { setSearch(''); setCategory(''); setPage(1); } else setEditing('new'); }}>{search || category ? 'Clear filters' : 'Add your first expense'}{!search && !category && <Plus size={16} />}</button></div> : <>
              <div className="table-scroll"><table><thead><tr><th>Description</th><th>Category</th><th>Date</th><th className="amount-cell">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{expenses.data.items.map((expense) => { const details = categories[expense.category]; const Icon = details.icon; return <tr key={expense.id}><td><div className="expense-description"><span className="category-icon" style={{ background: details.background, color: details.color }}><Icon size={18} /></span><div><strong>{expense.description}</strong><span>{expense.notes || 'Personal expense'}</span></div></div></td><td><span className="category-tag" style={{ background: details.background, color: details.color }}>{details.label}</span></td><td className="date-cell"><span title={expense.date}>{dateLabel(expense.date)}</span></td><td className="amount-cell">{money(expense.amount, user.currency)}</td><td><div className="row-actions"><button className="icon-button" aria-label={`Edit ${expense.description}`} onClick={() => setEditing(expense)}><Pencil size={15} /></button><button className="icon-button delete-button" aria-label={`Delete ${expense.description}`} onClick={() => setDeleting(expense)}><Trash2 size={15} /></button></div></td></tr>; })}</tbody></table></div>
              <div className="table-footer"><span>Showing {(page - 1) * 8 + 1}–{Math.min(page * 8, expenses.data.total)} of {expenses.data.total} expenses</span><div><button className="icon-button" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span>Page {page} of {totalPages}</span><button className="icon-button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button></div></div>
            </>}
          </section>
          <footer className="dashboard-footer"><span><span className="footer-dot" />A little more mindful, one expense at a time.</span><span>Made for your everyday.</span></footer>
        </main>
      </div>
      {editing && <ExpenseForm expense={editing === 'new' ? undefined : editing} currency={user.currency} onClose={() => setEditing(null)} onSave={saveExpense} />}
      {deleting && <Modal title="Delete this expense?" subtitle="This can’t be undone. Your totals will update automatically." onClose={() => { if (!deleteBusy) setDeleting(null); }}><div className="delete-summary"><strong>{deleting.description}</strong><span>{money(deleting.amount, user.currency)}</span></div><div className="modal-actions"><button className="button secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>Keep expense</button><button className="button danger" disabled={deleteBusy} onClick={() => void removeExpense()}>{deleteBusy ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}Delete expense</button></div></Modal>}
      {help && <Modal title="A little help, a lot of clarity." onClose={() => setHelp(false)}><div className="help-content"><h3>Your daily routine</h3><p>Add an expense with its amount, category, and date. Edit it any time, or export your selected month and filters as a CSV.</p><h3>Understanding the numbers</h3><p>Monthly totals include the selected month. “Spent today” always means today in your local calendar. Daily averages divide the month’s total by elapsed calendar days (all days for a completed month).</p><h3>Your data is yours</h3><p>Only your account can access your expenses. Amounts are stored to the cent, in {user.currency}. There are no bank connections or automatic currency conversions.</p></div></Modal>}
      {toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <CircleHelp size={18} /> : <Check size={18} />}<span>{toast.message}</span><button className="icon-button" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={16} /></button></div>}
    </div>
  );
}
