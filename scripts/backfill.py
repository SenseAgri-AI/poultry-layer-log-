"""
Backfill script — reads Annie's Eggs Master document.xlsx and POSTs
each daily row to the running local app.

Usage:
  python3 scripts/backfill.py [--dry-run] [--weeks 2] [--house "House 1"] [--url http://localhost:3001]

Requirements:
  pip install openpyxl requests   (or: python3 -m pip install openpyxl requests)
"""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import openpyxl
    import requests
except ImportError:
    print("Missing dependencies. Run:\n  pip install openpyxl requests")
    sys.exit(1)

EXCEL_PATH = Path(__file__).parent.parent / "Annie's Eggs Master document.xlsx"

def to_int(val):
    if val is None or val == '' or val == '-':
        return 0
    try:
        return max(0, int(float(str(val))))
    except (ValueError, TypeError):
        return 0

def to_date_str(val):
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%d')
    return None

def parse_entries(wb, max_weeks=None, house_id='House 1'):
    ws = wb['Daily Eggs and Mortaliy']
    entries = []
    weeks_seen = set()
    skipped = 0

    # Rows start at index 1 (openpyxl is 1-based), first 2 rows are headers
    for row in ws.iter_rows(min_row=3, values_only=True):
        # Col A (index 0) = week label, Col B (index 1) = date
        raw_date = row[1]
        if not raw_date:
            skipped += 1
            continue  # weekly total row — skip

        date_str = to_date_str(raw_date)
        if not date_str:
            skipped += 1
            continue

        # Track weeks for --weeks limit
        # Week label is in col A but may be a formula string; derive from date instead
        week_num = (raw_date - datetime(2025, 10, 10)).days // 7
        weeks_seen.add(week_num)
        if max_weeks and len(weeks_seen) > max_weeks:
            break

        entry = {
            'date':           date_str,
            'houseId':        house_id,
            'small':          to_int(row[3]),   # col D
            'medium':         to_int(row[4]),   # col E
            'large':          to_int(row[5]),   # col F
            'xl':             to_int(row[6]),   # col G
            'j':              to_int(row[7]),   # col H (jumbo)
            'damaged':        to_int(row[8]),   # col I (cracked)
            'mortality':      to_int(row[10]),  # col K
            'notes':          str(row[11]).strip() if row[11] else '',
            'waterPh':        None,
            'eggYolkColor':   None,
            'avgHenWeightKg': None,
            'waterIntakeMl':  None,
            'feedType':       '',
            'waterAdditives': ''
        }
        entries.append(entry)

    print(f"Parsed {len(entries)} entries, skipped {skipped} total/blank rows")
    return entries

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Print entries without posting')
    parser.add_argument('--weeks', type=int, default=None, help='Limit to N weeks (default: all)')
    parser.add_argument('--house', default='house1', help='House ID to assign entries to')
    parser.add_argument('--url', default='http://localhost:3001', help='App base URL')
    parser.add_argument('--only-dates', nargs='+', help='Only import these specific dates (YYYY-MM-DD)')
    args = parser.parse_args()

    print(f"Reading: {EXCEL_PATH}")
    wb = openpyxl.load_workbook(EXCEL_PATH)
    entries = parse_entries(wb, max_weeks=args.weeks, house_id=args.house)
    if args.only_dates:
        entries = [e for e in entries if e['date'] in args.only_dates]
        print(f"Filtered to {len(entries)} specified dates")

    if args.dry_run:
        print(f"\n--- DRY RUN — {len(entries)} entries ---")
        for e in entries:
            print(f"  {e['date']}  small={e['small']} med={e['medium']} large={e['large']} xl={e['xl']} j={e['j']} damaged={e['damaged']} mortality={e['mortality']}  notes={e['notes']!r}")
        print(f"\nWould import {len(entries)} entries to house '{args.house}'")
        return

    print(f"\nImporting {len(entries)} entries → {args.url}  (house: {args.house})")
    ok, failed = 0, 0

    for entry in entries:
        try:
            res = requests.post(
                f"{args.url}/api/entries",
                json=entry,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            if not res.ok:
                data = res.json() if res.content else {}
                raise Exception(data.get('error', f"HTTP {res.status_code}"))
            ok += 1
            print(f"  ✓ {entry['date']}")
        except Exception as e:
            failed += 1
            print(f"  ✗ {entry['date']}: {e}")
        time.sleep(5)

    print(f"\nDone. {ok} imported, {failed} failed.")

if __name__ == '__main__':
    main()
