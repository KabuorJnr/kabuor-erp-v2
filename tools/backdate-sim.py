# Moves what the server stamped "now" during tools/simulate-8-months.mjs onto the simulated day it belonged to.
# Each simulated day ran in a short real-time window (demo/sim-8-months.json). Every timestamp inside a window is
# spread across that day's business hours (07:30-18:00 EAT, in order), and dates written as the real "today" by
# that day's work (journal entries, drafts turned into invoices, agents' purchase orders) become the simulated date.
# Batch expiry dates are put back to the true shelf life. Run with the server stopped:
#   python tools/backdate-sim.py demo/amani-demo.db demo/sim-8-months.json
import json, sqlite3, sys
from datetime import date, datetime, timedelta, timezone

db_path, map_path = sys.argv[1], sys.argv[2]
sim = json.load(open(map_path, encoding='utf8'))
con = sqlite3.connect(db_path)
EPOCH_TICKS = 621355968000000000

def enc_ms(ms):  # unix ms -> the stored value's upper bits (ticks/1000), as EF's DateTimeOffset binary converter keeps it
    return (ms * 10000 + EPOCH_TICKS) // 1000

def to_ms(v):
    return ((v >> 11) * 1000 - EPOCH_TICKS) // 10000

windows = [w for w in sim['windows'] if w['end'] > w['start']]
skip = {'ExpiresAt', 'NextAt', 'TrialEndsAt'}
columns = []
for (table,) in con.execute("select name from sqlite_master where type='table' and name not like '__EF%' and name not like 'sqlite%'"):
    for _, col, typ, *_ in con.execute(f'pragma table_info("{table}")'):
        if col.endswith('At') and col not in skip and typ.upper() == 'INTEGER':
            columns.append((table, col))

def has(table, col):
    return any(c == col for _, c, *_ in con.execute(f'pragma table_info("{table}")'))

moved = {}
with con:
    for w in windows:
        lo, hi = enc_ms(w['start']) << 11, (enc_ms(w['end']) + 1) << 11
        day = w['day']
        real_dates = w['realDates']
        shift = lambda d: (date.fromisoformat(day) - date.fromisoformat(d)).days
        # Dates first, while CreatedAt still shows which window wrote the row.
        for table, cols in [('JournalEntries', ['Date']), ('SalesDocs', ['IssueDate', 'DueDate']), ('PurchaseDocs', ['IssueDate', 'DueDate'])]:
            q = f'select Id, {", ".join(cols)} from "{table}" where CreatedAt >= ? and CreatedAt < ? and {cols[0]} in ({",".join("?" * len(real_dates))})'
            for row in con.execute(q, [lo, hi, *real_dates]).fetchall():
                n = shift(row[1])
                if n == 0:
                    continue
                sets = {c: (date.fromisoformat(v) + timedelta(days=n)).isoformat() for c, v in zip(cols, row[1:]) if v}
                con.execute(f'update "{table}" set {", ".join(f"{c} = ?" for c in sets)} where Id = ?', [*sets.values(), row[0]])
                moved[f'{table}.dates'] = moved.get(f'{table}.dates', 0) + 1
        # Then every "now" timestamp, spread over the business day in the order things happened.
        open_ms = int(datetime.fromisoformat(f'{day}T07:30:00+03:00').timestamp() * 1000)
        span = max(1, w['end'] - w['start'])
        for table, col in columns:
            for rowid, v in con.execute(f'select rowid, "{col}" from "{table}" where "{col}" >= ? and "{col}" < ?', [lo, hi]).fetchall():
                frac = (to_ms(v) - w['start']) / span
                new_ms = open_ms + int(frac * 10.5 * 3600 * 1000)
                con.execute(f'update "{table}" set "{col}" = ? where rowid = ?', [(enc_ms(new_ms) << 11) | (v & 0x7FF), rowid])
                moved[f'{table}.{col}'] = moved.get(f'{table}.{col}', 0) + 1
    for batch, expiry in sim.get('batchExpiry', {}).items():
        con.execute('update StockBatches set Expiry = ? where BatchNo = ?', [expiry, batch])
    moved['StockBatches.Expiry'] = len(sim.get('batchExpiry', {}))

for k in sorted(moved):
    print(f'{k:40} {moved[k]:>7}')
