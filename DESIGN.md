# Poultry Layer Log — Design System

## Philosophy: "Field Instrument"

Clean, dark, purposeful. Like a high-end agricultural instrument — precision data on a dark panel, gold as the signal colour. No decoration for its own sake. Every element earns its place.

---

## Colour Palette

Defined as CSS custom properties in `app/globals.css`. Never hardcode hex values in components — always use the variable.

### Core Tokens

| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#0D1117` | Page background — deep coal/navy |
| `--surface` | `#111827` | Card/panel background |
| `--surface-elevated` | `#1A2535` | Nested cards, hover surfaces |
| `--ink` | `#F0F4F8` | Primary text on dark |
| `--muted` | `#7A9BA8` | Secondary text, labels, metadata |
| `--gold` | `#D4AF37` | Primary accent — CTAs, stat numbers, key highlights |
| `--gold-dim` | `rgba(212,175,55,0.12)` | Subtle gold tint for backgrounds |
| `--border` | `rgba(212,175,55,0.2)` | Gold hairline — structural borders |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Subtle separator on dark surfaces |
| `--danger` | `#E05252` | Destructive actions, errors |
| `--success` | `#4CAF7D` | Confirmation, success states |

### Gold Usage Rule
Gold (`--gold`) should appear on **< 5% of screen area**. It is reserved for:
- Primary CTA buttons
- KPI stat numbers
- Active/selected states
- Key highlights and markers

If everything is gold, nothing is important.

---

## Typography

Fonts loaded via `next/font` in `app/layout.tsx`.

| Role | Family | Variable |
|------|--------|----------|
| Display / Headlines | Fraunces (serif) | `--font-display` |
| Body / Labels / UI | Work Sans | `--font-body` |

### Type Scale

| Use | Size | Weight | Notes |
|-----|------|--------|-------|
| Page title / brand | 1.5rem | 700 | Fraunces |
| Section heading | 1.1rem | 600 | Work Sans |
| Body text | 1rem | 400 | Work Sans |
| Label / metadata | 0.85rem | 600 | Work Sans, muted colour |
| Micro label | 0.75rem | 700 | Work Sans, uppercase, tracked |
| KPI number | 1.5rem | 700 | Work Sans, gold |

---

## Spacing & Shape

- **Border radius**: `4px` on all UI elements — sharp, instrument-like. No pill buttons or rounded cards.
- **Hairlines**: All borders are `0.5px` — use `style={{ border: "0.5px solid ..." }}` when CSS border property rounds up to 1px.
- **Section gap**: `24px` between sections
- **Card padding**: `20px`
- **Max content width**: `1100px`, centred, `24px` side padding

---

## Components

### Buttons

```css
/* Primary — gold fill, dark text */
button.primary {
  background: var(--gold);
  color: #0D1117;
  border-radius: 4px;
}

/* Secondary — transparent with gold hairline */
button.secondary {
  background: transparent;
  border: 0.5px solid var(--gold);
  color: var(--gold);
  border-radius: 4px;
}

/* Ghost — subtle outline */
button.ghost {
  background: transparent;
  border: 0.5px solid var(--border-subtle);
  color: var(--muted);
  border-radius: 4px;
}

/* Danger */
button.danger {
  background: transparent;
  border: 0.5px solid var(--danger);
  color: var(--danger);
  border-radius: 4px;
}
```

### Cards

```css
.card {
  background: var(--surface);
  border: 0.5px solid var(--border-subtle);
  border-radius: 4px;
  padding: 20px;
}

/* Highlighted card — subtle gold accent */
.card.accent {
  border-color: var(--border); /* gold hairline */
  background: var(--gold-dim);
}
```

### KPI Numbers

Large stat values use gold to signal importance:
```css
.kpi p { color: var(--gold); font-size: 1.5rem; font-weight: 700; }
.kpi h3 { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
```

### Form Inputs

```css
input, select, textarea {
  background: var(--surface-elevated);
  border: 0.5px solid var(--border-subtle);
  color: var(--ink);
  border-radius: 4px;
}
input:focus { border-color: var(--gold); outline: none; }
```

### Nav Links

```css
.nav-links a {
  padding: 8px 14px;
  border: 0.5px solid var(--border-subtle);
  border-radius: 4px;
  color: var(--muted);
  font-size: 0.9rem;
}
.nav-links a:hover { color: var(--ink); border-color: var(--border); }
```

### Table

```css
.table th { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
.table td { color: var(--ink); }
.table th, .table td { border-bottom: 0.5px solid var(--border-subtle); }
```

### Chips / Filters

```css
.chip {
  background: var(--surface-elevated);
  border: 0.5px solid var(--border-subtle);
  border-radius: 4px; /* NOT pill-shaped */
  color: var(--muted);
}
.chip.active {
  border-color: var(--gold);
  color: var(--gold);
  background: var(--gold-dim);
}
```

---

## Chart Colours

Use these for Recharts series in `AnalyticsClient.tsx`:

| Series | Colour |
|--------|--------|
| Primary line / bar | `#D4AF37` (gold) |
| Secondary line | `#4CAF7D` (success green) |
| Tertiary | `#7A9BA8` (muted blue) |
| Grid lines | `rgba(255,255,255,0.06)` |
| Axis labels | `#7A9BA8` |
| Tooltip background | `#1A2535` |

---

## Do's and Don'ts

**Do**
- Sharp `4px` radius on all UI elements
- `0.5px` hairlines for all borders
- Gold only for CTAs, stats, and key signals
- Uppercase micro-labels (`0.75rem`, `letter-spacing: 0.06em`) for KPI titles and table headers
- Dark surfaces with subtle depth — `--surface` → `--surface-elevated`

**Don't**
- No pill-shaped buttons or chips (`border-radius: 999px`)
- No rounded cards (avoid anything over `6px`)
- No warm orange/beige tones from the old palette
- No drop shadows — use border hairlines for depth instead
- Don't overuse gold — restraint is what makes it work
