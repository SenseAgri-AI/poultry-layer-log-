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
import { averageEggWeight, totalEggs, totalWeight } from '@/lib/eggMath';
import { dateStringDaysAgo, getClientTimezone, todayInTz } from '@/lib/date';

const seriesList = [
  { key: 'small', label: 'Small', color: '#7d5a2a' },
  { key: 'medium', label: 'Medium', color: '#c38c45' },
  { key: 'large', label: 'Large', color: '#2f6f63' },
  { key: 'xl', label: 'XL', color: '#3f7f6f' },
  { key: 'j', label: 'Jumbo', color: '#144b59' }
] as const;

type SeriesKey = (typeof seriesList)[number]['key'];

type ChartRow = Entry & {
  avgWeight: number;
  totalEggs: number;
  totalWeight: number;
  hdep: number;
  hhep: number;
  dailyMortalityRate: number;
  liveHens: number;
};

export default function AnalyticsClient() {
  const timezone = getClientTimezone();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangePreset, setRangePreset] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [startingHens, setStartingHens] = useState(4400);
  const [series, setSeries] = useState<Record<SeriesKey, boolean>>(() => ({
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

  const hensByDate = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    let hens = Math.max(startingHens, 0);
    const map = new Map<string, number>();
    for (const entry of sorted) {
      map.set(entry.date, hens);
      hens = Math.max(hens - entry.mortality, 0);
    }
    return map;
  }, [entries, startingHens]);

  const currentAlive = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    let hens = Math.max(startingHens, 0);
    for (const entry of sorted) {
      hens = Math.max(hens - entry.mortality, 0);
    }
    return hens;
  }, [entries, startingHens]);

  const chartData = useMemo<ChartRow[]>(() => {
    return filtered.map((entry) => {
      const liveHens = hensByDate.get(entry.date) ?? Math.max(startingHens, 0);
      const eggsToday = totalEggs(entry);
      return {
        ...entry,
        avgWeight: Number(averageEggWeight(entry).toFixed(2)),
        totalEggs: eggsToday,
        totalWeight: Number(totalWeight(entry).toFixed(1)),
        liveHens,
        hdep: liveHens > 0 ? (eggsToday / liveHens) * 100 : 0,
        hhep: startingHens > 0 ? (eggsToday / startingHens) * 100 : 0,
        dailyMortalityRate: liveHens > 0 ? (entry.mortality / liveHens) * 100 : 0
      };
    });
  }, [filtered, hensByDate, startingHens]);

  const totals = useMemo(() => {
    const eggs = filtered.reduce((sum, entry) => sum + totalEggs(entry), 0);
    const damaged = filtered.reduce((sum, entry) => sum + entry.damaged, 0);
    const mortality = filtered.reduce((sum, entry) => sum + entry.mortality, 0);
    const weight = filtered.reduce((sum, entry) => sum + totalWeight(entry), 0);
    const avgWeight = eggs > 0 ? weight / eggs : 0;
    return { eggs, damaged, mortality, avgWeight };
  }, [filtered]);

  const totalLiveHens = useMemo(() => {
    return filtered.reduce(
      (sum, entry) => sum + (hensByDate.get(entry.date) ?? Math.max(startingHens, 0)),
      0
    );
  }, [filtered, hensByDate, startingHens]);

  const avgLiveHens = filtered.length > 0 ? totalLiveHens / filtered.length : 0;
  const hasData = filtered.length > 0;

  const hdepPercent = totalLiveHens > 0 ? (totals.eggs / totalLiveHens) * 100 : 0;
  const hhepPercent =
    startingHens > 0 && filtered.length > 0
      ? (totals.eggs / (startingHens * filtered.length)) * 100
      : 0;
  const eggsPerHenPlaced = startingHens > 0 ? totals.eggs / startingHens : 0;
  const eggsPerHenLive = avgLiveHens > 0 ? totals.eggs / avgLiveHens : 0;
  const breakageRate = totals.eggs > 0 ? (totals.damaged / totals.eggs) * 100 : 0;
  const saleableEggs = Math.max(totals.eggs - totals.damaged, 0);
  const dailyMortRate = totalLiveHens > 0 ? (totals.mortality / totalLiveHens) * 100 : 0;
  const cumMortRate = startingHens > 0 ? (totals.mortality / startingHens) * 100 : 0;
  const livability = startingHens > 0 ? 100 - cumMortRate : 0;

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
          <div>
            <label htmlFor="hens">Starting hens</label>
            <input
              id="hens"
              type="number"
              min={0}
              step={1}
              value={startingHens}
              onChange={(event) => {
                const value = Number(event.target.value);
                setStartingHens(Number.isNaN(value) ? 0 : value);
              }}
              placeholder="Default 4400"
            />
          </div>
          <div>
            <label htmlFor="liveHens">Current alive hens</label>
            <input id="liveHens" type="number" value={currentAlive} readOnly />
          </div>
        </div>
      </section>

      <section className="section card">
        <h2>Production performance</h2>
        <div className="kpi-grid">
          <div className="kpi">
            <h3>Total eggs</h3>
            <p>{hasData ? totals.eggs.toLocaleString() : '-'}</p>
          </div>
          <div className="kpi">
            <h3>HDEP %</h3>
            <p>
              {hasData ? (totalLiveHens > 0 ? `${hdepPercent.toFixed(1)}%` : 'Add hens') : '-'}
            </p>
          </div>
          <div className="kpi">
            <h3>HHEP %</h3>
            <p>
              {hasData ? (startingHens > 0 ? `${hhepPercent.toFixed(1)}%` : 'Add hens') : '-'}
            </p>
          </div>
          <div className="kpi">
            <h3>Eggs per hen (placed)</h3>
            <p>
              {hasData ? (startingHens > 0 ? eggsPerHenPlaced.toFixed(2) : 'Add hens') : '-'}
            </p>
          </div>
          <div className="kpi">
            <h3>Eggs per hen (avg live)</h3>
            <p>
              {hasData ? (avgLiveHens > 0 ? eggsPerHenLive.toFixed(2) : 'Add hens') : '-'}
            </p>
          </div>
          <div className="kpi">
            <h3>Avg egg weight</h3>
            <p>{hasData ? `${totals.avgWeight.toFixed(1)} g` : '-'}</p>
          </div>
        </div>
      </section>

      <section className="section card">
        <h2>Breakage and output</h2>
        <div className="kpi-grid">
          <div className="kpi">
            <h3>Breakage rate</h3>
            <p>{hasData ? `${breakageRate.toFixed(1)}%` : '-'}</p>
          </div>
          <div className="kpi">
            <h3>Saleable eggs</h3>
            <p>{hasData ? saleableEggs.toLocaleString() : '-'}</p>
          </div>
          <div className="kpi">
            <h3>Lost eggs (damaged)</h3>
            <p>{hasData ? totals.damaged.toLocaleString() : '-'}</p>
          </div>
        </div>
      </section>

      <section className="section card">
        <h2>Mortality / livability</h2>
        <div className="kpi-grid">
          <div className="kpi">
            <h3>Total mortality</h3>
            <p>{hasData ? totals.mortality.toLocaleString() : '-'}</p>
          </div>
          <div className="kpi">
            <h3>Daily mortality rate</h3>
            <p>{hasData ? `${dailyMortRate.toFixed(2)}%` : '-'}</p>
          </div>
          <div className="kpi">
            <h3>Cumulative mortality</h3>
            <p>{hasData ? `${cumMortRate.toFixed(2)}%` : '-'}</p>
          </div>
          <div className="kpi">
            <h3>Livability</h3>
            <p>{hasData ? `${livability.toFixed(2)}%` : '-'}</p>
          </div>
          <div className="kpi">
            <h3>Current alive hens</h3>
            <p>{startingHens > 0 ? currentAlive.toLocaleString() : 'Add hens'}</p>
          </div>
        </div>
      </section>

      <section className="section chart-card">
        <h2>Total eggs per day</h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="totalEggs" stroke="#7d5a2a" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="section chart-card">
        <h2>Egg size count per day</h2>
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
        <h2>Total egg weight per day</h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <XAxis dataKey="date" />
              <YAxis unit="g" />
              <Tooltip />
              <Line type="monotone" dataKey="totalWeight" stroke="#c38c45" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
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
        <p className="footer-note">
          Weighted average per egg. This stays steady when the size mix is steady.
        </p>
      </section>

      <section className="section chart-card">
        <h2>Mortality vs HDEP</h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="mortality" stroke="#b33a3a" />
              <Line yAxisId="right" type="monotone" dataKey="hdep" stroke="#144b59" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}
