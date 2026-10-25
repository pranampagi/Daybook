import { useState } from 'react';
import type { FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { Category, Currency, Expense, ExpenseInput } from '../types';
import { localDate } from '../lib/format';
import { categories, categoryKeys } from './categories';
import { Modal } from './Modal';

export function ExpenseForm({ expense, currency, onClose, onSave }: {
  expense?: Expense;
  currency: Currency;
  onClose: () => void;
  onSave: (data: ExpenseInput) => Promise<void>;
}) {
  const [data, setData] = useState<ExpenseInput>({
    description: expense?.description ?? '',
    amount: expense?.amount ?? '',
    category: expense?.category ?? 'food',
    date: expense?.date ?? localDate(),
    notes: expense?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d+(\.\d{1,2})?$/.test(data.amount) || Number(data.amount) <= 0) {
      setError('Enter a positive amount with up to two decimal places.');
      return;
    }
    setSaving(true);
    setError('');
    try { await onSave(data); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save expense.'); }
    finally { setSaving(false); }
  }
  return (
    <Modal title={expense ? 'Edit expense' : 'Add an expense'} subtitle="The little things add up. Keep track of them here." onClose={() => { if (!saving) onClose(); }}>
      <form onSubmit={submit} className="expense-form">
        {error && <div className="error-message" role="alert">{error}</div>}
        <label>Description<input required autoFocus maxLength={200} value={data.description} onChange={(event) => setData({ ...data, description: event.target.value })} placeholder="e.g. Coffee with a friend" /></label>
        <div className="form-grid">
          <label>Amount ({currency})<input required inputMode="decimal" type="number" min="0.01" max="9999999999.99" step="0.01" value={data.amount} onChange={(event) => setData({ ...data, amount: event.target.value })} placeholder="0.00" /></label>
          <label>Date<input required type="date" min="1900-01-01" max="9998-12-31" value={data.date} onChange={(event) => setData({ ...data, date: event.target.value })} /></label>
        </div>
        <label>Category<select value={data.category} onChange={(event) => setData({ ...data, category: event.target.value as Category })}>{categoryKeys.map((category) => <option key={category} value={category}>{categories[category].label}</option>)}</select></label>
        <label>Notes <span className="optional">optional</span><textarea rows={3} maxLength={1000} value={data.notes} onChange={(event) => setData({ ...data, notes: event.target.value })} placeholder="Anything you’d like to remember…" /></label>
        <div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving && <LoaderCircle size={17} className="animate-spin" />}{saving ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}</button></div>
      </form>
    </Modal>
  );
}
