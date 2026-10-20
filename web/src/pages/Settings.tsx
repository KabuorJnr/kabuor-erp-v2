import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Plus } from 'lucide-react';
import { api, useApi } from '../lib/api';
import { ksh, toCents } from '../lib/format';
import { Chips, ErrorNote, Field, Loading, PageHeader, Sheet, Status } from '../components/ui';

const ROLES: [string, string][] = [
  ['Owner', 'Everything, including people and settings'],
  ['Accountant', 'Finance, payments, matching, ledger and reports'],
  ['Procurement', 'Suppliers, purchase orders, vendor bills and receiving'],
  ['Sales', 'Point of sale (POS), customers, quotes, invoices and recording payments'],
  ['Storekeeper', 'Items, stock levels, warehouse transfers and counts'],
  ['HR', 'Employees, leave and payroll (approval stays with the owner or accountant)'],
  ['Viewer', 'Can look, can’t change anything (never sees salaries)'],
];

function Company() {
  const { data, error, reload } = useApi<any>('/settings/company');
  const [f, setF] = useState<any>(null);
  const [state, setState] = useState({ busy: false, error: '', saved: false });
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (data) setF({ name: data.name, kraPin: data.kraPin, phone: data.phone, email: data.email, county: data.county, vatRegistered: data.vatRegistered, mpesaShortcode: data.mpesaShortcode });
  }, [data]);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!f) return <Loading />;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '', saved: false });
    try {
      await api('/settings/company', { method: 'PUT', body: f });
      setState({ busy: false, error: '', saved: true });
      reload();
    } catch (err) {
      setState({ busy: false, error: (err as Error).message, saved: false });
    }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <form onSubmit={save} className="card space-y-4 p-4 sm:p-5">
        <Field label="Business name">
          <input className="field" value={f.name} onChange={set('name')} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="KRA PIN" hint="Printed on invoices and used to sign them with eTIMS.">
            <input className="field uppercase" value={f.kraPin} onChange={set('kraPin')} maxLength={11} placeholder="P051234567X" />
          </Field>
          <Field label="County">
            <input className="field" value={f.county} onChange={set('county')} placeholder="e.g. Nairobi" />
          </Field>
          <Field label="Phone">
            <input className="field" value={f.phone} onChange={set('phone')} inputMode="tel" />
          </Field>
          <Field label="Email">
            <input className="field" type="email" value={f.email} onChange={set('email')} />
          </Field>
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={f.vatRegistered} onChange={set('vatRegistered')} />
          Registered for VAT (invoices charge VAT and are signed with KRA eTIMS)
        </label>
        <Field label="M-Pesa Paybill or Till (store number)" hint="Customers pay here; the payments arrive in Kabuor ERP by themselves.">
          <input className="field num" inputMode="numeric" value={f.mpesaShortcode} onChange={set('mpesaShortcode')} placeholder="e.g. 522522" />
        </Field>
        {state.error && <ErrorNote>{state.error}</ErrorNote>}
        <div className="flex items-center gap-3">
          <button className="btn btn-primary" disabled={state.busy}>
            {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
          {state.saved && <span className="text-sm font-semibold text-good">Saved</span>}
        </div>
      </form>
      <aside className="card h-fit space-y-3 p-4 sm:p-5 text-sm">
        <h2 className="font-semibold">Connect M-Pesa</h2>
        <p className="text-muted">Give this address to Safaricom as your C2B confirmation URL (on the Daraja portal, or ask Kabuor Builds to do it). Every payment to your Paybill/Till then lands in Money in and matches itself to invoices.</p>
        <div className="rounded-md bg-paper p-3 font-mono text-xs break-all ring-1 ring-line">{data.mpesaConfirmationUrl}</div>
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(data.mpesaConfirmationUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
        >
          {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy address'}
        </button>
        <p className="text-xs text-muted">Keep it private: it contains a secret key for your business.</p>
      </aside>
    </div>
  );
}

function Team() {
  const { data, error, reload } = useApi<any[]>('/settings/users');
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', email: '', phone: '', role: 'Sales', password: '' });
  const [state, setState] = useState({ busy: false, error: '' });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      await api('/settings/users', { body: f });
      setAdding(false);
      setF({ name: '', email: '', phone: '', role: 'Sales', password: '' });
      reload();
      setState({ busy: false, error: '' });
    } catch (err) {
      setState({ busy: false, error: (err as Error).message });
    }
  };
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add a person
        </button>
      </div>
      <ul className="card divide-y divide-line">
        {data.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <b className="block truncate">{u.name}</b>
              <span className="text-sm text-muted">{u.email}</span>
            </span>
            <Status tone={u.role === 'Owner' ? 'info' : 'plain'}>{u.role}</Status>
          </li>
        ))}
      </ul>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a person">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <input className="field" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Email (they sign in with it)">
            <input className="field" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="field" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">What they can do</legend>
            <div className="space-y-1.5">
              {ROLES.filter(([r]) => r !== 'Owner').map(([r, desc]) => (
                <label key={r} className="flex cursor-pointer items-start gap-2.5 rounded-md bg-white p-3 ring-1 ring-line has-[:checked]:ring-2 has-[:checked]:ring-brand">
                  <input type="radio" name="role" className="mt-1 accent-[var(--color-brand)]" checked={f.role === r} onChange={() => setF({ ...f, role: r })} />
                  <span>
                    <b className="block text-sm">{r}</b>
                    <span className="text-xs text-muted">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Starting password" hint="At least 10 characters. Share it with them privately.">
            <input className="field" type="text" required minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
          </Field>
          {state.error && <ErrorNote>{state.error}</ErrorNote>}
          <button className="btn btn-primary w-full py-3" disabled={state.busy}>
            {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Add {f.name.split(' ')[0] || 'person'}
          </button>
        </form>
      </Sheet>
    </>
  );
}

const TAX: [string, string][] = [
  ['B_Standard16', 'VAT 16%'],
  ['E_Reduced8', 'VAT 8%'],
  ['C_ZeroRated', 'Zero-rated'],
  ['A_Exempt', 'Exempt'],
  ['D_NonVat', 'Non-VAT'],
];

function Items() {
  const { data, error, reload } = useApi<any[]>('/items?all=true');
  const [edit, setEdit] = useState<any>(null);
  const [state, setState] = useState({ busy: false, error: '' });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      const body = { ...edit, price: toCents(edit.priceText), reorderLevel: Number(edit.reorderText) || 0 };
      const saved = edit.id ? await api(`/items/${edit.id}`, { method: 'PUT', body }) : await api('/items', { body });
      // Stock already on the shelf when they start, at what it cost (so stock value and margins are right).
      if (body.trackStock && Number(edit.openingQty) > 0) await api('/stock/opening', { body: { itemId: saved.id, quantity: Number(edit.openingQty), unitCost: toCents(edit.openingCost) } });
      setEdit(null);
      reload();
      setState({ busy: false, error: '' });
    } catch (err) {
      setState({ busy: false, error: (err as Error).message });
    }
  };
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button className="btn btn-primary" onClick={() => setEdit({ name: '', sku: '', kind: 'Product', unit: 'pc', priceText: '', taxType: 'B_Standard16', active: true, trackStock: true, reorderText: '', openingQty: '', openingCost: '' })}>
          <Plus className="h-4 w-4" /> Add product or service
        </button>
      </div>
      {data.length ? (
        <ul className="card divide-y divide-line">
          {data.map((i) => (
            <li key={i.id}>
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper" onClick={() => setEdit({ ...i, priceText: String(i.price / 100), reorderText: i.reorderLevel ? String(i.reorderLevel) : '', openingQty: '', openingCost: '' })}>
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{i.name}</b>
                  <span className="text-sm text-muted">
                    {i.kind === 'Service' ? 'Service' : 'Product'}
                    {i.sku && ` · ${i.sku}`} · {TAX.find((t) => t[0] === i.taxType)?.[1]}
                  </span>
                </span>
                <span className="num font-semibold">{ksh(i.price)}</span>
                {!i.active && <Status tone="plain">Hidden</Status>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card p-5 text-sm text-muted">Save the things you sell with their prices, and invoices fill themselves in.</p>
      )}
      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Edit item' : 'Add product or service'}>
        {edit && (
          <form onSubmit={save} className="space-y-4">
            <Chips label="Kind" value={edit.kind} onChange={(v) => setEdit({ ...edit, kind: v })} options={[['Product', 'Product'], ['Service', 'Service']]} />
            <Field label="Name">
              <input className="field" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price incl. VAT (KSh)">
                <input className="field num" inputMode="decimal" required value={edit.priceText} onChange={(e) => setEdit({ ...edit, priceText: e.target.value })} />
              </Field>
              <Field label="Tax">
                <select className="field" value={edit.taxType} onChange={(e) => setEdit({ ...edit, taxType: e.target.value })}>
                  {TAX.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Code / SKU">
                <input className="field" value={edit.sku} onChange={(e) => setEdit({ ...edit, sku: e.target.value })} />
              </Field>
              <Field label="Unit">
                <input className="field" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="pc, kg, hour…" />
              </Field>
            </div>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              Show when making invoices
            </label>
            {edit.kind === 'Product' && (
              <div className="space-y-3 rounded-lg bg-white p-3 ring-1 ring-line">
                <label className="flex items-start gap-2.5 text-sm">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" checked={Boolean(edit.trackStock)} onChange={(e) => setEdit({ ...edit, trackStock: e.target.checked })} />
                  <span>
                    <b className="block">Count in stock</b>
                    <span className="text-xs text-muted">Buying adds to it, selling and production take from it, and its cost goes to cost of sales.</span>
                  </span>
                </label>
                {edit.trackStock && (
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Warn below" hint="Reorder level">
                      <input className="field num" inputMode="decimal" value={edit.reorderText} onChange={(e) => setEdit({ ...edit, reorderText: e.target.value })} />
                    </Field>
                    <Field label="Have now" hint="Opening stock">
                      <input className="field num" inputMode="decimal" value={edit.openingQty} onChange={(e) => setEdit({ ...edit, openingQty: e.target.value })} placeholder="0" />
                    </Field>
                    <Field label="Cost each (KSh)" hint="Before VAT">
                      <input className="field num" inputMode="decimal" value={edit.openingCost} onChange={(e) => setEdit({ ...edit, openingCost: e.target.value })} />
                    </Field>
                  </div>
                )}
              </div>
            )}
            {state.error && <ErrorNote>{state.error}</ErrorNote>}
            <button className="btn btn-primary w-full py-3" disabled={state.busy}>
              {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </form>
        )}
      </Sheet>
    </>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('company');
  return (
    <>
      <PageHeader title="Settings" />
      <div className="mb-4">
        <Chips label="Settings" value={tab} onChange={setTab} options={[['company', 'Business & M-Pesa'], ['items', 'Products & services'], ['team', 'Team']]} />
      </div>
      {tab === 'company' && <Company />}
      {tab === 'items' && <Items />}
      {tab === 'team' && <Team />}
    </>
  );
}
