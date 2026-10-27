// The business's shop and customer portal on the internet (/s/:slug). A customer is deciding one of three things:
// "can they supply what I need?" (browse and ask), "what do I owe, and can I pay now?" (sign in, pay by M-Pesa),
// and "can I order again without calling?" (pick products, send). So the page leads with the products and an
// Ask button, and signing in needs only a phone number and a code: no password to forget.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Check, Loader2, LogOut, MessageCircle, Minus, Plus, Search, ShoppingBag, Smartphone, User } from 'lucide-react';
import { cn, day, ksh, prettyPhone } from '../lib/format';

type Item = { id: string; name: string; unit: string; price: number; kind: string; available: boolean; units: { name: string; factor: number }[] };
const TOKEN = (slug: string) => `kerp-portal-${slug}`;

function usePublic(slug: string) {
  const [token, setTokenState] = useState<string | null>(() => { try { return localStorage.getItem(TOKEN(slug)); } catch { return null; } });
  const setToken = (t: string | null) => { try { t ? localStorage.setItem(TOKEN(slug), t) : localStorage.removeItem(TOKEN(slug)); } catch {} setTokenState(t); };
  const call = async <T,>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> => {
    const res = await fetch(`/api/public/${slug}${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: { ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { 'X-Portal-Token': token } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) setToken(null);
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Try again.');
    return data as T;
  };
  return { token, setToken, call };
}

export default function Shop() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const ref = params.get('ref') ?? (document.cookie.match(/(?:^|; )kref=([^;]+)/)?.[1] ?? null);
  const { token, setToken, call } = usePublic(slug);
  const [shop, setShop] = useState<any>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<'shop' | 'account' | 'signin'>(params.get('ask') ? 'shop' : 'shop');
  const [asking, setAsking] = useState<Item | 'general' | null>(params.get('ask') ? 'general' : null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');

  const load = () => call<any>('').then(setShop).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (shop?.business?.name) document.title = shop.business.name; }, [shop]);
  useEffect(() => {
    const item = params.get('item');
    if (item && shop) { const it = shop.items.find((i: Item) => i.id === item); if (it) setAsking(it); }
  }, [shop]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => (shop?.items ?? []).filter((i: Item) => !q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase())), [shop, q]);
  const cartLines = Object.entries(cart).filter(([, n]) => n > 0);
  const cartTotal = cartLines.reduce((s, [id, n]) => s + n * (shop?.items.find((i: Item) => i.id === id)?.price ?? 0), 0);

  if (error) return <div className="mx-auto max-w-md p-8 text-center"><p className="font-semibold">{error}</p></div>;
  if (!shop) return <div className="grid min-h-svh place-items-center"><Loader2 className="h-6 w-6 animate-spin text-faint" /></div>;
  const b = shop.business;

  return (
    <div className="min-h-svh bg-paper">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button onClick={() => setView('shop')} className="min-w-0 flex-1 text-left">
            <b className="block truncate font-display text-lg">{b.name}</b>
            <span className="text-xs text-muted">{[b.county, b.phone && prettyPhone(b.phone)].filter(Boolean).join(' · ')}</span>
          </button>
          <button className="btn btn-ghost" onClick={() => setAsking('general')}><MessageCircle className="h-4 w-4" /> <span className="hidden sm:inline">Ask</span></button>
          {token ? (
            <button className="btn btn-primary" onClick={() => setView('account')}><User className="h-4 w-4" /> <span className="hidden sm:inline">My account</span></button>
          ) : (
            <button className="btn btn-primary" onClick={() => setView('signin')}><User className="h-4 w-4" /> Sign in</button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {view === 'signin' && <SignIn call={call} ref_={ref} onDone={(t) => (setToken(t), setView('account'))} />}
        {view === 'account' && token && <Account call={call} paybill={b.paybill} onSignOut={() => (setToken(null), setView('shop'))} />}
        {view === 'shop' && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h1 className="flex-1 text-xl font-bold">Products</h1>
              <label className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-faint" />
                <input className="field pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" />
              </label>
            </div>
            {shop.signedIn && <p className="mb-3 text-sm text-muted">Prices shown are your prices, {shop.customer.name}.</p>}
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((i: Item) => (
                <li key={i.id} className="card flex flex-col gap-2 p-4">
                  <b className="leading-snug">{i.name}</b>
                  <p className="text-sm"><b className="num text-base">{ksh(i.price)}</b> <span className="text-muted">/ {i.unit}</span>{i.units.length > 0 && <span className="block text-xs text-muted">Also by the {i.units.map((u) => `${u.name.toLowerCase()} of ${u.factor}`).join(', ')}</span>}</p>
                  <p className={cn('text-xs font-semibold', i.available ? 'text-good' : 'text-warn')}>{i.available ? 'Available' : 'Ask about availability'}</p>
                  <div className="mt-auto flex items-center gap-2">
                    {shop.signedIn ? (
                      cart[i.id] ? (
                        <span className="flex items-center gap-2">
                          <button className="btn btn-ghost px-2" aria-label="Less" onClick={() => setCart({ ...cart, [i.id]: Math.max(0, (cart[i.id] ?? 0) - 1) })}><Minus className="h-4 w-4" /></button>
                          <input className="field num w-16 text-center" inputMode="numeric" value={cart[i.id]} onChange={(e) => setCart({ ...cart, [i.id]: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label={`${i.name} quantity`} />
                          <button className="btn btn-ghost px-2" aria-label="More" onClick={() => setCart({ ...cart, [i.id]: (cart[i.id] ?? 0) + 1 })}><Plus className="h-4 w-4" /></button>
                        </span>
                      ) : <button className="btn btn-primary" onClick={() => setCart({ ...cart, [i.id]: 1 })}><ShoppingBag className="h-4 w-4" /> Add</button>
                    ) : null}
                    <button className="btn btn-ghost" onClick={() => setAsking(i)}>Ask</button>
                  </div>
                </li>
              ))}
            </ul>
            {!shop.signedIn && <p className="mt-5 text-center text-sm text-muted">Already buy from {b.name}? <button className="font-semibold text-brand underline" onClick={() => setView('signin')}>Sign in</button> to see your prices, what you owe, and to order online.</p>}
          </>
        )}
      </main>

      {view === 'shop' && cartLines.length > 0 && <Basket call={call} cart={cart} items={shop.items} total={cartTotal} onDone={() => (setCart({}), setView('account'))} />}
      {asking && <Ask call={call} item={asking === 'general' ? null : asking} ref_={ref} signedIn={shop.signedIn} onClose={() => setAsking(null)} />}
    </div>
  );
}

function Panel({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 grid items-end bg-ink/40 sm:place-items-center" onClick={onClose}>
      <div className="max-h-[90svh] w-full overflow-y-auto rounded-t-xl bg-white p-5 sm:max-w-md sm:rounded-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><button className="text-sm text-muted" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}

function Ask({ call, item, ref_, signedIn, onClose }: { call: any; item: Item | null; ref_: string | null; signedIn: boolean; onClose: () => void }) {
  const [f, setF] = useState({ name: '', phone: '', message: item ? `I'd like to know about ${item.name}: ` : '' });
  const [state, setState] = useState({ busy: false, error: '', done: false });
  const send = async () => {
    setState({ busy: true, error: '', done: false });
    try {
      await call('/inquiries', { body: { ...f, itemId: item?.id, ref: ref_ } });
      setState({ busy: false, error: '', done: true });
    } catch (e) {
      setState({ busy: false, error: (e as Error).message, done: false });
    }
  };
  return (
    <Panel title={item ? `Ask about ${item.name}` : 'Ask a question'} onClose={onClose}>
      {state.done ? (
        <div className="space-y-3 text-center"><Check className="mx-auto h-8 w-8 text-good" /><p className="font-semibold">Sent. They’ll get back to you{signedIn ? ' here and' : ''} on your phone.</p><button className="btn btn-primary w-full" onClick={onClose}>Done</button></div>
      ) : (
        <div className="space-y-3">
          {!signedIn && (
            <>
              <input className="field" placeholder="Your name or business" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <input className="field" inputMode="tel" placeholder="Phone, e.g. 0712 345 678" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </>
          )}
          <textarea className="field min-h-28" placeholder="What would you like to know? Quantities, delivery, prices…" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
          {state.error && <p className="text-sm text-bad">{state.error}</p>}
          <button className="btn btn-primary w-full py-3" disabled={state.busy || f.message.trim().length < 3 || (!signedIn && f.phone.replace(/\D/g, '').length < 9)} onClick={send}>
            {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Send
          </button>
          <p className="text-xs text-muted">Your phone number is used only to answer you.</p>
        </div>
      )}
    </Panel>
  );
}

function SignIn({ call, ref_, onDone }: { call: any; ref_: string | null; onDone: (token: string) => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState<{ devCode?: string } | null>(null);
  const [needName, setNeedName] = useState(false);
  const [state, setState] = useState({ busy: false, error: '' });
  const ask = async () => {
    setState({ busy: true, error: '' });
    try { setSent(await call('/auth/code', { body: { phone } })); setState({ busy: false, error: '' }); } catch (e) { setState({ busy: false, error: (e as Error).message }); }
  };
  const verify = async () => {
    setState({ busy: true, error: '' });
    try {
      const r = await call('/auth/verify', { body: { phone, code, name: name || undefined, ref: ref_ } });
      onDone(r.token);
    } catch (e) {
      const m = (e as Error).message;
      if (/your name/i.test(m)) setNeedName(true);
      setState({ busy: false, error: m });
    }
  };
  return (
    <section className="card mx-auto max-w-sm space-y-4 p-5">
      <h1 className="text-lg font-bold">Sign in with your phone</h1>
      {!sent ? (
        <>
          <p className="text-sm text-muted">We’ll send a code by SMS. No password needed.</p>
          <input className="field" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {state.error && <p className="text-sm text-bad">{state.error}</p>}
          <button className="btn btn-primary w-full py-3" disabled={state.busy || phone.replace(/\D/g, '').length < 9} onClick={ask}>{state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Send code</button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">Enter the 6-digit code sent to {phone}.{sent.devCode && <b className="block text-ink">Test server: your code is {sent.devCode}</b>}</p>
          <input className="field num text-center text-lg tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          {needName && <input className="field" placeholder="Your name or business (new account)" value={name} onChange={(e) => setName(e.target.value)} />}
          {state.error && <p className="text-sm text-bad">{state.error}</p>}
          <button className="btn btn-primary w-full py-3" disabled={state.busy || code.length !== 6 || (needName && name.trim().length < 2)} onClick={verify}>{state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in</button>
          <button className="w-full text-sm text-muted underline" onClick={() => (setSent(null), setCode(''))}>Use another number</button>
        </>
      )}
    </section>
  );
}

function Basket({ call, cart, items, total, onDone }: { call: any; cart: Record<string, number>; items: Item[]; total: number; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });
  const lines = Object.entries(cart).filter(([, n]) => n > 0);
  const send = async () => {
    setState({ busy: true, error: '' });
    try { await call('/orders', { body: { lines: lines.map(([itemId, quantity]) => ({ itemId, quantity })), note } }); onDone(); } catch (e) { setState({ busy: false, error: (e as Error).message }); }
  };
  return (
    <div className="sticky bottom-0 border-t border-line bg-white p-3 shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 text-sm"><b>{lines.length} product{lines.length === 1 ? '' : 's'}</b> · about <b className="num">{ksh(total)}</b><span className="block text-xs text-muted">{lines.map(([id, n]) => `${items.find((i) => i.id === id)?.name} × ${n}`).join(', ')}</span></span>
        <input className="field w-full sm:w-56" placeholder="Note (delivery day, place…)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn-primary" disabled={state.busy} onClick={send}>{state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Send order</button>
        {state.error && <p className="w-full text-sm text-bad">{state.error}</p>}
      </div>
    </div>
  );
}

function Account({ call, paybill, onSignOut }: { call: any; paybill: string; onSignOut: () => void }) {
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'owe' | 'questions' | 'details'>('owe');
  const [paying, setPaying] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const load = () => call('/me').then(setMe).catch((e: Error) => setError(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <p className="text-sm text-bad">{error}</p>;
  if (!me) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-faint" />;
  const pay = async (id: string) => {
    setPaying(id);
    setNotice('');
    try { await call(`/invoices/${id}/pay`, { body: {} }); setNotice(`Check ${prettyPhone(me.customer.phone)} for the M-Pesa prompt and enter your PIN.`); } catch (e) { setNotice((e as Error).message); }
    setPaying(null);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1"><h1 className="text-xl font-bold">Hello, {me.customer.name}</h1><p className="text-sm text-muted">{me.customer.number}</p></div>
        <button className="btn btn-ghost" onClick={onSignOut}><LogOut className="h-4 w-4" /> Sign out</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4"><p className="text-xs font-semibold text-muted uppercase">You owe</p><p className="num text-2xl font-bold">{ksh(me.owes)}</p>{me.overdue > 0 && <p className="text-sm font-semibold text-bad">{ksh(me.overdue)} is overdue</p>}</div>
        <div className="card p-4 text-sm"><p className="text-xs font-semibold text-muted uppercase">How to pay</p>{me.payTo.prompt ? <p>Tap <b>Pay</b> on an invoice and enter your M-Pesa PIN.</p> : paybill ? <p>M-Pesa Paybill <b>{paybill}</b>, account: the invoice number.</p> : <p>Ask the business how to pay.</p>}</div>
      </div>
      <div className="flex gap-1.5">
        {([['owe', 'Invoices'], ['questions', `Questions (${me.inquiries.length})`], ['details', 'My details']] as const).map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} className={cn('rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1', tab === id ? 'bg-ink text-white ring-ink' : 'bg-white ring-line')}>{l}</button>
        ))}
      </div>
      {notice && <p className="rounded-md bg-brand-soft px-3 py-2 text-sm">{notice}</p>}
      {tab === 'owe' && (
        me.invoices.length ? (
          <ul className="card divide-y divide-line">
            {me.invoices.map((d: any) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1"><b>{d.number}</b><span className="block text-xs text-muted">{day(d.issueDate)} · due {day(d.dueDate)}</span></span>
                <span className="text-right"><b className="num block">{ksh(d.balance > 0 ? d.balance : d.total)}</b><span className={cn('text-xs font-semibold', d.balance === 0 ? 'text-good' : d.overdue ? 'text-bad' : 'text-muted')}>{d.balance === 0 ? 'Paid' : d.overdue ? 'Overdue' : 'To pay'}</span></span>
                {d.balance > 0 && me.payTo.prompt && <button className="btn btn-mpesa" disabled={paying === d.id} onClick={() => pay(d.id)}>{paying === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Pay</button>}
              </li>
            ))}
          </ul>
        ) : <p className="card p-4 text-sm text-muted">No invoices yet.</p>
      )}
      {tab === 'questions' && <Questions call={call} items={me.inquiries} onChange={load} />}
      {tab === 'details' && <Details call={call} me={me.customer} onChange={load} />}
    </div>
  );
}

function Questions({ call, items, onChange }: { call: any; items: any[]; onChange: () => void }) {
  const [reply, setReply] = useState<Record<string, string>>({});
  if (!items.length) return <p className="card p-4 text-sm text-muted">No questions yet. Use Ask at the top to send one.</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.id} className="card space-y-2 p-4">
          <p className="flex justify-between text-sm"><b>{i.number}</b><span className="text-muted">{i.status === 'Won' ? 'Done' : i.status === 'Lost' ? 'Closed' : i.status === 'Open' ? 'Waiting for the business' : 'Answered'}</span></p>
          {i.messages.map((m: any, k: number) => <p key={k} className={cn('rounded-md px-3 py-2 text-sm', m.from === 'customer' ? 'bg-paper' : 'bg-brand-soft')}><span className="block text-2xs text-muted">{m.from === 'customer' ? 'You' : m.author} · {day(m.at)}</span>{m.text}</p>)}
          <div className="flex gap-2">
            <input className="field" placeholder="Reply" value={reply[i.id] ?? ''} onChange={(e) => setReply({ ...reply, [i.id]: e.target.value })} />
            <button className="btn btn-primary" disabled={!(reply[i.id] ?? '').trim()} onClick={() => call(`/inquiries/${i.id}/messages`, { body: { text: reply[i.id] } }).then(() => (setReply({ ...reply, [i.id]: '' }), onChange()))}>Send</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Details({ call, me, onChange }: { call: any; me: any; onChange: () => void }) {
  const [f, setF] = useState({ name: me.name, email: me.email ?? '', marketingOptOut: me.marketingOptOut });
  const [saved, setSaved] = useState(false);
  return (
    <section className="card max-w-md space-y-3 p-4">
      <label className="block text-sm"><span className="mb-1 block font-semibold">Name</span><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="block text-sm"><span className="mb-1 block font-semibold">Email (for invoices)</span><input className="field" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <p className="text-sm text-muted">Phone: {prettyPhone(me.phone)} (to change it, ask the business).</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" checked={!f.marketingOptOut} onChange={(e) => setF({ ...f, marketingOptOut: !e.target.checked })} /><span><b className="block">Send me offers</b><span className="text-xs text-muted">Untick to stop offers. You’ll still get invoices and receipts.</span></span></label>
      <button className="btn btn-primary" onClick={() => call('/me', { method: 'PUT', body: f }).then(() => (setSaved(true), onChange()))}>{saved ? 'Saved' : 'Save'}</button>
    </section>
  );
}
