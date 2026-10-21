// Making a quote or invoice. The person decides: who, what, how much, and when it's due.
// Totals and VAT update as they type; prices are VAT-inclusive, the way Kenyan businesses quote.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { api, can, useApi, useSession } from '../lib/api';
import { cn, ksh, prettyPhone, toCents } from '../lib/format';
import { ErrorNote, Field, Loading, PageHeader } from '../components/ui';

type Item = { id: string; name: string; price: number; taxType: string; unit: string };
type Customer = { id: string; number: string; name: string; phone: string; owes?: number; priceListId?: string | null; creditLimit?: number };
type Unit = { itemId: string; name: string; factor: number; price: number };
// `auto`: the price came from the product (shelf, price list or unit), so it follows a change of customer or unit.
type Line = { key: number; itemId: string | null; description: string; quantity: string; price: string; taxType: string; unit?: string; auto?: boolean };

const TAX: [string, string, number][] = [
  ['B_Standard16', 'VAT 16%', 1600],
  ['E_Reduced8', 'VAT 8%', 800],
  ['C_ZeroRated', 'Zero-rated', 0],
  ['A_Exempt', 'Exempt', 0],
  ['D_NonVat', 'Non-VAT', 0],
];
const bps = (t: string) => TAX.find((x) => x[0] === t)?.[2] ?? 0;
let nextKey = 1;
const blank = (): Line => ({ key: nextKey++, itemId: null, description: '', quantity: '1', price: '', taxType: 'B_Standard16' });

function CustomerPicker({ value, onChange }: { value: Customer | null; onChange: (c: Customer | null) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const { data } = useApi<{ page: { items: Customer[] } }>(open ? `/customers?q=${encodeURIComponent(q)}&take=8` : null);

  if (value)
    return (
      <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2.5 ring-1 ring-line">
        <span className="min-w-0">
          <b className="block truncate">{value.name}</b>
          <span className="text-xs text-muted">
            {value.number}
            {value.phone && ` · ${prettyPhone(value.phone)}`}
            {value.owes ? <span className="text-warn"> · already owes {ksh(value.owes)}</span> : null}
          </span>
        </span>
        <button type="button" className="text-sm font-semibold text-brand" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );

  const add = async () => {
    setError('');
    try {
      onChange(await api<Customer>('/customers', { body: { name: q, phone } }));
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="relative">
      <input className="field" value={q} placeholder="Search customer name, phone or number" onFocus={() => setOpen(true)} onChange={(e) => (setQ(e.target.value), setOpen(true))} aria-label="Customer" />
      {open && !adding && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-line">
          {(data?.page.items ?? []).map((c) => (
            <button key={c.id} type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-paper" onClick={() => (onChange(c), setOpen(false))}>
              <span className="min-w-0">
                <b className="block truncate text-sm">{c.name}</b>
                <span className="text-xs text-muted">
                  {c.number}
                  {c.phone && ` · ${prettyPhone(c.phone)}`}
                </span>
              </span>
              {c.owes ? <span className="num text-xs text-warn">owes {ksh(c.owes)}</span> : null}
            </button>
          ))}
          <button type="button" className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-sm font-semibold text-brand hover:bg-paper" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" /> {q.trim() ? `Add “${q.trim()}” as a new customer` : 'Add a new customer'}
          </button>
        </div>
      )}
      {adding && (
        <div className="mt-2 space-y-2 rounded-md bg-brand-soft/50 p-3 ring-1 ring-brand/20">
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer name" aria-label="New customer name" />
          <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (for M-Pesa matching and WhatsApp)" inputMode="tel" aria-label="New customer phone" />
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary py-2" onClick={add}>
              Add customer
            </button>
            <button type="button" className="btn btn-ghost py-2" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvoiceEditor({ kind: defaultKind }: { kind: 'Invoice' | 'Quote' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const existing = useApi<{ document: any }>(id ? `/sales/${id}` : null);
  const items = useApi<Item[]>('/items');
  const units = useApi<Unit[]>('/items/units');
  const lists = useApi<{ id: string; name: string; prices: { itemId: string; price: number }[] }[]>('/price-lists');
  const [kind, setKind] = useState(defaultKind);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [due, setDue] = useState(defaultKind === 'Quote' ? 14 : 7);
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<{ busy: '' | 'draft' | 'issue'; error: string }>({ busy: '', error: '' });
  const [savedId, setSavedId] = useState<string | null>(null);
  const vat = session?.company.vatRegistered ?? true;

  // Editing a draft: fill the form from it.
  useEffect(() => {
    const d = existing.data?.document;
    if (!d) return;
    setKind(d.kind);
    setCustomer(d.customer);
    setLines(d.lines.map((l: any) => ({ key: nextKey++, itemId: l.itemId, description: l.description, quantity: String(l.quantity), price: String(l.unitPrice / 100), taxType: l.taxType, unit: l.unit || undefined })));
    setDue(Math.round((Date.parse(d.dueDate) - Date.parse(d.issueDate)) / 864e5));
    setNotes(d.notes);
  }, [existing.data]);

  const totals = useMemo(() => {
    let total = 0;
    let tax = 0;
    for (const l of lines) {
      const t = Math.round((Number(l.quantity) || 0) * toCents(l.price));
      const b = vat ? bps(l.taxType) : 0;
      total += t;
      tax += b ? Math.round((t * b) / (10000 + b)) : 0;
    }
    return { total, tax, net: total - tax };
  }, [lines, vat]);

  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const list = lists.data?.find((x) => x.id === customer?.priceListId);
  // The same rule as the server: price list, else the unit's own price, else shelf price; a unit multiplies the base.
  const priceOf = (itemId: string, unit: string | undefined, onList = list) => {
    const it = items.data?.find((i) => i.id === itemId);
    if (!it) return 0;
    const listed = onList?.prices.find((p) => p.itemId === itemId)?.price;
    const u = unit ? units.data?.find((x) => x.itemId === itemId && x.name === unit) : undefined;
    if (!u) return listed ?? it.price;
    return listed != null ? Math.round(listed * u.factor) : u.price > 0 ? u.price : Math.round(it.price * u.factor);
  };
  const pickItem = (key: number, text: string) => {
    const it = items.data?.find((i) => i.name.toLowerCase() === text.trim().toLowerCase());
    set(key, it ? { itemId: it.id, description: it.name, price: String(priceOf(it.id, undefined) / 100), taxType: it.taxType, unit: undefined, auto: true } : { itemId: null, description: text, unit: undefined });
  };
  const pickCustomer = (c: Customer | null) => {
    setCustomer(c);
    const next = lists.data?.find((x) => x.id === c?.priceListId);
    setLines((ls) => ls.map((l) => (l.itemId && l.auto ? { ...l, price: String(priceOf(l.itemId, l.unit, next) / 100) } : l)));
  };
  const over = customer?.creditLimit && customer.owes != null && kind === 'Invoice' ? customer.owes + totals.total - customer.creditLimit : 0;

  const save = async (issue: boolean, allowOver = false) => {
    if (!customer) return setState({ busy: '', error: 'Choose a customer first.' });
    const filled = lines.filter((l) => l.description.trim() || l.price);
    if (!filled.length) return setState({ busy: '', error: 'Add at least one line.' });
    setState({ busy: issue ? 'issue' : 'draft', error: '' });
    try {
      const body = {
        kind,
        customerId: customer.id,
        dueInDays: due,
        notes,
        lines: filled.map((l) => ({ itemId: l.itemId, description: l.description, quantity: Number(l.quantity) || 0, unitPrice: toCents(l.price), taxType: l.taxType, unit: l.unit })),
      };
      // A draft saved by an earlier try (e.g. stopped by the credit limit) is updated, not duplicated.
      const target = id ?? savedId;
      const doc = target ? await api(`/sales/${target}`, { method: 'PUT', body }) : await api('/sales', { body });
      setSavedId(doc.id);
      if (issue) await api(`/sales/${doc.id}/issue${allowOver ? '?overLimit=true' : ''}`, { body: {} });
      navigate(`/sales/${doc.id}`, { replace: true });
    } catch (e) {
      setState({ busy: '', error: (e as Error).message });
    }
  };

  if (id && !existing.data) return existing.error ? <ErrorNote>{existing.error}</ErrorNote> : <Loading />;
  const invoice = kind === 'Invoice';

  return (
    <>
      <PageHeader title={id ? `Edit ${existing.data?.document.number}` : invoice ? 'New invoice' : 'New quote'} subtitle={invoice ? 'Prices include VAT. Issuing posts it to your books and signs it with KRA eTIMS.' : 'Prices include VAT. When the customer agrees, turn it into an invoice.'} />
      <datalist id="items">
        {(items.data ?? []).map((i) => (
          <option key={i.id} value={i.name}>
            {ksh(i.price)}
          </option>
        ))}
      </datalist>
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <section className="card space-y-4 p-4 sm:p-5">
            <Field label="Customer">
              <CustomerPicker value={customer} onChange={pickCustomer} />
            </Field>
            {customer && (list || customer.creditLimit) ? (
              <p className="text-xs text-muted">
                {list && <>Prices from <b>{list.name}</b>. </>}
                {customer.creditLimit ? <>Credit limit {ksh(customer.creditLimit)}{customer.owes != null && <>, owes {ksh(customer.owes)}</>}.</> : null}
              </p>
            ) : null}
            <div>
              <p className="mb-1.5 text-sm font-semibold">{invoice ? 'Payment due' : 'Valid for'}</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={invoice ? 'Payment due' : 'Valid for'}>
                {(invoice ? [[0, 'On receipt'], [7, '7 days'], [14, '14 days'], [30, '30 days']] : [[7, '7 days'], [14, '14 days'], [30, '30 days']]).map(([d, label]) => (
                  <button key={d} type="button" role="radio" aria-checked={due === d} onClick={() => setDue(d as number)} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1', due === d ? 'bg-ink text-white ring-ink' : 'bg-white ring-line')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card p-4 sm:p-5">
            <h2 className="text-sm font-semibold">What you’re charging for</h2>
            <div className="mt-3 hidden grid-cols-[1fr_5rem_8rem_8rem_7rem_2rem] gap-2 text-xs font-semibold text-muted md:grid">
              <span>Item or description</span>
              <span>Qty</span>
              <span>Price (KSh)</span>
              <span>Tax</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            <ul className="mt-2 space-y-3 md:space-y-2">
              {lines.map((l, i) => {
                const amount = Math.round((Number(l.quantity) || 0) * toCents(l.price));
                return (
                  <li key={l.key} className="grid grid-cols-2 gap-2 rounded-md bg-paper p-3 md:grid-cols-[1fr_5rem_8rem_8rem_7rem_2rem] md:items-center md:bg-transparent md:p-0">
                    <div className="col-span-2 flex gap-2 md:col-span-1">
                      <input className="field min-w-0 flex-1" list="items" value={l.description} onChange={(e) => pickItem(l.key, e.target.value)} placeholder="Type or pick an item" aria-label={`Line ${i + 1} item`} />
                      {l.itemId && units.data?.some((u) => u.itemId === l.itemId) && (
                        <select className="field w-28 shrink-0" value={l.unit ?? ''} aria-label={`Line ${i + 1} unit`} onChange={(e) => { const unit = e.target.value || undefined; set(l.key, { unit, price: String(priceOf(l.itemId!, unit) / 100), auto: true }); }}>
                          <option value="">{items.data?.find((x) => x.id === l.itemId)?.unit ?? 'each'}</option>
                          {units.data.filter((u) => u.itemId === l.itemId).map((u) => <option key={u.name} value={u.name}>{u.name} ({u.factor})</option>)}
                        </select>
                      )}
                    </div>
                    <input className="field num" inputMode="decimal" value={l.quantity} onChange={(e) => set(l.key, { quantity: e.target.value })} aria-label={`Line ${i + 1} quantity`} />
                    <input className="field num" inputMode="decimal" value={l.price} onChange={(e) => set(l.key, { price: e.target.value, auto: false })} placeholder="0" aria-label={`Line ${i + 1} price including VAT`} />
                    <select className="field" value={l.taxType} onChange={(e) => set(l.key, { taxType: e.target.value })} aria-label={`Line ${i + 1} tax`} disabled={!vat}>
                      {TAX.map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <span className="num self-center text-right font-semibold">{ksh(amount)}</span>
                    <button type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blank()]))} className="grid h-9 w-9 place-items-center justify-self-end rounded-full text-muted hover:bg-bad-soft hover:text-bad" aria-label={`Remove line ${i + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={() => setLines((ls) => [...ls, blank()])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
              <Plus className="h-4 w-4" /> Add a line
            </button>
          </section>

          <section className="card p-4 sm:p-5">
            <Field label="Note to the customer" hint="Shown on the invoice. E.g. delivery details or bank details.">
              <textarea className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </section>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-8">
          <div className="card p-4 sm:p-5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Before VAT</dt>
                <dd className="num">{ksh(totals.net)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">VAT</dt>
                <dd className="num">{ksh(totals.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="num font-display text-xl font-bold">{ksh(totals.total)}</dd>
              </div>
            </dl>
            {over > 0 && <p className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">This takes {customer!.name} {ksh(over)} over their {ksh(customer!.creditLimit!)} credit limit. {can(session, 'finance') ? 'You can still issue it.' : 'The owner or accountant has to allow it, or take a payment first.'}</p>}
            {state.error && <div className="mt-3"><ErrorNote>{state.error}</ErrorNote></div>}
            {state.error.includes('limit') && can(session, 'finance') && (
              <button className="btn btn-ghost mt-2 w-full" disabled={Boolean(state.busy)} onClick={() => save(true, true)}>Issue anyway, over the limit</button>
            )}
            <div className="mt-4 space-y-2">
              <button className="btn btn-primary w-full py-3" disabled={Boolean(state.busy)} onClick={() => save(true)}>
                {state.busy === 'issue' && <Loader2 className="h-4 w-4 animate-spin" />} {invoice ? 'Save & issue invoice' : 'Save & send quote'}
              </button>
              <button className="btn btn-ghost w-full" disabled={Boolean(state.busy)} onClick={() => save(false)}>
                {state.busy === 'draft' && <Loader2 className="h-4 w-4 animate-spin" />} Save as draft
              </button>
            </div>
            {invoice && <p className="mt-3 text-xs text-muted">Once issued, an invoice can’t be edited (KRA keeps the original). You can void it and make a new one.</p>}
          </div>
        </aside>
      </div>
    </>
  );
}
