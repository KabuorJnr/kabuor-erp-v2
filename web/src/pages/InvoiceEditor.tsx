// Making a quote or invoice. The person decides: who, what, how much, and when it's due.
// Totals and VAT update as they type; prices are VAT-inclusive, the way Kenyan businesses quote.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { api, useApi, useSession } from '../lib/api';
import { cn, ksh, prettyPhone, toCents } from '../lib/format';
import { ErrorNote, Field, Loading, PageHeader } from '../components/ui';

type Item = { id: string; name: string; price: number; taxType: string; unit: string };
type Customer = { id: string; number: string; name: string; phone: string; owes?: number };
type Line = { key: number; itemId: string | null; description: string; quantity: string; price: string; taxType: string };

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
  const [kind, setKind] = useState(defaultKind);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [due, setDue] = useState(defaultKind === 'Quote' ? 14 : 7);
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<{ busy: '' | 'draft' | 'issue'; error: string }>({ busy: '', error: '' });
  const vat = session?.company.vatRegistered ?? true;

  // Editing a draft: fill the form from it.
  useEffect(() => {
    const d = existing.data?.document;
    if (!d) return;
    setKind(d.kind);
    setCustomer(d.customer);
    setLines(d.lines.map((l: any) => ({ key: nextKey++, itemId: l.itemId, description: l.description, quantity: String(l.quantity), price: String(l.unitPrice / 100), taxType: l.taxType })));
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
  const pickItem = (key: number, text: string) => {
    const it = items.data?.find((i) => i.name.toLowerCase() === text.trim().toLowerCase());
    set(key, it ? { itemId: it.id, description: it.name, price: String(it.price / 100), taxType: it.taxType } : { itemId: null, description: text });
  };

  const save = async (issue: boolean) => {
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
        lines: filled.map((l) => ({ itemId: l.itemId, description: l.description, quantity: Number(l.quantity) || 0, unitPrice: toCents(l.price), taxType: l.taxType })),
      };
      const doc = id ? await api(`/sales/${id}`, { method: 'PUT', body }) : await api('/sales', { body });
      if (issue) await api(`/sales/${doc.id}/issue`, { body: {} });
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
              <CustomerPicker value={customer} onChange={setCustomer} />
            </Field>
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
                    <input className="field col-span-2 md:col-span-1" list="items" value={l.description} onChange={(e) => pickItem(l.key, e.target.value)} placeholder="Type or pick an item" aria-label={`Line ${i + 1} item`} />
                    <input className="field num" inputMode="decimal" value={l.quantity} onChange={(e) => set(l.key, { quantity: e.target.value })} aria-label={`Line ${i + 1} quantity`} />
                    <input className="field num" inputMode="decimal" value={l.price} onChange={(e) => set(l.key, { price: e.target.value })} placeholder="0" aria-label={`Line ${i + 1} price including VAT`} />
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
            {state.error && <div className="mt-3"><ErrorNote>{state.error}</ErrorNote></div>}
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
