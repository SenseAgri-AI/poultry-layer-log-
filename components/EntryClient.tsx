'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Entry, House, Price } from '@/lib/types';
import { getClientTimezone, todayInTz } from '@/lib/date';

type PriceForm = { small: number; medium: number; large: number; xl: number; j: number };
const defaultPriceForm = (): PriceForm => ({ small: 0.70, medium: 1.39, large: 1.65, xl: 1.80, j: 2.23 });

const emptyEntry = (date: string, houseId: string): Entry => ({
  date,
  houseId,
  small: 0,
  medium: 0,
  large: 0,
  xl: 0,
  j: 0,
  damaged: 0,
  mortality: 0,
  notes: '',
  avgEggWeightG: null,
  waterPh: null,
  eggYolkColor: null,
  avgHenWeightKg: null,
  waterIntakeMl: null,
  feedType: '',
  waterAdditives: ''
});

const fallbackHouse: House = {
  id: 'House 1',
  name: 'House 1',
  startDate: '',
  startAgeDays: 0,
  startingHens: 0
};

type SyncState = 'idle' | 'saving' | 'success' | 'error';

type LastAction =
  | { type: 'save'; payload: Entry; resetAfter: boolean }
  | { type: 'delete'; payload: { date: string; houseId: string } };

export default function EntryClient() {
  const timezone = getClientTimezone();
  const [form, setForm] = useState<Entry>(() => emptyEntry(todayInTz(timezone), 'House 1'));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceForm, setPriceForm] = useState<PriceForm>(defaultPriceForm());
  const [savedPrices, setSavedPrices] = useState<PriceForm | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<{ state: SyncState; message: string }>({
    state: 'idle',
    message: ''
  });
  const [lastAction, setLastAction] = useState<LastAction | null>(null);

  const recentEntries = useMemo(() => {
    return [...entries]
      .filter((entry) => entry.houseId === form.houseId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);
  }, [entries, form.houseId]);

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
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/prices');
        const data = (await res.json()) as { prices?: Price[] };
        const prices = data.prices ?? [];
        if (prices.length > 0) {
          const latest = prices[prices.length - 1];
          const pf: PriceForm = { small: latest.small, medium: latest.medium, large: latest.large, xl: latest.xl, j: latest.j };
          setPriceForm(pf);
          setSavedPrices(pf);
        }
      } catch {
        // prices are optional, don't block the form
      }
    };
    fetchPrices();
  }, []);

  useEffect(() => {
    const fetchHouses = async () => {
      try {
        const res = await fetch('/api/houses');
        const data = (await res.json()) as { houses?: House[] };
        setHouses(data.houses ?? []);
      } catch {
        setHouses([]);
      }
    };
    fetchHouses();
  }, []);

  useEffect(() => {
    if (houses.length === 0) return;
    const active = houses.filter((house) => !house.name.toLowerCase().endsWith('-archive'));
    if (active.length === 0) return;
    if (!active.some((house) => house.id === form.houseId)) {
      setForm((prev) => ({ ...prev, houseId: active[0].id }));
    }
  }, [houses, form.houseId]);

  const validate = (entry: Entry) => {
    const errors: string[] = [];
    if (!entry.date) errors.push('Date is required.');
    if (!entry.houseId) errors.push('House is required.');
    const fields: Array<'small' | 'medium' | 'large' | 'xl' | 'j' | 'damaged' | 'mortality'> = [
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
    const optionalFields: Array<
      'avgEggWeightG' | 'waterPh' | 'eggYolkColor' | 'avgHenWeightKg' | 'waterIntakeMl'
    > = ['avgEggWeightG', 'waterPh', 'eggYolkColor', 'avgHenWeightKg', 'waterIntakeMl'];
    optionalFields.forEach((field) => {
      const value = entry[field];
      if (value == null) return;
      if (Number.isNaN(value) || value < 0) {
        errors.push(`${field} must be a number >= 0.`);
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
        setEditingKey(null);
        if (action.resetAfter) {
          setForm(emptyEntry(todayInTz(timezone), action.payload.houseId));
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
      const res = await fetch(
        `/api/entries?date=${encodeURIComponent(action.payload.date)}&house=${encodeURIComponent(
          action.payload.houseId
        )}`,
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

  const pricesChanged = () => {
    if (!savedPrices) return priceForm.small > 0 || priceForm.medium > 0 || priceForm.large > 0 || priceForm.xl > 0 || priceForm.j > 0;
    return priceForm.small !== savedPrices.small || priceForm.medium !== savedPrices.medium || priceForm.large !== savedPrices.large || priceForm.xl !== savedPrices.xl || priceForm.j !== savedPrices.j;
  };

  const handleSave = async (resetAfter: boolean) => {
    const errors = validate(form);
    if (errors.length) {
      setStatus({ state: 'error', message: errors.join(' ') });
      return;
    }

    const existing = entries.find(
      (entry) => entry.date === form.date && entry.houseId === form.houseId
    );
    const currentKey = `${form.date}|${form.houseId}`;
    if (existing && editingKey !== currentKey) {
      const ok = window.confirm('Update existing record?');
      if (!ok) return;
    }

    if (pricesChanged()) {
      try {
        // First-ever save: use an early date so all historical entries get these prices
        const effectiveDate = savedPrices === null ? '2020-01-01' : form.date;
        await fetch('/api/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ effectiveDate, ...priceForm })
        });
        setSavedPrices({ ...priceForm });
      } catch {
        // non-blocking
      }
    }

    const action: LastAction = { type: 'save', payload: form, resetAfter };
    setLastAction(action);
    await runAction(action);
  };

  const handleDelete = async (date: string, houseId: string) => {
    const ok = window.confirm('Delete this entry?');
    if (!ok) return;
    const action: LastAction = { type: 'delete', payload: { date, houseId } };
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

  const setOptionalNumberField = (
    key: 'avgEggWeightG' | 'waterPh' | 'eggYolkColor' | 'avgHenWeightKg' | 'waterIntakeMl',
    value: string
  ) => {
    if (value.trim() === '') {
      setForm((prev) => ({ ...prev, [key]: null }));
      return;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    setForm((prev) => ({ ...prev, [key]: parsed }));
  };

  const handleEdit = (entry: Entry) => {
    setForm(entry);
    setEditingKey(`${entry.date}|${entry.houseId}`);
    setStatus({ state: 'idle', message: '' });
  };

  const resetForm = () => {
    setForm(emptyEntry(todayInTz(timezone), form.houseId));
    setEditingKey(null);
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
        <h2>{editingKey ? `Editing ${form.date}` : 'Log today\'s numbers'}</h2>
        <div className="form-grid">
          <div>
            <label htmlFor="house">House</label>
            <select
              id="house"
              value={form.houseId}
              onChange={(event) => setForm((prev) => ({ ...prev, houseId: event.target.value }))}
            >
              {(() => {
                const active = houses.filter(
                  (house) => !house.name.toLowerCase().endsWith('-archive')
                );
                const options = active.length ? active : [fallbackHouse];
                return options.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.name}
                  </option>
                ));
              })()}
            </select>
            {houses.filter((house) => !house.name.toLowerCase().endsWith('-archive')).length ===
            0 ? (
              <p className="helper-text">Add houses from the Home page.</p>
            ) : null}
          </div>
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
              value={form.small === 0 ? '' : form.small}
              placeholder="0"
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
              value={form.medium === 0 ? '' : form.medium}
              placeholder="0"
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
              value={form.large === 0 ? '' : form.large}
              placeholder="0"
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
              value={form.xl === 0 ? '' : form.xl}
              placeholder="0"
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
              value={form.j === 0 ? '' : form.j}
              placeholder="0"
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
              value={form.damaged === 0 ? '' : form.damaged}
              placeholder="0"
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
              value={form.mortality === 0 ? '' : form.mortality}
              placeholder="0"
              onChange={(event) => setNumberField('mortality', event.target.value)}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', marginTop: '6px' }}>
            <strong className="section-title">Selling price per egg (R)</strong>
          </div>
          {(['small', 'medium', 'large', 'xl', 'j'] as const).map((size) => (
            <div key={size}>
              <label htmlFor={`price-${size}`}>{size === 'j' ? 'Jumbo' : size.charAt(0).toUpperCase() + size.slice(1)}</label>
              <input
                id={`price-${size}`}
                type="number"
                step={0.01}
                min={0}
                value={priceForm[size] === 0 ? '' : priceForm[size]}
                placeholder="0.00"
                onChange={(event) => {
                  const val = event.target.value === '' ? 0 : Number(event.target.value);
                  if (!Number.isNaN(val)) setPriceForm((prev) => ({ ...prev, [size]: val }));
                }}
              />
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Feed changes, flock issues, weather notes..."
            />
          </div>
          <div style={{ gridColumn: '1 / -1', marginTop: '6px' }}>
            <strong className="section-title">Optional daily checks</strong>
          </div>
          <div>
            <label htmlFor="avgEggWeightG">Avg egg weight (g)</label>
            <input
              id="avgEggWeightG"
              type="number"
              step={0.1}
              value={form.avgEggWeightG ?? ''}
              onChange={(event) => setOptionalNumberField('avgEggWeightG', event.target.value)}
              placeholder="e.g. 58.5"
            />
          </div>
          <div>
            <label htmlFor="waterPh">Water pH</label>
            <input
              id="waterPh"
              type="number"
              step={0.1}
              value={form.waterPh ?? ''}
              onChange={(event) => setOptionalNumberField('waterPh', event.target.value)}
              placeholder="e.g. 6.5"
            />
          </div>
          <div>
            <label htmlFor="eggYolkColor">Egg yolk color</label>
            <input
              id="eggYolkColor"
              type="number"
              step={0.1}
              value={form.eggYolkColor ?? ''}
              onChange={(event) => setOptionalNumberField('eggYolkColor', event.target.value)}
              placeholder="e.g. 10"
            />
          </div>
          <div>
            <label htmlFor="avgHenWeightKg">Avg hen weight (kg)</label>
            <input
              id="avgHenWeightKg"
              type="number"
              step={0.01}
              value={form.avgHenWeightKg ?? ''}
              onChange={(event) => setOptionalNumberField('avgHenWeightKg', event.target.value)}
              placeholder="e.g. 1.8"
            />
          </div>
          <div>
            <label htmlFor="waterIntakeMl">Water intake (ml/hen)</label>
            <input
              id="waterIntakeMl"
              type="number"
              step={1}
              value={form.waterIntakeMl ?? ''}
              onChange={(event) => setOptionalNumberField('waterIntakeMl', event.target.value)}
              placeholder="e.g. 200"
            />
          </div>
          <div>
            <label htmlFor="feedType">Feed type added</label>
            <input
              id="feedType"
              type="text"
              value={form.feedType}
              onChange={(event) => setForm((prev) => ({ ...prev, feedType: event.target.value }))}
              placeholder="e.g. Layer mash"
            />
          </div>
          <div>
            <label htmlFor="waterAdditives">Water additives (meds/vitamins)</label>
            <input
              id="waterAdditives"
              type="text"
              value={form.waterAdditives}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, waterAdditives: event.target.value }))
              }
              placeholder="e.g. Vitamins, antibiotics"
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
        <h2>Last 14 days {form.houseId ? `(${form.houseId})` : ''}</h2>
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
                  <th>House</th>
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
                  <tr key={`${entry.date}-${entry.houseId}`}>
                    <td>{entry.date}</td>
                    <td>{entry.houseId}</td>
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
                        <button
                          className="danger"
                          onClick={() => handleDelete(entry.date, entry.houseId)}
                        >
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
