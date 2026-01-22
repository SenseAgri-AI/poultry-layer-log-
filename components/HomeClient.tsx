'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { House } from '@/lib/types';
import { getClientTimezone, todayInTz } from '@/lib/date';

const emptyHouse = (date: string): House => ({
  id: '',
  name: '',
  startDate: date,
  startAgeDays: 126,
  startingHens: 4400
});

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1KjAr1wjfptYbE0n3qCWY_7gTVnR-XMTRy8xzRgCDpkA/edit?usp=drive_link';

type SyncState = 'idle' | 'saving' | 'success' | 'error';

export default function HomeClient() {
  const timezone = getClientTimezone();
  const [houses, setHouses] = useState<House[]>([]);
  const [form, setForm] = useState<House>(() => emptyHouse(todayInTz(timezone)));
  const [status, setStatus] = useState<{ state: SyncState; message: string }>({
    state: 'idle',
    message: ''
  });

  const fetchHouses = async () => {
    try {
      const res = await fetch('/api/houses');
      const data = (await res.json()) as { houses?: House[] };
      setHouses(data.houses ?? []);
    } catch {
      setHouses([]);
    }
  };

  useEffect(() => {
    fetchHouses();
  }, []);

  const sortedHouses = useMemo(() => {
    return [...houses].sort((a, b) => a.name.localeCompare(b.name));
  }, [houses]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setStatus({ state: 'error', message: 'House name is required.' });
      return;
    }
    if (!form.startDate) {
      setStatus({ state: 'error', message: 'Start date is required.' });
      return;
    }
    setStatus({ state: 'saving', message: 'Saving...' });
    try {
      const payload = { ...form, id: form.id || form.name.trim(), name: form.name.trim() };
      const res = await fetch('/api/houses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Save failed');
      await fetchHouses();
      setStatus({ state: 'success', message: 'House saved ✅' });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'Save failed'
      });
    }
  };

  const handleEdit = (house: House) => {
    setForm(house);
    setStatus({ state: 'idle', message: '' });
  };

  const handleReset = () => {
    setForm(emptyHouse(todayInTz(timezone)));
    setStatus({ state: 'idle', message: '' });
  };

  return (
    <main>
      <header className="nav">
        <div className="brand">Poultry Layer Daily Log</div>
        <nav className="nav-links">
          <Link href="/entry">Daily Entry</Link>
          <Link href="/analytics">Analytics</Link>
        </nav>
      </header>

      <section className="hero">
        <h1>Keep daily layer stats tidy, even on the farm floor.</h1>
        <p>
          Capture egg counts, damaged eggs, and mortality in seconds. Everything syncs
          to Google Sheets, and your dashboard stays ready for quick checks.
        </p>
        <div className="actions" style={{ marginTop: '18px' }}>
          <Link className="chip" href="/entry">
            Start today&apos;s log
          </Link>
          <Link className="chip" href="/analytics">
            View analytics
          </Link>
        </div>
      </section>

      <section className="section card">
        <h2>House setup</h2>
        <p className="helper-text">
          Add each house with its cycle start date and age so we can plot the standard target
          curve.
        </p>
        <div className="form-grid" style={{ marginTop: '12px' }}>
          <div>
            <label htmlFor="houseName">House name</label>
            <input
              id="houseName"
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. House 1"
            />
          </div>
          <div>
            <label htmlFor="houseStartDate">Cycle start date</label>
            <input
              id="houseStartDate"
              type="date"
              value={form.startDate}
              onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="houseStartAge">Age at start (days)</label>
            <input
              id="houseStartAge"
              type="number"
              min={0}
              step={1}
              value={form.startAgeDays}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, startAgeDays: Number(event.target.value) || 0 }))
              }
            />
          </div>
          <div>
            <label htmlFor="startingHens">Starting hens</label>
            <input
              id="startingHens"
              type="number"
              min={0}
              step={1}
              value={form.startingHens}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, startingHens: Number(event.target.value) || 0 }))
              }
            />
          </div>
        </div>
        <div className="actions">
          <button className="primary" onClick={handleSave}>
            Save house
          </button>
          <button className="ghost" onClick={handleReset}>
            New house
          </button>
        </div>
        {status.message ? (
          <div
            className={`status ${
              status.state === 'error' ? 'error' : status.state === 'success' ? 'success' : ''
            }`}
          >
            {status.message}
          </div>
        ) : null}
      </section>

      <section className="section card">
        <h2>Google Sheet</h2>
        <p className="helper-text">
          Open the live spreadsheet used for this farm log.
        </p>
        <div className="chip-row">
          <a className="chip" href={SHEET_URL} target="_blank" rel="noreferrer">
            Open Poultry Daily Log sheet
          </a>
        </div>
      </section>

      <section className="section card">
        <h2>Houses</h2>
        {sortedHouses.length === 0 ? (
          <p>No houses yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Start date</th>
                  <th>Start age (days)</th>
                  <th>Starting hens</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedHouses.map((house) => (
                  <tr key={house.id}>
                    <td>{house.name}</td>
                    <td>{house.startDate}</td>
                    <td>{house.startAgeDays}</td>
                    <td>{house.startingHens.toLocaleString()}</td>
                    <td>
                      <button className="secondary" onClick={() => handleEdit(house)}>
                        Edit
                      </button>
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
