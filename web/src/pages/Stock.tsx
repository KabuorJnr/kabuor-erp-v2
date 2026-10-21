import { Expiring } from '../components/Trade';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeftRight, ClipboardCheck, History, Loader2 } from 'lucide-react';
import { api, can, useApi, useSession } from '../lib/api';
import { dateTime, ksh } from '../lib/format';
import { useLang } from '../lib/i18n';
import { Chips, Empty, ErrorNote, Field, Loading, PageHeader, SearchBox, Sheet, Status } from '../components/ui';

type StockItem = {
  id: string;
  name: string;
  brand?: string;
  sku: string;
  unit: string;
  price: number;
  trackStock: boolean;
  reorderLevel: number;
  total: number;
  averageCost: number;
  value: number;
  state: 'ok' | 'low' | 'out' | 'below';
  byLocation: Record<string, number>;
};

type StockMove = {
  id: string;
  kind: string;
  quantity: number;
  unitCost: number;
  reference: string;
  note: string;
  actor: string;
  at: string;
  location: string;
};

type Location = {
  id: string;
  name: string;
  isDefault: boolean;
};

type StockOverviewData = {
  counts: { all: number; low: number; out: number; below?: number };
  totalValue: number;
  items: StockItem[];
  locations: Location[];
};

function StockMovesSheet({
  itemId,
  itemName,
  open,
  onClose,
}: {
  itemId: string | null;
  itemName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data, loading, error } = useApi<StockMove[]>(open && itemId ? `/stock/${itemId}/moves` : null);

  return (
    <Sheet open={open} onClose={onClose} title={`Stock history: ${itemName}`} wide>
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading ? (
        <Loading />
      ) : !data || data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No stock movements recorded for this item yet.</p>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-line text-sm">
            {data.map((m) => (
              <li key={m.id} className="py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Status
                      tone={
                        m.quantity > 0
                          ? 'good'
                          : m.kind === 'Sale'
                          ? 'info'
                          : m.kind === 'Count'
                          ? 'warn'
                          : 'plain'
                      }
                    >
                      {m.kind}
                    </Status>
                    <span className="font-semibold text-ink">{m.reference || '—'}</span>
                    <span className="text-xs text-muted">· {m.location}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {dateTime(m.at)} by {m.actor}
                    {m.note ? ` · ${m.note}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <b className={`num block font-bold ${m.quantity >= 0 ? 'text-good' : 'text-bad'}`}>
                    {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                  </b>
                  {m.unitCost > 0 && <span className="text-xs text-muted num">@ {ksh(m.unitCost)}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}

function StockCountModal({
  open,
  onClose,
  items,
  locations,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  items: StockItem[];
  locations: Location[];
  onSaved: () => void;
}) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });

  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      for (const it of items) {
        const qty = it.byLocation?.[locationId] ?? it.total ?? 0;
        init[it.id] = qty.toString();
      }
      setCounts(init);
    }
  }, [open, locationId, items]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      const payload = {
        locationId: locationId || undefined,
        note: note.trim() || undefined,
        counts: Object.entries(counts).map(([itemId, val]) => ({
          itemId,
          counted: parseFloat(val) || 0,
        })),
      };
      await api('/stock/count', { method: 'POST', body: payload });
      onSaved();
      onClose();
    } catch (err) {
      setState({ busy: false, error: (err as Error).message });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Count stock / Inventory check" wide>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-muted">
          Count actual items on shelves. Any difference between system stock and your physical count will create a
          stock adjustment entry in books.
        </p>

        {locations.length > 1 && (
          <Field label="Store / Store Location">
            <select
              className="field"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="max-h-96 overflow-y-auto card divide-y divide-line">
          {items.map((it) => {
            const expected = it.byLocation?.[locationId] ?? it.total ?? 0;
            const entered = parseFloat(counts[it.id] ?? '') || 0;
            const diff = entered - expected;
            return (
              <div key={it.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{it.name}</b>
                  <span className="text-xs text-muted">
                    Expected: {expected} {it.unit}
                    {diff !== 0 && (
                      <span className={`ml-2 font-semibold ${diff > 0 ? 'text-good' : 'text-bad'}`}>
                        ({diff > 0 ? `+${diff}` : diff} diff)
                      </span>
                    )}
                  </span>
                </div>
                <div className="w-28 shrink-0">
                  <input
                    className="field text-right text-sm py-1.5"
                    type="number"
                    step="any"
                    min="0"
                    value={counts[it.id] ?? ''}
                    onChange={(e) => setCounts({ ...counts, [it.id]: e.target.value })}
                    placeholder="Counted"
                    aria-label={`Count for ${it.name}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Field label="Note / Reason" hint="e.g. End of month physical inventory count">
          <input
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Audit or count reason"
          />
        </Field>

        {state.error && <ErrorNote>{state.error}</ErrorNote>}

        <button className="btn btn-primary w-full py-3" disabled={state.busy}>
          {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Save physical count
        </button>
      </form>
    </Sheet>
  );
}

function StockTransferModal({
  open,
  onClose,
  items,
  locations,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  items: StockItem[];
  locations: Location[];
  onSaved: () => void;
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const [fromLoc, setFromLoc] = useState(locations[0]?.id ?? '');
  const [toLoc, setToLoc] = useState(locations[1]?.id ?? '');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });

  const selectedItem = items.find((i) => i.id === itemId);
  const available = selectedItem?.byLocation?.[fromLoc] ?? 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    if (!itemId || !fromLoc || !toLoc) {
      setState({ busy: false, error: 'Select an item and both source and destination stores.' });
      return;
    }
    if (fromLoc === toLoc) {
      setState({ busy: false, error: 'Source and destination store must be different.' });
      return;
    }
    const q = parseFloat(quantity) || 0;
    if (q <= 0) {
      setState({ busy: false, error: 'Enter a valid transfer quantity.' });
      return;
    }
    if (q > available) {
      setState({ busy: false, error: `Only ${available} available in source store.` });
      return;
    }
    try {
      await api('/stock/transfer', {
        method: 'POST',
        body: {
          itemId,
          from: fromLoc,
          to: toLoc,
          quantity: q,
          note: note.trim() || undefined,
        },
      });
      onSaved();
      onClose();
    } catch (err) {
      setState({ busy: false, error: (err as Error).message });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Transfer stock between stores">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Item to move">
          <select className="field" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} (Total: {it.total} {it.unit})
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="From store">
            <select className="field" value={fromLoc} onChange={(e) => setFromLoc(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="To store">
            <select className="field" value={toLoc} onChange={(e) => setToLoc(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="rounded-lg bg-paper p-3 text-xs text-muted ring-1 ring-line">
          Available in source store: <b className="text-ink font-semibold">{available}</b>
        </div>

        <Field label="Quantity to transfer">
          <input
            className="field"
            type="number"
            step="any"
            min="0.01"
            max={available}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </Field>

        <Field label="Transfer note">
          <input
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Restock shop floor from main warehouse"
          />
        </Field>

        {state.error && <ErrorNote>{state.error}</ErrorNote>}

        <button className="btn btn-primary w-full py-3" disabled={state.busy}>
          {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Transfer stock
        </button>
      </form>
    </Sheet>
  );
}

export default function Stock() {
  const session = useSession();
  const { t } = useLang();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<'all' | 'low' | 'out' | 'below' | 'expiring'>(() => (['low', 'out', 'below', 'expiring'].includes(params.get('filter') ?? '') ? (params.get('filter') as 'low' | 'out' | 'below' | 'expiring') : 'all'));
  const [q, setQ] = useState(params.get('q') ?? '');
  const [query, setQuery] = useState(params.get('q') ?? '');

  const [counting, setCounting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [historyItem, setHistoryItem] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQuery(q), 250);
    return () => clearTimeout(id);
  }, [q]);

  const { data, error, loading, reload } = useApi<StockOverviewData>(
    `/stock?filter=${filter === 'expiring' ? 'all' : filter}&q=${encodeURIComponent(query)}`,
  );

  const items = data?.items ?? [];
  const locations = data?.locations ?? [];
  const totalValue = data?.totalValue ?? 0; // all stock, not just the rows shown

  return (
    <>
      <PageHeader
        title={t('Stock')}
        subtitle={
          data &&
          `${items.length} items shown · Total inventory value ${ksh(totalValue)}${
            data.counts.low > 0 ? ` · ${data.counts.low} low stock` : ''
          }`
        }
        actions={
          <div className="flex gap-2">
            {can(session, 'stock') && (
              <button className="btn btn-ghost" onClick={() => setTransferring(true)}>
                <ArrowLeftRight className="h-4 w-4" /> {t('Transfer stock')}
              </button>
            )}
            {can(session, 'stock') && (
              <button className="btn btn-primary" onClick={() => setCounting(true)}>
                <ClipboardCheck className="h-4 w-4" /> {t('Count stock')}
              </button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Chips
          label="Filter stock"
          value={filter}
          onChange={setFilter}
          options={[
            ['all', t('All'), data?.counts.all],
            ['low', t('Low stock'), data?.counts.low],
            ['out', t('Out of stock'), data?.counts.out],
            ...(data?.counts.below ? [['below', 'Below zero', data.counts.below] as ['below', string, number]] : []),
            ['expiring', 'Expiring'],
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Search product name, brand or SKU" />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {(data?.counts.below ?? 0) > 0 && filter !== 'expiring' && (
        <p className="mb-3 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
          {data!.counts.below} item{data!.counts.below === 1 ? ' was' : 's were'} sold beyond what was recorded as received. Enter the missing supplier bills, or count {data!.counts.below === 1 ? 'it' : 'them'} to correct the stock. The owner can stop this happening in Settings.
        </p>
      )}
      {filter === 'expiring' ? (
        <Expiring />
      ) : loading && !data ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty
          title={query || filter !== 'all' ? 'No products match' : 'No tracked products'}
          action={
            <Link to="/invoices/new" className="btn btn-primary">
              Manage items in settings
            </Link>
          }
        >
          {query || filter !== 'all'
            ? 'Try another search term or filter.'
            : 'Track stock on your items in settings or by posting supplier bills.'}
        </Empty>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line sm:hidden">
            {items.map((it) => (
              <li
                key={it.id}
                className="p-4 flex items-center justify-between gap-3 hover:bg-paper cursor-pointer"
                onClick={() => setHistoryItem({ id: it.id, name: it.name })}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="truncate text-ink">{it.name}</b>
                    {it.brand && (
                      <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-medium text-brand">
                        {it.brand}
                      </span>
                    )}
                    <Status
                      tone={it.state === 'ok' ? 'good' : it.state === 'low' ? 'warn' : 'bad'}
                    >
                      {it.state === 'ok' ? t('In stock') : it.state === 'low' ? t('Low stock') : it.state === 'below' ? `Below zero (${it.total})` : t('Out of stock')}
                    </Status>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {it.sku ? `${it.sku} · ` : ''}Avg cost {ksh(it.averageCost)} · Reorder at {it.reorderLevel} {it.unit}
                  </p>
                </div>
                <div className="text-right">
                  <b className="num text-base font-bold text-ink">
                    {it.total} <span className="text-xs text-muted font-normal">{it.unit}</span>
                  </b>
                  <span className="num block text-xs text-muted">{ksh(it.value)}</span>
                </div>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-sm sm:table">
            <thead className="border-b border-line bg-paper text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Item</th>
                <th className="px-4 py-2.5 font-semibold">Brand</th>
                <th className="px-4 py-2.5 font-semibold">SKU</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 text-right font-semibold">On Hand</th>
                <th className="px-4 py-2.5 text-right font-semibold">Reorder level</th>
                <th className="px-4 py-2.5 text-right font-semibold">Average cost</th>
                <th className="px-4 py-2.5 text-right font-semibold">Stock Value</th>
                <th className="px-4 py-2.5 text-center font-semibold">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-paper">
                  <td className="px-4 py-3 font-semibold text-ink">{it.name}</td>
                  <td className="px-4 py-3">
                    {it.brand ? (
                      <span className="rounded bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                        {it.brand}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">{it.sku || '—'}</td>
                  <td className="px-4 py-3">
                    <Status
                      tone={it.state === 'ok' ? 'good' : it.state === 'low' ? 'warn' : 'bad'}
                    >
                      {it.state === 'ok' ? t('In stock') : it.state === 'low' ? t('Low stock') : it.state === 'below' ? `Below zero (${it.total})` : t('Out of stock')}
                    </Status>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-ink num">
                    {it.total} <span className="text-xs font-normal text-muted">{it.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted num">{it.reorderLevel}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted">{ksh(it.averageCost)}</td>
                  <td className="px-4 py-3 text-right font-bold text-ink num">{ksh(it.value)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setHistoryItem({ id: it.id, name: it.name })}
                      className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
                    >
                      <History className="h-3.5 w-3.5" /> Moves
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {historyItem && (
        <StockMovesSheet
          open={Boolean(historyItem)}
          onClose={() => setHistoryItem(null)}
          itemId={historyItem.id}
          itemName={historyItem.name}
        />
      )}

      {counting && (
        <StockCountModal
          open={counting}
          onClose={() => setCounting(false)}
          items={items}
          locations={locations}
          onSaved={() => reload()}
        />
      )}

      {transferring && (
        <StockTransferModal
          open={transferring}
          onClose={() => setTransferring(false)}
          items={items}
          locations={locations}
          onSaved={() => reload()}
        />
      )}
    </>
  );
}
