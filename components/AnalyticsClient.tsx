'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  ComposedChart,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import type { Entry, House } from '@/lib/types';
import { averageEggWeight, totalEggs, totalWeight } from '@/lib/eggMath';
import { dateStringDaysAgo, daysBetween, getClientTimezone, todayInTz } from '@/lib/date';
import { standardHdepForWeek } from '@/lib/henStandard';

const seriesList = [
  { key: 'small', label: 'Small', color: '#7d5a2a' },
  { key: 'medium', label: 'Medium', color: '#c38c45' },
  { key: 'large', label: 'Large', color: '#2f6f63' },
  { key: 'xl', label: 'XL', color: '#3f7f6f' },
  { key: 'j', label: 'Jumbo', color: '#144b59' }
] as const;

const fallbackHouse: House = {
  id: 'House 1',
  name: 'House 1',
  startDate: '',
  startAgeDays: 0,
  startingHens: 0
};

function movingAverage(values: number[], window: number): number[] {
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= window) {
      sum -= values[i - window];
    }
    const divisor = i + 1 < window ? i + 1 : window;
    result.push(sum / divisor);
  }
  return result;
}

type SeriesKey = (typeof seriesList)[number]['key'];

type ChartRow = Entry & {
  avgWeight: number;
  totalEggs: number;
  totalWeight: number;
  saleableEggs: number;
  hdep: number;
  hhep: number;
  dailyMortalityRate: number;
  liveHens: number;
  totalEggsAvg7: number;
  hdepAvg7: number;
  hhepAvg7: number;
  standardHdep: number | null;
};

export default function AnalyticsClient() {
  const timezone = getClientTimezone();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [selectedHouseId, setSelectedHouseId] = useState('House 1');
  const [loading, setLoading] = useState(true);
  const [rangePreset, setRangePreset] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [targetEggs, setTargetEggs] = useState('');
  const [targetSaleable, setTargetSaleable] = useState('');
  const [targetHdep, setTargetHdep] = useState('');
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
    if (!houses.some((house) => house.id === selectedHouseId)) {
      setSelectedHouseId(houses[0].id);
    }
  }, [houses, selectedHouseId]);

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

  const selectedHouse = useMemo(
    () => houses.find((house) => house.id === selectedHouseId),
    [houses, selectedHouseId]
  );
  const startingHens = selectedHouse?.startingHens ?? 0;
  const startDate = selectedHouse?.startDate ?? '';
  const startAgeDays = selectedHouse?.startAgeDays ?? 0;

  const houseEntries = useMemo(() => {
    return entries.filter((entry) => entry.houseId === selectedHouseId);
  }, [entries, selectedHouseId]);

  const filtered = useMemo(() => {
    return houseEntries
      .filter((entry) => entry.date >= dateRange.start && entry.date <= dateRange.end)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [houseEntries, dateRange]);

  const hensByDate = useMemo(() => {
    const sorted = [...houseEntries].sort((a, b) => a.date.localeCompare(b.date));
    let hens = Math.max(startingHens, 0);
    const map = new Map<string, number>();
    for (const entry of sorted) {
      map.set(entry.date, hens);
      hens = Math.max(hens - entry.mortality, 0);
    }
    return map;
  }, [houseEntries, startingHens]);

  const currentAlive = useMemo(() => {
    const sorted = [...houseEntries].sort((a, b) => a.date.localeCompare(b.date));
    let hens = Math.max(startingHens, 0);
    for (const entry of sorted) {
      hens = Math.max(hens - entry.mortality, 0);
    }
    return hens;
  }, [houseEntries, startingHens]);

  const latestEntry = useMemo(() => {
    const sorted = [...houseEntries].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.length > 0 ? sorted[sorted.length - 1] : null;
  }, [houseEntries]);

  const latestDateLabel = latestEntry?.date ?? '';
  const latestLiveHens = latestEntry
    ? hensByDate.get(latestEntry.date) ?? Math.max(startingHens, 0)
    : 0;
  const latestEggs = latestEntry ? totalEggs(latestEntry) : 0;
  const latestSaleable = latestEntry ? Math.max(latestEggs - latestEntry.damaged, 0) : 0;
  const latestHdep = latestLiveHens > 0 ? (latestEggs / latestLiveHens) * 100 : 0;
  const latestHhep = startingHens > 0 ? (latestEggs / startingHens) * 100 : 0;
  const latestDamageRate = latestEggs > 0 && latestEntry ? (latestEntry.damaged / latestEggs) * 100 : 0;
  const latestMortalityRate =
    latestLiveHens > 0 && latestEntry ? (latestEntry.mortality / latestLiveHens) * 100 : 0;
  const latestAvgWeight = latestEntry ? averageEggWeight(latestEntry) : 0;
  const hasDailyData = Boolean(latestEntry);

  const chartData = useMemo<ChartRow[]>(() => {
    const rows = filtered.map((entry) => {
      const liveHens = hensByDate.get(entry.date) ?? Math.max(startingHens, 0);
      const eggsToday = totalEggs(entry);
      const saleableEggs = Math.max(eggsToday - entry.damaged, 0);
      let standardHdep: number | null = null;
      if (startDate) {
        const ageWeeks = (startAgeDays + daysBetween(startDate, entry.date)) / 7;
        standardHdep = standardHdepForWeek(ageWeeks);
      }
      return {
        ...entry,
        avgWeight: Number(averageEggWeight(entry).toFixed(2)),
        totalEggs: eggsToday,
        totalWeight: Number(totalWeight(entry).toFixed(1)),
        saleableEggs,
        liveHens,
        hdep: liveHens > 0 ? (eggsToday / liveHens) * 100 : 0,
        hhep: startingHens > 0 ? (eggsToday / startingHens) * 100 : 0,
        dailyMortalityRate: liveHens > 0 ? (entry.mortality / liveHens) * 100 : 0,
        totalEggsAvg7: 0,
        hdepAvg7: 0,
        hhepAvg7: 0,
        standardHdep
      };
    });

    const eggsAvg = movingAverage(
      rows.map((row) => row.totalEggs),
      7
    );
    const hdepAvg = movingAverage(
      rows.map((row) => row.hdep),
      7
    );
    const hhepAvg = movingAverage(
      rows.map((row) => row.hhep),
      7
    );

    return rows.map((row, index) => ({
      ...row,
      totalEggsAvg7: Number(eggsAvg[index].toFixed(1)),
      hdepAvg7: Number(hdepAvg[index].toFixed(2)),
      hhepAvg7: Number(hhepAvg[index].toFixed(2))
    }));
  }, [filtered, hensByDate, startingHens, startAgeDays, startDate]);

  const targetEggsValue = useMemo(() => {
    const value = Number(targetEggs);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [targetEggs]);

  const targetSaleableValue = useMemo(() => {
    const value = Number(targetSaleable);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [targetSaleable]);

  const targetHdepValue = useMemo(() => {
    const value = Number(targetHdep);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [targetHdep]);

  return (
    <main>
      <header className="nav">
        <div className="brand">Analytics</div>
        <nav className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/entry">Daily Entry</Link>
        </nav>
      </header>

      <section className="section card daily-kpi">
        <h2>
          Daily key performance indicators {latestDateLabel ? `(${latestDateLabel})` : ''}
          {selectedHouseId ? ` - ${selectedHouse?.name ?? selectedHouseId}` : ''}
        </h2>
        <div className="kpi-grid">
          <div className="kpi">
            <h3 className="metric-title">Live hens (current)</h3>
            <p>{startingHens > 0 ? currentAlive.toLocaleString() : 'Add hens'}</p>
          </div>
          <div className="kpi">
            <h3 className="metric-title">Total eggs (today)</h3>
            <p>{hasDailyData ? latestEggs.toLocaleString() : '-'}</p>
          </div>
          <div className="kpi">
            <h3 className="metric-title">Saleable eggs (today)</h3>
            <p>{hasDailyData ? latestSaleable.toLocaleString() : '-'}</p>
          </div>
          <div className="kpi">
            <h3 className="metric-title">HDEP (Hen-Day %, today)</h3>
            <p>{hasDailyData ? `${latestHdep.toFixed(1)}%` : '-'}</p>
          </div>
          <div className="kpi">
            <h3 className="metric-title">HHEP (Hen-Housed %, today)</h3>
            <p>{hasDailyData ? `${latestHhep.toFixed(1)}%` : '-'}</p>
          </div>
          <div className="kpi">
            <h3 className="metric-title">Damaged % (today)</h3>
            <p>{hasDailyData ? `${latestDamageRate.toFixed(1)}%` : '-'}</p>
          </div>
          <div className="kpi">
            <h3 className="metric-title">Mortality today</h3>
            <p>
              {hasDailyData
                ? `${latestEntry?.mortality ?? 0} (${latestMortalityRate.toFixed(2)}%)`
                : '-'}
            </p>
          </div>
          <div className="kpi">
            <h3 className="metric-title">Avg egg weight (today)</h3>
            <p>{hasDailyData ? `${latestAvgWeight.toFixed(1)} g` : '-'}</p>
          </div>
        </div>
      </section>

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
            <label htmlFor="houseSelect">House</label>
            <select
              id="houseSelect"
              value={selectedHouseId}
              onChange={(event) => setSelectedHouseId(event.target.value)}
            >
              {(houses.length ? houses : [fallbackHouse]).map((house) => (
                <option key={house.id} value={house.id}>
                  {house.name}
                </option>
              ))}
            </select>
          </div>
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
            <label htmlFor="houseStartDate">Cycle start date</label>
            <input id="houseStartDate" type="date" value={startDate} readOnly />
          </div>
          <div>
            <label htmlFor="houseStartAge">Age at start (days)</label>
            <input id="houseStartAge" type="number" value={startAgeDays} readOnly />
          </div>
          <div>
            <label htmlFor="hensPlaced">Starting hens</label>
            <input id="hensPlaced" type="number" value={startingHens} readOnly />
          </div>
          <div>
            <label htmlFor="liveHens">Current alive hens</label>
            <input id="liveHens" type="number" value={currentAlive} readOnly />
          </div>
          <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
            <strong style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              Targets (optional)
            </strong>
          </div>
          <div>
            <label htmlFor="targetEggs">Eggs/day target</label>
            <input
              id="targetEggs"
              type="number"
              min={0}
              step={1}
              value={targetEggs}
              onChange={(event) => setTargetEggs(event.target.value)}
              placeholder="e.g. 3800"
            />
          </div>
          <div>
            <label htmlFor="targetSaleable">Saleable eggs/day target</label>
            <input
              id="targetSaleable"
              type="number"
              min={0}
              step={1}
              value={targetSaleable}
              onChange={(event) => setTargetSaleable(event.target.value)}
              placeholder="e.g. 3700"
            />
          </div>
          <div>
            <label htmlFor="targetHdep">HDEP target %</label>
            <input
              id="targetHdep"
              type="number"
              min={0}
              step={0.1}
              value={targetHdep}
              onChange={(event) => setTargetHdep(event.target.value)}
              placeholder="e.g. 90"
            />
          </div>
        </div>
      </section>

      <section className="section chart-card">
        <h2 className="metric-title">Total output (eggs + weight)</h2>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="eggsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7d5a2a" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#7d5a2a" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" unit="g" />
              <Tooltip />
              <Legend />
              {targetEggsValue != null ? (
                <ReferenceLine
                  yAxisId="left"
                  y={targetEggsValue}
                  stroke="#d8792c"
                  strokeDasharray="4 4"
                  label="Eggs target"
                />
              ) : null}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="totalEggs"
                name="Total eggs"
                stroke="#7d5a2a"
                fill="url(#eggsFill)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalEggsAvg7"
                name="Eggs (7d avg)"
                stroke="#d8792c"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalWeight"
                name="Total weight (g)"
                stroke="#c38c45"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="section chart-card">
        <h2 className="metric-title">Saleable vs total eggs</h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {targetSaleableValue != null ? (
                <ReferenceLine
                  y={targetSaleableValue}
                  stroke="#d8792c"
                  strokeDasharray="4 4"
                  label="Saleable target"
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="totalEggs"
                name="Total eggs"
                stroke="#7d5a2a"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="saleableEggs"
                name="Saleable eggs"
                stroke="#2f6f63"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="section chart-card">
        <h2 className="metric-title">Egg size count per day</h2>
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
        <h2 className="metric-title">HDEP vs HHEP (daily)</h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip />
              <Legend />
              {targetHdepValue != null ? (
                <ReferenceLine
                  y={targetHdepValue}
                  stroke="#d8792c"
                  strokeDasharray="4 4"
                  label="HDEP target"
                />
              ) : null}
              <Line type="monotone" dataKey="hdep" name="HDEP %" stroke="#144b59" />
              <Line type="monotone" dataKey="hhep" name="HHEP %" stroke="#3f7f6f" />
              <Line
                type="monotone"
                dataKey="hdepAvg7"
                name="HDEP (7d avg)"
                stroke="#144b59"
                strokeDasharray="6 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="hhepAvg7"
                name="HHEP (7d avg)"
                stroke="#3f7f6f"
                strokeDasharray="6 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="standardHdep"
                name="Standard HDEP %"
                stroke="#d94b2b"
                strokeDasharray="3 3"
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="section chart-card">
        <h2 className="metric-title">Average egg weight over time</h2>
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

    </main>
  );
}
