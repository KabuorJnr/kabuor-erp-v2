// Assets: the things the business owns and uses (chairs, tools, laptops, vehicles). The owner is deciding "where is
// everything, who has it, and is anything missing?", so the page leads with what is out of place (lost, under repair,
// not seen in 90 days), finds any item from its label in one scan, and prints labels for new things.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import QRCode from 'qrcode';
import { Loader2, Plus, Printer, ScanLine } from 'lucide-react';
import { api, can, useApi, useSession } from '../lib/api';
import { cn, dateTime, ksh, toCents } from '../lib/format';
import { Chips, Empty, ErrorNote, Field, Loading, PageHeader, SearchBox, Sheet, Status } from '../components/ui';
import { ScanButton } from '../components/Scanner';

type AssetStatus = 'InUse' | 'InStore' | 'UnderRepair' | 'Lost' | 'Disposed';
type Asset = {
  id: string; tag: string; name: string; category: string; categoryName: string; serialNumber: string; locationId: string | null; location: string;
  assignedTo: string; status: AssetStatus; condition: 'Good' | 'Fair' | 'Poor'; purchaseDate: string | null; cost: number; supplier: string; notes: string;
  lastSeenAt: string | null; lastSeenBy: string; createdAt: string;
};
type Register = {
  counts: { all: number; inUse: number; inStore: number; underRepair: number; lost: number; disposed: number; unseen: number };
  totalCost: number; categories: { code: string; name: string; count: number }[]; items: Asset[];
};
type Location = { id: string; name: string };

const STATUS: Record<AssetStatus, [string, 'good' | 'info' | 'warn' | 'bad' | 'plain']> = {
  InUse: ['In use', 'good'], InStore: ['In store', 'info'], UnderRepair: ['Under repair', 'warn'], Lost: ['Lost', 'bad'], Disposed: ['Disposed', 'plain'],
};
const CATEGORIES: [string, string][] = [['FUR', 'Furniture'], ['TLS', 'Tools'], ['ELC', 'Electronics'], ['VEH', 'Vehicles'], ['EQP', 'Machines'], ['OTH', 'Other']];
const ago = (iso: string | null) => {
  if (!iso) return 'never seen';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return days === 0 ? 'seen today' : days === 1 ? 'seen yesterday' : `seen ${days} days ago`;
};

/** Labels for an A4 sheet of 3 × 7 (63.5 × 38.1 mm, e.g. Avery L7160): QR of the asset's link, the tag, the name. */
async function printLabels(assets: Asset[], business: string) {
  const w = window.open('', '_blank');
  if (!w) return alert('Allow pop-ups for this site to print labels.');
  const cells = await Promise.all(assets.map(async (a) => {
    const qr = await QRCode.toDataURL(`${location.origin}/assets?tag=${encodeURIComponent(a.tag)}`, { margin: 0, width: 220, errorCorrectionLevel: 'M' });
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    return `<div class="l"><img src="${qr}" alt=""><div><b>${esc(a.tag)}</b><span>${esc(a.name)}</span><small>${esc(business)}</small></div></div>`;
  }));
  w.document.write(`<!doctype html><title>Asset labels</title><style>
    @page{size:A4;margin:15mm 7mm}body{margin:0;font-family:Arial,sans-serif}
    .s{display:grid;grid-template-columns:repeat(3,63.5mm);grid-auto-rows:38.1mm;column-gap:2.5mm}
    .l{display:flex;align-items:center;gap:3mm;padding:2.5mm 3mm;box-sizing:border-box;overflow:hidden;break-inside:avoid}
    .l img{width:27mm;height:27mm}.l div{display:flex;flex-direction:column;gap:1mm;min-width:0}
    .l b{font-size:11pt;letter-spacing:.3px}.l span{font-size:8.5pt;line-height:1.2}.l small{font-size:7pt;color:#555}
    </style><div class="s">${cells.join('')}</div>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

export default function Assets() {
  const session = useSession();
  const canEdit = can(session, 'stock');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'unseen' | AssetStatus>('all');
  const [category, setCategory] = useState('');
  const { data, error, reload } = useApi<Register>(`/assets?q=${encodeURIComponent(q)}&status=${status}&category=${category}`);
  const locations = useApi<Location[]>('/locations');
  const [open, setOpen] = useState<Asset | null>(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [scanError, setScanError] = useState('');

  // A scanned label (camera, hardware scanner, or a phone opening the label's link): find it and record the sighting.
  const scan = async (code: string) => {
    setScanError('');
    try {
      const r = await api<{ asset: Asset }>(`/assets/scan?code=${encodeURIComponent(code)}&seen=${canEdit}`);
      setOpen(r.asset);
      reload();
    } catch (e) {
      setScanError((e as Error).message);
    }
  };
  useEffect(() => {
    const tag = params.get('tag');
    if (tag) {
      scan(tag);
      setParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = data?.items ?? [];
  const pickedAssets = useMemo(() => shown.filter((a) => picked.has(a.id)), [shown, picked]);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  const c = data.counts;
  const business = session?.company?.name ?? '';

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle={<>{c.all} things the business owns · {ksh(data.totalCost)} at cost{c.unseen > 0 && <> · <span className="text-warn">{c.unseen} not seen in 90 days</span></>}</>}
        actions={canEdit && <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add assets</button>}
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchBox value={q} onChange={setQ} placeholder="Search tag, name, serial number or person" />
          </div>
          <ScanButton onCode={scan} title="Scan an asset label" />
        </div>
        {scanError && <ErrorNote>{scanError}</ErrorNote>}
        <Chips label="Status" value={status} onChange={setStatus} options={[
          ['all', 'All', c.all], ['InUse', 'In use', c.inUse], ['InStore', 'In store', c.inStore], ['UnderRepair', 'Under repair', c.underRepair],
          ['Lost', 'Lost', c.lost], ['unseen', 'Not seen 90 days', c.unseen], ['Disposed', 'Disposed', c.disposed],
        ]} />
        <Chips label="Category" value={category} onChange={setCategory} options={[['', 'All kinds'], ...data.categories.filter((k) => k.count > 0).map((k) => [k.code, k.name, k.count] as [string, string, number])]} />

        {pickedAssets.length > 0 && (
          <div className="flex items-center gap-3 rounded-md bg-brand-soft px-4 py-2.5 text-sm">
            <span className="flex-1"><b>{pickedAssets.length}</b> selected</span>
            <button className="btn btn-primary" onClick={() => printLabels(pickedAssets, business)}><Printer className="h-4 w-4" /> Print labels</button>
            <button className="btn btn-ghost" onClick={() => setPicked(new Set())}>Clear</button>
          </div>
        )}

        {shown.length === 0 ? (
          <Empty title={c.all === 0 ? 'No assets yet' : 'Nothing matches'} action={c.all === 0 && canEdit && <button className="btn btn-primary" onClick={() => setAdding(true)}>Add your first assets</button>}>
            {c.all === 0 ? 'Add the chairs, tools, laptops and vehicles the business owns. Each gets a tag and a QR label, so a count is a walk round with a phone.' : 'Try another search or filter.'}
          </Empty>
        ) : (
          <ul className="card divide-y divide-line">
            {shown.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <input type="checkbox" className="h-4 w-4 shrink-0" aria-label={`Select ${a.tag}`} checked={picked.has(a.id)} onChange={(e) => {
                  const next = new Set(picked);
                  if (e.target.checked) next.add(a.id); else next.delete(a.id);
                  setPicked(next);
                }} />
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpen(a)}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <code className="shrink-0 rounded bg-paper px-1.5 py-0.5 text-xs font-semibold ring-1 ring-line">{a.tag}</code>
                      <b className="truncate text-sm">{a.name}</b>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted">
                      {[a.location, a.assignedTo && `with ${a.assignedTo}`, a.serialNumber && `S/N ${a.serialNumber}`].filter(Boolean).join(' · ') || a.categoryName}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-right text-xs text-muted sm:block">{ago(a.lastSeenAt)}</span>
                  <Status tone={STATUS[a.status][1]}>{STATUS[a.status][0]}</Status>
                </button>
              </li>
            ))}
          </ul>
        )}
        {shown.length > 1 && pickedAssets.length === 0 && (
          <button className="btn btn-ghost" onClick={() => printLabels(shown, business)}><Printer className="h-4 w-4" /> Print labels for all {shown.length} shown</button>
        )}
      </div>

      {adding && <AddSheet locations={locations.data ?? []} business={business} onClose={() => setAdding(false)} onAdded={() => reload()} />}
      {open && <Detail key={open.id} asset={open} canEdit={canEdit} locations={locations.data ?? []} business={business} onClose={() => setOpen(null)} onChange={(a) => (setOpen(a), reload())} />}
    </div>
  );
}

function AddSheet({ locations, business, onClose, onAdded }: { locations: Location[]; business: string; onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState({ name: '', category: 'FUR', quantity: '1', serialNumber: '', locationId: '', assignedTo: '', condition: 'Good', purchaseDate: '', cost: '', supplier: '', notes: '' });
  const [state, setState] = useState<{ busy: boolean; error: string; added?: Asset[] }>({ busy: false, error: '' });
  const qty = Math.max(1, Math.min(200, Number(f.quantity) || 1));
  const save = async () => {
    setState({ busy: true, error: '' });
    try {
      const r = await api<{ items: Asset[] }>('/assets', { body: {
        name: f.name, category: f.category, quantity: qty, serialNumber: qty === 1 ? f.serialNumber : '', locationId: f.locationId || null,
        assignedTo: f.assignedTo, condition: f.condition, purchaseDate: f.purchaseDate || null, cost: f.cost ? toCents(f.cost) : 0, supplier: f.supplier, notes: f.notes,
      } });
      setState({ busy: false, error: '', added: r.items });
      onAdded();
    } catch (e) {
      setState({ busy: false, error: (e as Error).message });
    }
  };
  if (state.added)
    return (
      <Sheet open onClose={onClose} title="Added">
        <div className="space-y-4 text-sm">
          <p className="rounded-md bg-good-soft p-3 text-good"><b>{state.added.length}</b> added: {state.added[0].tag}{state.added.length > 1 && ` to ${state.added[state.added.length - 1].tag}`}.</p>
          <p className="text-muted">Print the labels and stick each on its item, so anyone can scan it.</p>
          <button className="btn btn-primary w-full py-3" onClick={() => printLabels(state.added!, business)}><Printer className="h-4 w-4" /> Print {state.added.length} label{state.added.length === 1 ? '' : 's'}</button>
          <button className="btn btn-ghost w-full" onClick={() => setState({ busy: false, error: '' })}>Add more</button>
        </div>
      </Sheet>
    );
  return (
    <Sheet open onClose={onClose} title="Add assets">
      <div className="space-y-4">
        <Field label="What is it?"><input className="field" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Office chair, Bosch drill, HP laptop…" /></Field>
        <Field label="Kind" hint="Part of the tag: AST-FUR-0001 for furniture, AST-TLS-0001 for tools.">
          <Chips label="Kind" value={f.category} onChange={(v) => setF({ ...f, category: v })} options={CATEGORIES} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="How many" hint="Each gets its own tag."><input className="field num" inputMode="numeric" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Serial number" hint={qty > 1 ? 'Add one at a time to record serials.' : 'From the maker’s sticker.'}>
            <input className="field" disabled={qty > 1} value={qty > 1 ? '' : f.serialNumber} onChange={(e) => setF({ ...f, serialNumber: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Where it is">
            <select className="field" value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}>
              <option value="">Not set</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Who has it" hint="Leave empty if it’s kept in a store."><input className="field" value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })} placeholder="e.g. Mercy Achieng" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost each (KSh)"><input className="field num" inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></Field>
          <Field label="Bought on"><input className="field" type="date" value={f.purchaseDate} onChange={(e) => setF({ ...f, purchaseDate: e.target.value })} /></Field>
        </div>
        <Field label="Bought from"><input className="field" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} /></Field>
        <Field label="Notes"><input className="field" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        {state.error && <ErrorNote>{state.error}</ErrorNote>}
        <button className="btn btn-primary w-full py-3" disabled={state.busy || f.name.trim().length < 2} onClick={save}>
          {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} {qty > 1 ? `Add ${qty} and make ${qty} tags` : 'Add and make its tag'}
        </button>
      </div>
    </Sheet>
  );
}

function Detail({ asset, canEdit, locations, business, onClose, onChange }: { asset: Asset; canEdit: boolean; locations: Location[]; business: string; onClose: () => void; onChange: (a: Asset) => void }) {
  const { data, reload } = useApi<{ asset: Asset; history: { kind: string; text: string; actor: string; at: string }[] }>(`/assets/${asset.id}`);
  const a = data?.asset ?? asset;
  const [move, setMove] = useState('');
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState({ busy: '', error: '' });
  const act = async (kind: string, extra: Record<string, unknown> = {}) => {
    setState({ busy: kind, error: '' });
    try {
      const r = await api<{ asset: Asset }>(`/assets/${a.id}/actions`, { body: { kind, note, ...extra } });
      setNote('');
      onChange(r.asset);
      reload();
      setState({ busy: '', error: '' });
    } catch (e) {
      setState({ busy: '', error: (e as Error).message });
    }
  };
  const facts: [string, string][] = [
    ['Kind', a.categoryName], ['Where', a.location || 'Not set'], ['Who has it', a.assignedTo || 'No one'], ['Condition', a.condition],
    ['Serial number', a.serialNumber || '—'], ['Cost', a.cost ? ksh(a.cost) : '—'], ['Bought', [a.purchaseDate, a.supplier].filter(Boolean).join(' from ') || '—'],
    ['Last seen', a.lastSeenAt ? `${dateTime(a.lastSeenAt)} by ${a.lastSeenBy}` : 'Never scanned'],
  ];
  return (
    <Sheet open onClose={onClose} title={`${a.tag} · ${a.name}`}>
      <div className="space-y-5 text-sm">
        <div className="flex items-center gap-2">
          <Status tone={STATUS[a.status][1]}>{STATUS[a.status][0]}</Status>
          <span className="text-muted">{ago(a.lastSeenAt)}</span>
          <span className="flex-1" />
          <button className="btn btn-ghost" onClick={() => printLabels([a], business)}><Printer className="h-4 w-4" /> Label</button>
        </div>
        <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5">
          {facts.map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd>{v}</dd></Fragment>)}
          {a.notes && <><dt className="text-muted">Notes</dt><dd>{a.notes}</dd></>}
        </dl>

        {canEdit && a.status !== 'Disposed' && (
          <div className="space-y-3 border-t border-line pt-4">
            <button className="btn btn-primary w-full" disabled={!!state.busy} onClick={() => act('seen')}>
              {state.busy === 'seen' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} I can see it here (mark seen)
            </button>
            <div className="flex gap-2">
              <select className="field flex-1" value={move} onChange={(e) => setMove(e.target.value)} aria-label="Move to">
                <option value="">Move to…</option>
                {locations.filter((l) => l.id !== a.locationId).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <button className="btn btn-ghost" disabled={!move || !!state.busy} onClick={() => act('move', { locationId: move }).then(() => setMove(''))}>Move</button>
            </div>
            <div className="flex gap-2">
              <input className="field flex-1" value={who} onChange={(e) => setWho(e.target.value)} placeholder={a.assignedTo ? `Now with ${a.assignedTo}` : 'Give to…'} aria-label="Give to" />
              <button className="btn btn-ghost" disabled={!who.trim() || !!state.busy} onClick={() => act('assign', { assignedTo: who }).then(() => setWho(''))}>Give</button>
              {a.assignedTo && <button className="btn btn-ghost" disabled={!!state.busy} onClick={() => act('assign', { assignedTo: '' })}>Returned</button>}
            </div>
            <Field label="Note (needed to mark lost or disposed)"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened" /></Field>
            <div className="flex flex-wrap gap-2">
              {(['InUse', 'InStore', 'UnderRepair', 'Lost', 'Disposed'] as AssetStatus[]).filter((s) => s !== a.status).map((s) => (
                <button key={s} className={cn('btn btn-ghost', (s === 'Lost' || s === 'Disposed') && 'text-bad')} disabled={!!state.busy} onClick={() => act('status', { status: s })}>Mark {STATUS[s][0].toLowerCase()}</button>
              ))}
              {(['Good', 'Fair', 'Poor'] as const).filter((x) => x !== a.condition).map((x) => (
                <button key={x} className="btn btn-ghost" disabled={!!state.busy} onClick={() => act('condition', { condition: x })}>Condition: {x.toLowerCase()}</button>
              ))}
            </div>
            {state.error && <ErrorNote>{state.error}</ErrorNote>}
          </div>
        )}

        <div className="border-t border-line pt-4">
          <p className="mb-2 font-semibold">History</p>
          {data ? (
            <ul className="space-y-1.5">
              {data.history.map((h, i) => <li key={i} className="flex gap-3"><span className="w-36 shrink-0 text-muted">{dateTime(h.at)}</span><span>{h.text} <span className="text-faint">· {h.actor}</span></span></li>)}
            </ul>
          ) : <Loader2 className="h-4 w-4 animate-spin text-faint" />}
        </div>
      </div>
    </Sheet>
  );
}
