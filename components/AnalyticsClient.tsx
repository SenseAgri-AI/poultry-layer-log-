'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import type { Entry } from '@/lib/types';
import { averageEggWeight, qualityFromAverage, totalEggs, totalWeight } from '@/lib/eggMath';
import { dateStringDaysAgo, getClientTimezone, todayInTz } from '@/lib/date';

const seriesList = [
  { key: 'mortality', label: 'Mortality', color: '#b33a3a' },
  { key: 'damaged', label: 'Damaged', color: '#d8792c' },
  { key: 'small', label: 'Small', color: '#7d5a2a' },
  { key: 'medium', label: 'Medium', color: '#c38c45' },
  { key: 'large', label: 'Large', color: '#2f6f63' },
  { key: 'xl', label: 'XL', color: '#3f7f6f' },
  { key: 'j', label: 'Jumbo', color: '#144b59' }
] as const;

type SeriesKey = (typeof seriesList)[number]['key'];

type ChartRow = Entry & {
  avgWeight: number;
  quality: number;
};

export default function AnalyticsClient() {
  const timezone = getClientTimezone();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangePreset, setRangePreset] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [series, setSeries] = useState<Record<SeriesKey, boolean>>(() => ({
    mortality: true,
    damaged: true,
    small: true,
    medium: true,
    large: true,
    xl: true,
    j: true
  }));

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/entries');
        const data = (await res.json()) as { entries?: Entry[] };
        setEntries(data.entries ?? []);
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, []);

  const dateRange = useMemo(() => {
    if (rangePreset === 'custom') {
      const end = customEnd || todayInTz(timezone);
      const start = customStart || dateStringDaysAgo(365, timezone);
      return { start, end };
    }
    const days = Number(rangePreset);
    const start = dateStringDaysAgo(days - 1, timezone);
    const end = todayInTz(timezone);
    return { start, end };
  }, [rangePreset, customStart, customEnd, timezone]);

  const filtered = useMemo(() => {
    return entries
      .filter((entry) => entry.date >= dateRange.start && entry.date <= dateRange.end)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, dateRange]);

  const chartData = useMemo<ChartRow[]>(() => {
    return filtered.map((entry) => ({
      ...entry,
      avgWeight: Number(averageEggWeight(entry).toFixed(2)),
      quality: Number(qualityFromAverage(averageEggWeight(entry)).toFixed(3))
    }));
  }, [filtered]);

  const totals = useMemo(() => {
    const eggs = filtered.reduce((sum, entry) => sum + totalEggs(entry), 0);
    const damaged = filtered.reduce((sum, entry) => sum + entry.damaged, 0);
    const mortality = filtered.reduce((sum, entry) => sum + entry.mortality, 0);
    const weight = filtered.reduce((sum, entry) => sum + totalWeight(entry), 0);
    const avgWeight = eggs > 0 ? weight / eggs : 0;
    return { eggs, damaged, mortality, avgWeight };
  }, [filtered]);

  const latestQuality = useMemo(() => {
    const latest = [...filtered].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest) return null;
    const avg = averageEggWeight(latest);
    return qualityFromAverage(avg);
  }, [filtered]);

  return (
    <main>
      <header className="nav">
        <div className="brand">Analytics</div>
        <nav className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/entry">Daily Entry</Link>
        </nav>
      </header>

      <section className="card">
        <h2>Filters</h2>
        <div className="chip-row">
          {(['7', '30', '90'] as const).map((preset) => (
            <button
              key={preset}
              className={rangePreset === preset ? 'primary' : 'secondary'}
              onClick={() => setRangePreset(preset)}
            >
              Last {preset} days
            </button>
          ))}
          <button
            className={rangePreset === 'custom' ? 'primary' : 'secondary'}
            onClick={() => setRangePreset('custom')}
          >
            Custom
          </button>
        </div>
        <div className="form-grid" style={{ marginTop: '12px' }}>
          <div>
            <label htmlFor="start">Start date</label>
            <input
              id="start"
              type="date"
              value={customStart}
              onChange={(event) => {
                setRangePreset('custom');
                setCustomStart(event.target.value);
              }}
              disabled={rangePreset !== 'custom'}
            />
          </div>
          <div>
            <label htmlFor="end">End date</label>
            <input
              id="end"
              type="date"
              value={customEnd}
              onChange={(event) => {
                setRangePreset('custom');
                setCustomEnd(event.target.value);
              }}
              disabled={rangePreset !== 'custom'}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="kpi-grid">
          <div className="kpi">
            <h3>Total eggs</h3>
            <p>{totals.eggs}</p>
          </div>
          <div className="kpi">
            <h3>Total damaged</h3>
            <p>{totals.damaged}</p>
          </div>
          <div className="kpi">
            <h3>Total mortality</h3>
            <p>{totals.mortality}</p>
          </div>
          <div className="kpi">
            <h3>Avg egg weight</h3>
            <p>{totals.avgWeight.toFixed(1)} g</p>
          </div>
        </div>
      </section>

      <section className="section chart-card">
        <h2>Time series</h2>
        <div className="chip-row">
          {seriesList.map((item) => (
            <label key={item.key} className="chip" style={{ display: 'flex', gap: '6px' }}>
              <input
                type="checkbox"
                checked={series[item.key]}
                onChange={() => setSeries((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
              />
              {item.label}
            </label>
          ))}
        </div>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {seriesList.map((item) =>
                series[item.key] ? (
                  <Line
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    stroke={item.color}
                    strokeWidth={2}
                    dot={false}
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {loading ? <p className="footer-note">Loading chart data...</p> : null}
      </section>

      <section className="section chart-card">
        <h2>Average egg weight over time</h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <XAxis dataKey="date" />
              <YAxis unit="g" />
              <Tooltip />
              <Line type="monotone" dataKey="avgWeight" stroke="#2f6f63" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="section chart-card">
        <h2>Quality score</h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <XAxis dataKey="date" />
              <YAxis domain={[0, 1]} />
              <Tooltip />
              <Line type="monotone" dataKey="quality" stroke="#144b59" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="footer-note">
          Latest quality: {latestQuality ? `${(latestQuality * 100).toFixed(0)}%` : 'No data'}
        </p>
      </section>
    </main>
  );
}
