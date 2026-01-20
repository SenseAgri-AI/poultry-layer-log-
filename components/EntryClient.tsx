'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Entry } from '@/lib/types';
import { getClientTimezone, todayInTz } from '@/lib/date';

const emptyEntry = (date: string): Entry => ({
  date,
  small: 0,
  medium: 0,
  large: 0,
  xl: 0,
  j: 0,
  damaged: 0,
  mortality: 0,
  notes: ''
});

type SyncState = 'idle' | 'saving' | 'success' | 'error';

type LastAction =
  | { type: 'save'; payload: Entry; resetAfter: boolean }
  | { type: 'delete'; payload: { date: string } };

export default function EntryClient() {
  const timezone = getClientTimezone();
  const [form, setForm] = useState<Entry>(() => emptyEntry(todayInTz(timezone)));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [status, setStatus] = useState<{ state: SyncState; message: string }>({
    state: 'idle',
    message: ''
  });
  const [lastAction, setLastAction] = useState<LastAction | null>(null);

  const recentEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  }, [entries]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/entries');
      const data = (await res.json()) as { entries?: Entry[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setEntries(data.entries ?? []);
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'Failed to load entries'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const validate = (entry: Entry) => {
    const errors: string[] = [];
    if (!entry.date) errors.push('Date is required.');
    const fields: Array<keyof Entry> = [
      'small',
      'medium',
      'large',
      'xl',
      'j',
      'damaged',
      'mortality'
    ];
    fields.forEach((field) => {
      const value = entry[field];
      if (!Number.isInteger(value) || value < 0) {
        errors.push(`${field} must be an integer >= 0.`);
      }
    });
    return errors;
  };

  const runAction = async (action: LastAction) => {
    if (action.type === 'save') {
      setStatus({ state: 'saving', message: 'Saving...' });
      try {
        const res = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload)
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || 'Save failed');
        await fetchEntries();
        setEditingDate(null);
        if (action.resetAfter) {
          setForm(emptyEntry(todayInTz(timezone)));
        }
        setStatus({ state: 'success', message: 'Saved ✅ Synced to Google Sheet ✅' });
      } catch (error) {
        setStatus({
          state: 'error',
          message: error instanceof Error ? error.message : 'Sync failed, retry'
        });
        setLastAction(action);
      }
      return;
    }

    setStatus({ state: 'saving', message: 'Deleting...' });
    try {
      const res = await fetch(`/api/entries?date=${encodeURIComponent(action.payload.date)}`,
        { method: 'DELETE' }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      await fetchEntries();
      setStatus({ state: 'success', message: 'Saved ✅ Synced to Google Sheet ✅' });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'Sync failed, retry'
      });
      setLastAction(action);
    }
  };

  const handleSave = async (resetAfter: boolean) => {
    const errors = validate(form);
    if (errors.length) {
      setStatus({ state: 'error', message: errors.join(' ') });
      return;
    }

    const existing = entries.find((entry) => entry.date === form.date);
    if (existing && editingDate !== form.date) {
      const ok = window.confirm('Update existing record?');
      if (!ok) return;
    }

    const action: LastAction = { type: 'save', payload: form, resetAfter };
    setLastAction(action);
    await runAction(action);
  };

  const handleDelete = async (date: string) => {
    const ok = window.confirm('Delete this entry?');
    if (!ok) return;
    const action: LastAction = { type: 'delete', payload: { date } };
    setLastAction(action);
    await runAction(action);
  };

  const setNumberField = (
    key: 'small' | 'medium' | 'large' | 'xl' | 'j' | 'damaged' | 'mortality',
    value: string
  ) => {
    const parsed = value === '' ? 0 : Number(value);
    if (Number.isNaN(parsed)) return;
    setForm((prev) => ({ ...prev, [key]: parsed }));
  };

  const handleEdit = (entry: Entry) => {
    setForm(entry);
    setEditingDate(entry.date);
    setStatus({ state: 'idle', message: '' });
  };

  const resetForm = () => {
    setForm(emptyEntry(todayInTz(timezone)));
    setEditingDate(null);
    setStatus({ state: 'idle', message: '' });
  };

  return (
    <main>
      <header className="nav">
        <div className="brand">Daily Entry</div>
        <nav className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/analytics">Analytics</Link>
        </nav>
      </header>

      <section className="card">
        <h2>{editingDate ? `Editing ${editingDate}` : 'Log today\'s numbers'}</h2>
        <div className="form-grid">
          <div>
            <label htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
              required
            />
          </div>
          <div>
            <label htmlFor="small">Small</label>
            <input
              id="small"
              type="number"
              min={0}
              step={1}
              value={form.small}
              onChange={(event) => setNumberField('small', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="medium">Medium</label>
            <input
              id="medium"
              type="number"
              min={0}
              step={1}
              value={form.medium}
              onChange={(event) => setNumberField('medium', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="large">Large</label>
            <input
              id="large"
              type="number"
              min={0}
              step={1}
              value={form.large}
              onChange={(event) => setNumberField('large', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="xl">XL</label>
            <input
              id="xl"
              type="number"
              min={0}
              step={1}
              value={form.xl}
              onChange={(event) => setNumberField('xl', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="j">Jumbo</label>
            <input
              id="j"
              type="number"
              min={0}
              step={1}
              value={form.j}
              onChange={(event) => setNumberField('j', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="damaged">Damaged</label>
            <input
              id="damaged"
              type="number"
              min={0}
              step={1}
              value={form.damaged}
              onChange={(event) => setNumberField('damaged', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="mortality">Mortality</label>
            <input
              id="mortality"
              type="number"
              min={0}
              step={1}
              value={form.mortality}
              onChange={(event) => setNumberField('mortality', event.target.value)}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Feed changes, flock issues, weather notes..."
            />
          </div>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => handleSave(false)}>
            Save
          </button>
          <button className="secondary" onClick={() => handleSave(true)}>
            Save + New
          </button>
          <button className="ghost" onClick={resetForm}>
            Reset
          </button>
        </div>
        {status.message ? (
          <div
            className={`status ${
              status.state === 'error' ? 'error' : status.state === 'success' ? 'success' : ''
            }`}
          >
            {status.message}
            {status.state === 'error' && lastAction ? (
              <button
                className="secondary"
                style={{ marginLeft: '12px' }}
                onClick={() => runAction(lastAction)}
              >
                Retry sync
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="section card">
        <h2>Last 14 days</h2>
        {loading ? (
          <p>Loading entries...</p>
        ) : recentEntries.length === 0 ? (
          <p>No entries yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>S</th>
                  <th>M</th>
                  <th>L</th>
                  <th>XL</th>
                  <th>J</th>
                  <th>Damaged</th>
                  <th>Mortality</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((entry) => (
                  <tr key={entry.date}>
                    <td>{entry.date}</td>
                    <td>{entry.small}</td>
                    <td>{entry.medium}</td>
                    <td>{entry.large}</td>
                    <td>{entry.xl}</td>
                    <td>{entry.j}</td>
                    <td>{entry.damaged}</td>
                    <td>{entry.mortality}</td>
                    <td>{entry.notes || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="secondary" onClick={() => handleEdit(entry)}>
                          Edit
                        </button>
                        <button className="danger" onClick={() => handleDelete(entry.date)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
