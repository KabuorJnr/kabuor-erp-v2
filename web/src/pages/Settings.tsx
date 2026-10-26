import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Plus } from 'lucide-react';
import { api, useApi } from '../lib/api';
import MoveIn from '../components/MoveIn';
import PlanSettings from '../components/Plan';
import Connections from '../components/Connections';
import { PromptSetup } from '../components/MpesaPrompt';
import { PriceLists, UnitsEditor, unitsBody, type UnitRow } from '../components/Trade';
import { useSearchParams } from 'react-router';
import { cn, ksh, toCents } from '../lib/format';
import { Chips, ErrorNote, Field, Loading, PageHeader, Sheet, Status } from '../components/ui';
import { ScanButton } from '../components/Scanner';
import Team from '../components/Team';
import ActivityLog from '../components/ActivityLog';

function Company() {
  const { data, error, reload } = useApi<any>('/settings/company');
  const [f, setF] = useState<any>(null);
  const [state, setState] = useState({ busy: false, error: '', saved: false });
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (data) setF({
      name: data.name,
      kraPin: data.kraPin,
      phone: data.phone,
      email: data.email,
      county: data.county,
      vatRegistered: data.vatRegistered,
      mpesaShortcode: data.mpesaShortcode,
      preventNegativeStock: data.preventNegativeStock ?? false,
      industry: data.industry ?? 'general',
      accountingLockDate: data.accountingLockDate ?? null,
    });
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
          <Field label="Industry / Sector" hint="Workflow rules & module defaults.">
            <select className="field" value={f.industry ?? 'general'} onChange={(e) => setF({ ...f, industry: e.target.value })}>
              <option value="general">General Business & Trading</option>
              <option value="distribution">Wholesale & Distribution</option>
              <option value="manufacturing">Manufacturing & Processing</option>
              <option value="transportation">Transport & Fleet Logistics</option>
              <option value="retail">Retail & Supermarket</option>
              <option value="services">Services & Consulting</option>
            </select>
          </Field>
          <Field label="Accounting Period Lock Date" hint="Blocks backdating invoices & bills.">
            <input type="date" className="field" value={f.accountingLockDate ?? ''} onChange={(e) => setF({ ...f, accountingLockDate: e.target.value || null })} />
          </Field>
        </div>
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
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" checked={f.preventNegativeStock} onChange={set('preventNegativeStock')} />
          <span>
            Don’t sell what isn’t in stock
            <span className="block text-xs text-muted">Invoices and the till refuse a sale that would take an item below zero. Leave off if goods often arrive before their supplier bill is entered.</span>
          </span>
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

const TAX: [string, string][] = [
  ['B_Standard16', 'VAT 16%'],
  ['E_Reduced8', 'VAT 8%'],
  ['C_ZeroRated', 'Zero-rated'],
  ['A_Exempt', 'Exempt'],
  ['D_NonVat', 'Non-VAT'],
];

function Items() {
  const { data, error, reload } = useApi<any[]>('/items?all=true');
  const units = useApi<any[]>('/items/units');
  const [edit, setEdit] = useState<any>(null);
  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const open = (item: any) => {
    setEdit(item);
    setUnitRows((units.data ?? []).filter((u) => u.itemId === item.id).map((u) => ({ name: u.name, factor: String(u.factor), price: u.price ? String(u.price / 100) : '' })));
  };
  const [state, setState] = useState({ busy: false, error: '' });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      const body = { ...edit, price: toCents(edit.priceText), reorderLevel: Number(edit.reorderText) || 0 };
      const saved = edit.id ? await api(`/items/${edit.id}`, { method: 'PUT', body }) : await api('/items', { body });
      // Stock already on the shelf when they start, at what it cost (so stock value and margins are right).
      const had = (units.data ?? []).some((u) => u.itemId === saved.id);
      if (edit.kind === 'Product' && (unitRows.length > 0 || had)) await api(`/items/${saved.id}/units`, { method: 'PUT', body: unitsBody(unitRows) });
      if (body.trackStock && Number(edit.openingQty) > 0) await api('/stock/opening', { body: { itemId: saved.id, quantity: Number(edit.openingQty), unitCost: toCents(edit.openingCost) } });
      setEdit(null);
      reload();
      units.reload();
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
        <button className="btn btn-primary" onClick={() => open({ name: '', sku: '', kind: 'Product', unit: 'pc', priceText: '', taxType: 'B_Standard16', active: true, trackStock: true, reorderText: '', openingQty: '', openingCost: '' })}>
          <Plus className="h-4 w-4" /> Add product or service
        </button>
      </div>
      {data.length ? (
        <ul className="card divide-y divide-line">
          {data.map((i) => (
            <li key={i.id}>
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper" onClick={() => open({ ...i, priceText: String(i.price / 100), reorderText: i.reorderLevel ? String(i.reorderLevel) : '', openingQty: '', openingCost: '' })}>
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
              <Field label="Barcode" hint="The number under the stripes on the pack. Scan it, or type it.">
                <div className="flex gap-2">
                  <input className="field num flex-1" inputMode="numeric" value={edit.barcode ?? ''} onChange={(e) => setEdit({ ...edit, barcode: e.target.value })} placeholder="6001087340052" />
                  <ScanButton onCode={(code) => setEdit({ ...edit, barcode: code })} title="Scan the barcode" />
                </div>
              </Field>
              <Field label="Unit">
                <input className="field" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="pc, kg, hour…" />
              </Field>
              <Field label="KRA item classification" hint={<>For eTIMS: the 8–10 digit code from KRA’s item classification list (e.g. 50192100 for sauces).{edit.etimsItemCode ? ` Registered as ${edit.etimsItemCode}.` : ''}</>}>
                <input className="field num" inputMode="numeric" value={edit.etimsClassCode ?? ''} onChange={(e) => setEdit({ ...edit, etimsClassCode: e.target.value.replace(/\D/g, '') })} placeholder="Leave blank to use the default" />
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
                  <label className="flex items-start gap-2.5 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" checked={Boolean(edit.trackBatches)} onChange={(e) => setEdit({ ...edit, trackBatches: e.target.checked })} />
                    <span>
                      <b className="block">Kept by batch, with expiry dates</b>
                      <span className="text-xs text-muted">For food, medicine, seed and agro-chemicals. Bills ask for the batch and expiry; sales take the batch that expires first and never sell expired stock.</span>
                    </span>
                  </label>
                )}
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
            {edit.kind === 'Product' && <UnitsEditor base={edit.unit || 'pc'} basePrice={toCents(edit.priceText)} rows={unitRows} onChange={setUnitRows} />}
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

/** The company's KRA eTIMS connection. The owner is deciding "are my invoices really reaching KRA?", so it leads with
 * that answer, then the three things KRA's OSCU needs (mode, the device serial KRA issued, a default classification). */
function EtimsSetup() {
  const { data, error, reload } = useApi<any>('/etims');
  const [f, setF] = useState<any>(null);
  const [state, setState] = useState({ busy: '', error: '', note: '' });
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  const form = f ?? { mode: data.mode, branchId: data.branchId ?? '00', deviceSerial: data.deviceSerial ?? '', defaultClassCode: data.defaultClassCode ?? '' };
  const run = async (what: string, fn: () => Promise<any>) => {
    setState({ busy: what, error: '', note: '' });
    try {
      const r = await fn();
      setState({ busy: '', error: '', note: what === 'retry' ? `${r.signed} of ${r.tried} signed.` : what === 'save' ? 'Saved.' : '' });
      setF(null);
      reload();
    } catch (e) {
      setState({ busy: '', error: (e as Error).message, note: '' });
    }
  };
  const live = data.mode !== 'Test' && data.connected;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <section className="card space-y-4 p-5">
        <div className={live ? 'rounded-md bg-good-soft p-3 text-sm text-good' : 'rounded-md bg-warn-soft p-3 text-sm text-warn'}>
          {live ? (
            <><b>Connected to KRA {data.mode === 'Live' ? 'eTIMS' : 'eTIMS sandbox'}</b> as {data.taxpayerName || 'your PIN'}{data.branchName ? `, ${data.branchName}` : ''}. Every invoice is signed by KRA as it’s issued.</>
          ) : (
            <><b>Test signatures only.</b> Invoices get clearly marked test codes. To sign with KRA, apply for an OSCU on the eTIMS portal; KRA gives you a device serial number to enter here.</>
          )}
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Mode</legend>
          <div className="grid grid-cols-3 gap-2">
            {[['Test', 'Test', 'No KRA connection'], ['Sandbox', 'KRA sandbox', 'For certification'], ['Live', 'Live', 'Real KRA signatures']].map(([id, label, sub]) => (
              <button key={id} type="button" onClick={() => setF({ ...form, mode: id })} className={`rounded-md p-3 text-left ring-1 ${form.mode === id ? 'bg-brand-soft ring-2 ring-brand' : 'bg-white ring-line'}`}>
                <b className="block text-sm">{label}</b>
                <span className="text-xs text-muted">{sub}</span>
              </button>
            ))}
          </div>
        </fieldset>
        {form.mode !== 'Test' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Device serial number" hint="From KRA’s approval of your OSCU application.">
              <input className="field font-mono" value={form.deviceSerial} onChange={(e) => setF({ ...form, deviceSerial: e.target.value })} />
            </Field>
            <Field label="Branch ID" hint="00 is the head office.">
              <input className="field font-mono" value={form.branchId} onChange={(e) => setF({ ...form, branchId: e.target.value })} />
            </Field>
          </div>
        )}
        <Field label="Default item classification" hint="Used for products without their own code and for lines typed into invoices (e.g. a service).">
          <input className="field num" inputMode="numeric" value={form.defaultClassCode} onChange={(e) => setF({ ...form, defaultClassCode: e.target.value.replace(/\D/g, '') })} />
        </Field>
        {state.error && <ErrorNote>{state.error}</ErrorNote>}
        {state.note && <p className="text-sm font-medium text-good">{state.note}</p>}
        <button className="btn btn-primary" disabled={Boolean(state.busy)} onClick={() => run('save', () => api('/etims', { method: 'PUT', body: form }))}>
          {state.busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />} {form.mode === 'Test' ? 'Save' : data.connected && form.deviceSerial === data.deviceSerial && form.mode === data.mode ? 'Save' : 'Connect to KRA'}
        </button>
      </section>
      <aside className="card h-fit space-y-3 p-5 text-sm">
        <p className="flex justify-between"><span className="text-muted">Invoices waiting to be signed</span><b className="num">{data.invoicesUnsigned}</b></p>
        {data.invoicesUnsigned > 0 && (
          <button className="btn btn-ghost w-full" disabled={Boolean(state.busy)} onClick={() => run('retry', () => api('/etims/retry', { body: {} }))}>
            {state.busy === 'retry' && <Loader2 className="h-4 w-4 animate-spin" />} Send them to KRA again
          </button>
        )}
        <p className="flex justify-between"><span className="text-muted">Products without a KRA classification</span><b className="num">{data.productsWithoutClass}</b></p>
        <p className="flex justify-between"><span className="text-muted">Supplier invoices to review</span><b className="num">{data.purchasesWaiting}</b></p>
        {data.lastError && <p className="text-xs text-bad">Last error: {data.lastError}</p>}
      </aside>
    </div>
  );
}

const SECTIONS: { title: string; tabs: [string, string, string][] }[] = [
  { title: 'Business', tabs: [['company', 'Business & M-Pesa', 'Name, KRA PIN, VAT, how customers pay'], ['etims', 'KRA eTIMS', 'Signing invoices with KRA'], ['items', 'Products & services', 'What you sell and its prices'], ['prices', 'Price lists', 'Wholesale and customer prices']] },
  { title: 'People & access', tabs: [['team', 'Team', 'Who signs in and what they can do'], ['activity', 'Activity', 'Every change, and who made it']] },
  { title: 'Data', tabs: [['move', 'Move in (import)', 'Bring lists from Excel, QuickBooks, Sage'], ['connections', 'Connections', 'Shop, webhooks and other apps']] },
  { title: 'Account', tabs: [['plan', 'Plan & billing', 'Your plan and paying by M-Pesa']] },
];

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const all = SECTIONS.flatMap((s) => s.tabs);
  const tab = all.some(([id]) => id === params.get('tab')) ? params.get('tab')! : 'company';
  const setTab = (t: string) => setParams({ tab: t }, { replace: true });
  const current = all.find(([id]) => id === tab)!;
  return (
    <>
      <PageHeader title="Settings" />
      <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-8">
        {/* On a computer: the sections down the side, grouped. On a phone: one row of chips. */}
        <nav className="hidden lg:block" aria-label="Settings">
          {SECTIONS.map((sec) => (
            <div key={sec.title} className="mb-4">
              <p className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-faint uppercase">{sec.title}</p>
              {sec.tabs.map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} className={cn('block w-full rounded-md px-3 py-2 text-left text-[15px] font-medium', tab === id ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-white')}>
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="mb-4 lg:hidden">
          <Chips label="Settings" value={tab} onChange={setTab} options={all.map(([id, label]) => [id, label] as [string, string])} />
        </div>
        <div className="min-w-0">
          <header className="mb-4 hidden lg:block">
            <h2 className="font-display text-xl font-bold">{current[1]}</h2>
            <p className="text-sm text-muted">{current[2]}</p>
          </header>
          {tab === 'company' && (
            <div className="space-y-5">
              <Company />
              <PromptSetup />
            </div>
          )}
          {tab === 'items' && <Items />}
          {tab === 'team' && <Team />}
          {tab === 'activity' && <ActivityLog />}
          {tab === 'etims' && <EtimsSetup />}
          {tab === 'move' && <MoveIn />}
          {tab === 'plan' && <PlanSettings />}
          {tab === 'connections' && <Connections />}
          {tab === 'prices' && <PriceLists />}
        </div>
      </div>
    </>
  );
}
