// Eight months in the life of Amani Distributors (March to today), played through Kabuor ERP's real API by its own
// staff logins, with every agent switched on and watching the data as it arrives. Each simulated day runs in a
// short real-time window; tools/backdate-sim.py then moves whatever the server stamped "now" (inquiries, replies,
// link clicks, stock moves, agent work) onto the simulated day, so the books read like eight real months.
//
// Usage: node tools/simulate-8-months.mjs http://localhost:5083 [--from=2026-03-01]
// Never point it at the live site: it writes thousands of sales, payments and payslips.
import fs from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5083';
if (!/localhost|127\.0\.0\.1/.test(BASE)) { console.error('Refusing: this writes months of test data. Use a local server.'); process.exit(1); }
const FROM = process.argv.find((a) => a.startsWith('--from='))?.slice(7) ?? '2026-03-01';
const eatDate = (ms = Date.now()) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);
const TODAY = eatDate();
const OUT = new URL('../demo/sim-8-months.json', import.meta.url);

let seed = 20260301;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const chance = (p) => rnd() < p;
const weighted = (rows, w) => { const total = rows.reduce((s, r) => s + w(r), 0); let x = rnd() * total; for (const r of rows) if ((x -= w(r)) <= 0) return r; return rows[rows.length - 1]; };
const addDays = (d, n) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const dow = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();
const KES = (c) => `KSh ${Math.round(c / 100).toLocaleString('en-KE')}`;

const counts = {};
const bump = (k, n = 1) => (counts[k] = (counts[k] ?? 0) + n);
const errors = {};
const timings = [];
const ip = () => `41.${int(80, 90)}.${int(0, 255)}.${int(1, 254)}`;

async function raw(token, method, path, body, headers = {}) {
  const t0 = performance.now();
  const res = await fetch(BASE + path, {
    method, redirect: 'manual',
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  timings.push(performance.now() - t0);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (res.status >= 500) bump('serverErrors');
  return { status: res.status, json, text };
}
async function call(token, method, path, body, { expect = [], headers } = {}) {
  const r = await raw(token, method, '/api' + path, body, headers);
  if (r.status >= 400 && !expect.includes(r.status)) {
    const key = `${r.status} ${method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id').replace(/\?.*/, '')}: ${(r.json?.error ?? r.text).slice(0, 140)}`;
    errors[key] = (errors[key] ?? 0) + 1;
    throw Object.assign(new Error(key), { status: r.status, json: r.json });
  }
  return r;
}
const as = (token) => ({
  token,
  get: (p) => call(token, 'GET', p).then((r) => r.json),
  post: (p, b = {}, o) => call(token, 'POST', p, b, o).then((r) => (o?.expect ? r : r.json)),
  put: (p, b, o) => call(token, 'PUT', p, b, o).then((r) => (o?.expect ? r : r.json)),
});
const attempt = async (what, fn) => { try { return await fn(); } catch { bump(`failed:${what}`); return null; } };

// ------------------------------------------------------------------ the people
const logins = JSON.parse(fs.readFileSync(new URL('../demo/logins.json', import.meta.url))).logins;
const login = async (email, password) => as((await call(null, 'POST', '/auth/login', { email, password }, { headers: { 'X-Forwarded-For': ip() } })).json.token);
const pw = (role) => logins.find((l) => l.role === role)?.password;
const owner = await login('owner@amani.test', pw('Owner'));
const accountant = await login('peter@amani.test', 'Amani-peter-2026');
const store = await login('joseph@amani.test', 'Amani-joseph-2026');
const hr = await login('faith@amani.test', 'Amani-faith-2026');
const me = await owner.get('/auth/me').catch(() => null);
const users = await owner.get('/settings/users');
const seller = async (email, password) => { const api = await login(email, password); const u = users.find((x) => x.email === email); return { api, id: u?.id, name: u?.name ?? email }; };
const sellers = [await seller('mercy@amani.test', 'Amani-mercy-2026'), await seller('brian@amani.test', 'Amani-brian-2026')];
void me;

// Every agent on, watching. Risky actions wait for a person; sure ones go ahead within limits.
for (const [key, settings] of [
  ['matching', { review: 'sure', limit: 10_000 }], ['collections', { remindEveryDays: 7, minDaysLate: 3, language: 'sw', review: 'all' }],
  ['restock', { review: 'all', limit: 50_000 }], ['payables', { review: 'all' }], ['orders', { review: 'all' }], ['audit', { review: 'all' }],
]) await attempt('agent-config', () => owner.put(`/agents/${key}`, { enabled: true, settings }));

// ------------------------------------------------------------------ what we sell, and from whom
let items = await owner.get('/items');
const stockNow = async () => (await owner.get('/stock')).items;
const costOf = new Map((await stockNow()).map((s) => [s.id, s.averageCost]));
const units = new Map();
for (const u of await owner.get('/items/units')) if (!units.has(u.itemId)) units.set(u.itemId, u);
const suppliers = await owner.get('/suppliers').then((r) => r.items ?? r);
const SHELF = { MK500: 7, BR400: 5, EGG30: 21, MG500: 120, JC1: 180 };
// New lines through the months: [from, name, sku, unit, price, cost, tax, reorder, brand, supplier]
const newLines = [
  ['2026-03-16', 'Cooking fat 1kg', 'CF1', 'tub', 290_00, 238_00, 'B_Standard16', 50, 'Kimbo', 'Bidco Africa'],
  ['2026-04-06', 'Spaghetti 400g', 'SPG400', 'packet', 120_00, 88_00, 'B_Standard16', 60, 'Santa Lucia', 'Kenafric'],
  ['2026-04-20', 'Tomato sauce 400g', 'TS400', 'bottle', 180_00, 132_00, 'B_Standard16', 40, 'Peptang', 'Kenafric'],
  ['2026-05-11', 'Toothpaste 100ml', 'TP100', 'tube', 210_00, 160_00, 'B_Standard16', 40, 'Colgate', 'Haco Industries'],
  ['2026-05-25', 'Instant noodles 70g', 'IN70', 'packet', 40_00, 27_00, 'B_Standard16', 200, 'Indomie', 'Twiga Foods'],
  ['2026-06-15', 'Diapers medium 40s', 'DP40', 'pack', 1_250_00, 1_020_00, 'B_Standard16', 20, 'Huggies', 'Haco Industries'],
  ['2026-07-06', 'Body lotion 400ml', 'BL400', 'bottle', 450_00, 350_00, 'B_Standard16', 25, 'Nivea', 'Haco Industries'],
  ['2026-08-03', 'Mineral water 5L', 'MW5', 'bottle', 230_00, 160_00, 'B_Standard16', 60, 'Dasani', 'Coca-Cola Beverages'],
  ['2026-08-24', 'Energy drink 500ml', 'ED500', 'can', 150_00, 108_00, 'B_Standard16', 80, 'Power Play', 'Coca-Cola Beverages'],
  ['2026-09-14', 'Rice 25kg', 'RC25', 'bag', 4_200_00, 3_650_00, 'A_Exempt', 10, 'Pishori', 'Unga Ltd'],
];
const supplierSkus = { 'Brookside Dairy': ['MK500', 'MG500'], 'Bidco Africa': ['OL3', 'SP800', 'DT1'], 'Mumias Sugar': ['SG2', 'ST1'], 'Unga Ltd': ['MF2', 'WF2', 'RC5'], 'Coca-Cola Beverages': ['SD500', 'WT1', 'JC1'], Kenafric: ['TL500', 'BS200', 'MB10', 'TP10', 'BR400', 'EGG30'] };
const newSuppliers = [['2026-05-04', 'Haco Industries', 'P000600007G'], ['2026-05-18', 'Twiga Foods', 'P000600008H']];
const landlord = suppliers.find((s) => s.name === 'Riverside Properties') ?? null;

// ------------------------------------------------------------------ who buys
const shopWords = ['Duka', 'Minimart', 'Stores', 'Kiosk', 'Supermarket', 'Wholesalers', 'Traders', 'Mart'];
const firstNames = ['Wanjiku', 'Akinyi', 'Kamau', 'Otieno', 'Njoroge', 'Chebet', 'Mutua', 'Wafula', 'Nyambura', 'Kiprotich', 'Achieng', 'Mwangi', 'Barasa', 'Jeptoo', 'Odhiambo', 'Wairimu', 'Kilonzo', 'Nekesa', 'Kariuki', 'Moraa'];
const places = ['Kawangware', 'Githurai', 'Kasarani', 'Embakasi', 'Rongai', 'Kitengela', 'Ruiru', 'Kikuyu', 'Dagoretti', 'Kayole', 'Umoja', 'Donholm', 'Ngong', 'Juja', 'Thika Road', 'Pipeline'];
const institutions = ['Academy', 'Primary School', 'Hotel', 'Cafe', 'Restaurant', 'Hospital Canteen', 'Church', 'Salon', 'Office Canteen'];
let phoneN = 712400000;
const customers = (await owner.get('/customers?take=500')).page.items.map((c) => ({ id: c.id, name: c.name, phone: c.phone, kind: /Hotel|Cafe|Eatery|Restaurant/.test(c.name) ? 'hotel' : 'shop', size: 0.5 + rnd() * 2.5, payer: weightedPayer() }));
function weightedPayer() { const x = rnd(); return x < 0.55 ? 'prompt' : x < 0.85 ? 'slow' : x < 0.96 ? 'late' : 'bad'; }
const priceLists = await owner.get('/price-lists').catch(() => []);
const wholesale = (priceLists.items ?? priceLists).find?.((p) => p.name === 'Wholesale');

async function newCustomer(by, kind) {
  const name = kind === 'shop' ? `${pick(firstNames)} ${pick(shopWords)} ${pick(places)}` : `${pick(places)} ${pick(institutions)}`;
  const phone = `0${++phoneN}`;
  const c = await by.api.post('/customers', { name, phone });
  await attempt('terms', () => accountant.put(`/customers/${c.id}`, { name, phone, priceListId: kind === 'shop' ? wholesale?.id : undefined, creditLimit: kind === 'shop' ? int(5, 15) * 10_000_00 : int(3, 8) * 10_000_00 }));
  const row = { id: c.id, name, phone, kind, size: 0.3 + rnd() * 2, payer: weightedPayer() };
  customers.push(row);
  bump('customersAdded');
  return row;
}

// ------------------------------------------------------------------ the shape of the year
const monthIndex = (d) => (Number(d.slice(0, 4)) - 2026) * 12 + Number(d.slice(5, 7)) - 3; // March = 0
// Growth through the year, a school-term lift, Easter and the August holiday dip; Saturdays are half days.
const SEASON = { 3: 0.85, 4: 1.05, 5: 0.95, 6: 1.0, 7: 1.05, 8: 0.9, 9: 1.1, 10: 1.05 };
const factor = (d) => (0.6 + 0.07 * monthIndex(d)) * (SEASON[Number(d.slice(5, 7))] ?? 1) * (dow(d) === 6 ? 0.55 : 1);
const at = (d, h = int(8, 17), m = int(0, 59)) => `${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+03:00`;
let refN = 0;
// References unique to this run ("8M"), so they can't collide with receipts already in the books.
const ref = (p) => `${p}8M${(++refN).toString(36).toUpperCase().padStart(6, '0')}`;

// ------------------------------------------------------------------ queues of things that happen later
const toPay = [];           // { on, inv: {id,total,number}, c, left }
const billsToPay = [];      // { on, id, total }
const inquiryTodo = [];     // { on, step, inq, link, seller, outcome, product }
const leadTodo = [];
const soldQty = new Map();  // itemId -> [{d, q}]
const agentLog = [];
const windows = [];
const batchExpiry = {};
const sold = (id, q, d) => { const a = soldQty.get(id) ?? []; a.push({ d, q }); soldQty.set(id, a); };
const dailyRate = (id, d) => { const from = addDays(d, -28); const q = (soldQty.get(id) ?? []).filter((x) => x.d >= from).reduce((s, x) => s + x.q, 0); return q / 24; };

// Tracking links: one per salesperson per channel, plus the company's own.
let links = (await owner.get('/links')).links.filter((l) => l.active);
async function ensureLink(by, name, channel, ownerUserId) {
  const found = links.find((l) => l.name === name);
  if (found) return found;
  const l = await (by ?? owner).post('/links', { name, channel, ownerUserId, target: 'shop' });
  const row = { id: l.id, code: l.code, name, channel, ownerUserId };
  links.push(row);
  bump('linksAdded');
  return row;
}
await ensureLink(sellers[0].api, 'Mercy’s Instagram', 'Instagram', sellers[0].id);
await ensureLink(sellers[1].api, 'Brian’s LinkedIn', 'LinkedIn', sellers[1].id);
await ensureLink(null, 'Google Business profile', 'Google', null);
await ensureLink(null, 'YouTube recipe videos', 'YouTube', null);
// How strongly each channel pulls people in (TikTok is loud and fickle; WhatsApp from a salesperson converts).
const PULL = { TikTok: 3, Facebook: 1.6, Instagram: 1.8, WhatsApp: 1.4, LinkedIn: 0.5, Google: 1.2, YouTube: 0.7 };
const BUY = { TikTok: 0.18, Facebook: 0.3, Instagram: 0.3, WhatsApp: 0.55, LinkedIn: 0.45, Google: 0.4, YouTube: 0.22 };
const portal = await owner.get('/settings/portal');
const slug = portal.slug;

// ------------------------------------------------------------------ the day's work
const products = () => items.filter((i) => i.active !== false && i.kind !== 'Service' && i.trackStock !== false);
const lostReasons = [['Price too high', 4], ['Bought elsewhere', 3], ['No reply from customer', 4], ['Out of stock', 2], ['Took too long to answer', 2], ['Just asking', 2], ['Delivery area not covered', 1]];
const questions = ['Habari, bei ya {p} ni ngapi kwa wholesale?', 'Do you deliver {p} to {place}?', 'Price for 10 cartons of {p}?', 'Naomba quote ya {p} kwa shule yetu.', 'Do you have {p} in stock today?', 'Can you supply {p} every week to our hotel?'];
const orderTexts = ['Habari, naomba {n} {u} {p} na {n2} {p2}. Asante', 'Please send {n} {p} and {n2} {p2} tomorrow morning', 'Tuma {n} {p} tafadhali, na {n2} {p2}'];

async function issueInvoice(by, inv, d) {
  const r = await by.post(`/sales/${inv.id}/issue`, {}, { expect: [400, 409] });
  if (r.status === 409) {
    bump('creditBlocks');
    if (!chance(0.8)) { bump('blockedLeftAsDraft'); return null; }
    await owner.post(`/sales/${inv.id}/issue?overLimit=true`);
    bump('ownerOverrides');
  } else if (r.status === 400) { bump('issueRefused'); return null; }
  const full = (await owner.get(`/sales/${inv.id}`)).document;
  for (const l of full.lines) if (l.itemId) sold(l.itemId, Number(l.quantity) * (l.unitFactor ?? 1), d);
  return full;
}
function schedulePayment(full, c, d) {
  const delay = { prompt: int(0, 10), slow: int(12, 35), late: int(35, 75), bad: 999 }[c.payer];
  const partly = chance(0.15);
  if (partly) toPay.push({ on: addDays(d, Math.max(0, delay - 5)), inv: full, c, amount: Math.round(full.total * 0.5) });
  toPay.push({ on: addDays(d, delay), inv: full, c, amount: partly ? full.total - Math.round(full.total * 0.5) : full.total });
}
async function sell(d, by, c) {
  const lines = [];
  for (let j = 0; j < int(1, c.kind === 'shop' ? 5 : 3); j++) {
    const it = pick(products());
    if (lines.some((l) => l.itemId === it.id)) continue;
    const u = units.get(it.id);
    const big = u && c.kind === 'shop' && chance(0.55);
    lines.push({ itemId: it.id, quantity: Math.max(1, Math.round((big ? int(1, 3) : int(2, 12)) * c.size)), unit: big ? u.name : undefined });
  }
  if (chance(0.12)) { const del = items.find((i) => i.sku === 'DEL'); if (del) lines.push({ itemId: del.id, quantity: 1 }); }
  const inv = await by.api.post('/sales', { kind: 'Invoice', customerId: c.id, issueDate: d, dueInDays: c.kind === 'shop' ? 14 : 7, lines });
  const full = await issueInvoice(by.api, inv, d);
  if (!full) return;
  bump('invoices');
  schedulePayment(full, c, d);
}
async function restock(d) {
  const levels = await stockNow();
  for (const s of [...suppliers]) {
    const skus = supplierSkus[s.name] ?? [];
    const lines = [];
    for (const sku of skus) {
      const it = items.find((i) => i.sku === sku);
      if (!it) continue;
      const have = levels.find((x) => x.id === it.id)?.total ?? 0;
      const want = Math.ceil(Math.max(it.reorderLevel ?? 20, dailyRate(it.id, d) * 14) * 1.3);
      // Some weeks the buyer over-orders, which is what leaves slow stock on the shelf.
      const qty = Math.max(0, Math.round((want - have) * (chance(0.12) ? 1.8 : 1)));
      if (qty < 1) continue;
      const line = { itemId: it.id, quantity: qty, unitCost: Math.round((costOf.get(it.id) || it.price * 0.8) * (0.97 + rnd() * 0.08)), taxType: it.taxType, brand: it.brand || undefined };
      if (it.trackBatches) {
        const batchNo = `${sku}-${d.replace(/-/g, '')}-${int(10, 99)}`;
        const life = SHELF[sku] ?? 30;
        batchExpiry[batchNo] = addDays(d, life);
        // While the simulation runs, freshness is judged on today's real date; backdate-sim.py puts the true expiry back.
        line.batchNo = batchNo; line.expiry = addDays(TODAY, life + Math.max(0, Math.round((Date.parse(TODAY) - Date.parse(d)) / 864e5)));
      }
      lines.push(line);
    }
    if (!lines.length) continue;
    await attempt('bill', async () => {
      const bill = await accountant.post('/purchases', { kind: 'Bill', supplierId: s.id, issueDate: d, dueInDays: 30, supplierRef: ref('SUP'), lines });
      const posted = await accountant.post(`/purchases/${bill.id}/post`);
      billsToPay.push({ on: addDays(d, int(5, 32)), id: bill.id, total: posted.total ?? bill.total });
      bump('supplierBills');
    });
  }
}
async function monthlyCosts(d) {
  const accounts = await accountant.get('/reports/accounts');
  const acc = (code) => accounts.find((a) => a.code === code)?.id;
  const sup = landlord ?? suppliers[0];
  const lines = [
    { accountId: acc('6000'), description: `Warehouse rent ${d.slice(0, 7)}`, quantity: 1, unitCost: 85_000_00, taxType: 'B_Standard16' },
    { accountId: acc('6500'), description: 'KPLC and water', quantity: 1, unitCost: int(14, 22) * 1_000_00, taxType: 'B_Standard16' },
    { accountId: acc('6200'), description: 'Fuel for deliveries', quantity: 1, unitCost: int(38, 55) * 1_000_00, taxType: 'B_Standard16' },
    { accountId: acc('6300'), description: 'Airtime and internet', quantity: 1, unitCost: 6_500_00, taxType: 'B_Standard16' },
  ].filter((l) => l.accountId);
  await attempt('expenses', async () => {
    const bill = await accountant.post('/purchases', { kind: 'Bill', supplierId: sup.id, issueDate: d, dueInDays: 7, supplierRef: ref('EXP'), lines });
    const posted = await accountant.post(`/purchases/${bill.id}/post`);
    billsToPay.push({ on: addDays(d, int(1, 6)), id: bill.id, total: posted.total ?? bill.total });
    bump('expenseBills');
  });
}
async function inquiryArrives(d) {
  const link = weighted(links, (l) => PULL[l.channel] ?? 1);
  const it = pick(products());
  const asker = chance(0.5) ? `${pick(firstNames)} ${pick(shopWords)}` : `${pick(places)} ${pick(institutions)}`;
  const text = pick(questions).replace('{p}', it.name).replace('{place}', pick(places));
  const r = await raw(null, 'POST', `/api/public/${slug}/inquiries`, { name: asker, phone: `07${int(20000000, 99999999)}`, message: text, itemId: it.id, ref: link.code }, { 'X-Forwarded-For': ip() });
  if (r.status >= 400) { bump('failed:inquiry'); return; }
  bump('inquiries');
  const buys = chance(BUY[link.channel] ?? 0.3);
  const outcome = buys ? 'won' : weighted(lostReasons, (x) => x[1])[0];
  const who = sellers.find((s) => s.id === link.ownerUserId) ?? pick(sellers.filter((s) => !s.from || s.from <= d));
  // Most get an answer the same day; some wait, and those are the ones lost to "took too long".
  const wait = outcome === 'Took too long to answer' ? int(2, 4) : chance(0.75) ? 0 : 1;
  inquiryTodo.push({ on: addDays(d, wait), step: 'reply', id: r.json?.id, name: asker, link, who, outcome, it });
}
async function inquiryWork(d) {
  const due = inquiryTodo.filter((t) => t.on <= d && !t.done);
  if (!due.length) return;
  for (const t of due) {
    t.done = true;
    if (!t.id) continue;
    const inq = { id: t.id };
    const api = t.who.api;
    await attempt('inquiry-step', async () => {
      if (t.step === 'reply') {
        if (t.outcome === 'No reply from customer' && chance(0.2)) return; // left open, nobody answered
        await api.post(`/inquiries/${inq.id}/reply`, { text: `Habari ${t.name.split(' ')[0]}, asante. ${t.it.name} is ${KES(t.it.price)}; we deliver within Nairobi. Shall I send a quote?` });
        bump('inquiryReplies');
        if (['won', 'Price too high', 'Bought elsewhere'].includes(t.outcome)) inquiryTodo.push({ ...t, id: inq.id, on: addDays(d, int(0, 2)), step: 'quote', done: false });
        else inquiryTodo.push({ ...t, id: inq.id, on: addDays(d, int(1, 5)), step: 'close', done: false });
      } else if (t.step === 'quote') {
        const q = await api.post(`/inquiries/${inq.id}/quote`, {});
        const doc = (await api.get(`/sales/${q.quoteId}`)).document;
        await api.put(`/sales/${q.quoteId}`, { kind: 'Quote', customerId: doc.customerId, issueDate: d, dueInDays: 14, lines: [{ itemId: t.it.id, quantity: int(6, 40) }] });
        await api.post(`/sales/${q.quoteId}/issue`, {});
        bump('quotes');
        inquiryTodo.push({ ...t, quoteId: q.quoteId, customerId: doc.customerId, on: addDays(d, int(1, 4)), step: t.outcome === 'won' ? 'invoice' : 'close', done: false });
      } else if (t.step === 'invoice') {
        const inv = await api.post(`/sales/${t.quoteId}/to-invoice`, {});
        const draft = (await api.get(`/sales/${inv.id}`)).document;
        // Sometimes the customer adds to the order, sometimes the price is bargained down: the audit agent's job.
        const lines = draft.lines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) + (chance(0.25) ? int(1, 6) : 0), unitPrice: chance(0.2) ? Math.round(l.unitPrice * 0.93) : undefined }));
        await api.put(`/sales/${inv.id}`, { kind: 'Invoice', customerId: draft.customerId, issueDate: d, dueInDays: 14, lines });
        const full = await issueInvoice(api, inv, d);
        if (!full) return;
        bump('inquiriesWon');
        const status = (await api.get(`/inquiries/${inq.id}`)).inquiry?.status;
        if (status && status !== 'Won') await api.post(`/inquiries/${inq.id}/close`, { won: true, invoiceId: inv.id });
        // A won inquiry becomes a regular customer.
        const c = { id: draft.customerId, name: t.name, kind: /School|Hotel|Cafe|Restaurant|Canteen|Church|Salon|Hospital/.test(t.name) ? 'hotel' : 'shop', size: 0.4 + rnd() * 1.5, payer: weightedPayer(), via: t.link.channel };
        customers.push(c);
        schedulePayment(full, c, d);
      } else if (t.step === 'close') {
        await api.post(`/inquiries/${inq.id}/close`, { won: false, reason: t.outcome });
        bump('inquiriesLost');
      }
    });
  }
}
async function visits(d) {
  const n = Math.round(int(15, 45) * factor(d));
  for (let i = 0; i < n; i++) {
    const link = weighted(links, (l) => PULL[l.channel] ?? 1);
    // About a third are people coming back on the same browser.
    const visitor = chance(0.35) ? `ret${int(1, 400)}${link.code}` : `v${d}${i}${int(0, 1e6)}`;
    const r = await raw(null, 'GET', `/l/${link.code}`, undefined, { Cookie: `kv=${visitor.padEnd(16, 'x')}`, 'X-Forwarded-For': ip(), 'User-Agent': chance(0.8) ? 'Mozilla/5.0 (Linux; Android 14) Mobile' : 'Mozilla/5.0 (Windows NT 10.0)' });
    if (r.status < 400) bump('linkVisits');
  }
}
async function payments(d) {
  for (const p of toPay.filter((x) => x.on === d && x.amount > 0)) {
    const method = chance(0.75) ? 'Mpesa' : chance(0.6) ? 'Bank' : 'Cash';
    // One M-Pesa payment in ten comes in with a wrong account number: the matching agent's job.
    const loose = method === 'Mpesa' && chance(0.1);
    await attempt('payment', () => accountant.post('/payments', {
      method, amount: p.amount, receivedAt: at(d), reference: ref(method === 'Mpesa' ? 'T' : method === 'Bank' ? 'BNK' : 'CSH'),
      payerPhone: p.c.phone, payerName: p.c.name, accountRef: loose ? 'goods' : p.inv.number, customerId: loose ? undefined : p.c.id, invoiceId: loose ? undefined : p.inv.id,
    }));
    bump(loose ? 'paymentsUnmatched' : 'payments');
  }
  for (const b of billsToPay.filter((x) => x.on === d)) {
    await attempt('supplier-payment', () => accountant.post(`/purchases/${b.id}/pay`, { method: chance(0.7) ? 'Bank' : 'Mpesa', amount: b.total, reference: ref('PAY'), paidAt: at(d) }));
    bump('supplierPayments');
  }
}
async function people(d) {
  // Hires through the year, each with a login if they sell.
  const hires = [['2026-04-13', 'Wanjiru Kamau', 'Sales rep', 32_000_00, 'Sales'], ['2026-06-01', 'Ochieng Otieno', 'Sales rep', 32_000_00, 'Sales'], ['2026-05-04', 'Halima Hassan', 'Cashier', 24_000_00, null], ['2026-07-13', 'Peter Kimani', 'Driver', 27_000_00, null], ['2026-08-17', 'Rose Atieno', 'Store clerk', 22_000_00, null], ['2026-09-07', 'Felix Rotich', 'Loader', 16_500_00, null]];
  for (const [on, name, job, basic, role] of hires.filter((h) => h[0] === d)) {
    await attempt('hire', () => hr.post('/employees', { name, jobTitle: job, startDate: d, basicSalary: basic, phone: `0${++phoneN}`, kraPin: `A00${int(1000000, 9999999)}Z`, nationalId: `${int(20000000, 39999999)}`, payMethod: 'Mpesa', payPhone: `0${phoneN}` }));
    bump('hires');
    if (role) {
      const first = name.split(' ')[0].toLowerCase();
      const email = `${first}@amani.test`, password = `Amani-${first}-2026`;
      await attempt('user', () => owner.post('/settings/users', { name, email, role, password }));
      const s = await seller(email, password).catch(() => null);
      if (s) {
        s.id ??= (await owner.get('/settings/users')).find((u) => u.email === email)?.id;
        s.from = d; sellers.push(s);
        if (!logins.some((l) => l.login === email)) logins.push({ role, name, login: email, password });
        await ensureLink(s.api, `${name.split(' ')[0]}’s WhatsApp`, 'WhatsApp', s.id);
        await ensureLink(s.api, `${name.split(' ')[0]}’s TikTok`, 'TikTok', s.id);
      }
    }
  }
  // Leave: a couple of requests a month, mostly approved.
  if (chance(0.09)) {
    const staff = (await hr.get('/employees')).items ?? [];
    const e = staff.length ? pick(staff) : null;
    if (e) await attempt('leave', async () => {
      const type = chance(0.7) ? 'Annual' : 'Sick';
      const from = addDays(d, type === 'Sick' ? 0 : int(5, 20));
      const l = await hr.post('/leave', { employeeId: e.id, type, from, to: addDays(from, int(1, 4)), note: type === 'Sick' ? 'Doctor’s note attached' : 'Family visit' });
      await hr.post(`/leave/${l.id}/${chance(0.85) ? 'approve' : 'reject'}`);
      bump('leaveRequests');
    });
  }
}
async function payroll(d) {
  // On the first working day, pay last month; statutory payments go by the 9th.
  const prev = addDays(`${d.slice(0, 7)}-01`, -1).slice(0, 7);
  if (prev < FROM.slice(0, 7)) return;
  const runs = await hr.get('/payroll/runs');
  if ((runs.items ?? runs).some((r) => String(r.period).startsWith(prev))) return;
  await attempt('payroll', async () => {
    const run = await hr.post('/payroll/runs', { month: prev });
    await accountant.post(`/payroll/runs/${run.id}/approve`);
    await accountant.post(`/payroll/runs/${run.id}/pay`, { method: 'Mpesa', reference: `BULK-${prev}` });
    for (const kind of ['PAYE', 'NSSF', 'SHIF', 'AHL', 'NITA']) await attempt('remit', () => accountant.post(`/payroll/runs/${run.id}/remit`, { kind, method: 'Bank', reference: ref('KRA') }));
    bump('payrollRuns');
  });
}
async function leads(d) {
  for (let i = 0; i < (chance(0.5) ? 1 : 0); i++) {
    const by = pick(sellers.filter((s) => !s.from || s.from <= d));
    await attempt('lead', async () => {
      const l = await by.api.post('/crm/leads', { name: `${pick(firstNames)} ${pick(['Kamau', 'Otieno', 'Mwangi', 'Wekesa'])}`, business: `${pick(places)} ${pick(institutions)}`, phone: `07${int(20000000, 99999999)}`, source: pick(['WhatsApp', 'Instagram', 'Facebook', 'Referral', 'WalkIn', 'Call', 'Event']), estimatedValue: int(2, 40) * 10_000_00, interest: pick(products()).name, followUpOn: addDays(d, int(2, 10)) });
      bump('leads');
      leadTodo.push({ on: addDays(d, int(2, 12)), id: l.id, by, stage: 'Contacted' });
    });
  }
  for (const t of leadTodo.filter((x) => x.on === d)) {
    await attempt('lead-stage', () => t.by.api.post(`/crm/leads/${t.id}/stage`, { stage: t.stage, lostReason: t.stage === 'Lost' ? pick(['Price', 'Went quiet', 'Chose another supplier']) : undefined }));
    const next = t.stage === 'Contacted' ? (chance(0.6) ? 'Quoted' : 'Lost') : t.stage === 'Quoted' ? (chance(0.5) ? 'Won' : 'Lost') : null;
    if (next) leadTodo.push({ ...t, on: addDays(d, int(3, 15)), stage: next });
  }
}
async function orderMessages(d) {
  // Customers' WhatsApp orders, read by the orders agent.
  if (!chance(0.35)) return;
  const c = pick(customers);
  const a = pick(products()), b = pick(products());
  const text = pick(orderTexts).replace('{n}', int(2, 10)).replace('{u}', units.get(a.id)?.name ?? '').replace('{p}', a.name).replace('{n2}', int(1, 6)).replace('{p2}', b.name);
  await attempt('order-intake', () => pick(sellers).api.post('/agents/orders/intake', { text, customerId: c.id }));
  bump('ordersReadByAgent');
}
async function stockCount(d) {
  const levels = (await stockNow()).filter((s) => s.total > 0);
  const sample = levels.sort(() => rnd() - 0.5).slice(0, 14);
  await attempt('stock-count', () => store.post('/stock/count', { counts: sample.map((s) => ({ itemId: s.id, counted: chance(0.86) ? s.total : Math.max(0, s.total - int(1, 4)) })), note: `Month-end count ${d.slice(0, 7)}` }));
  bump('stockCounts');
}
async function agentsWatch(d) {
  // Every simulated week the agents look at everything that came in, and the owner deals with what they raise.
  const summary = {};
  for (const k of ['matching', 'collections', 'restock', 'payables', 'audit']) {
    const r = await attempt(`agent-run-${k}`, () => owner.post(`/agents/${k}/run`));
    summary[k] = r?.summary ?? r?.result ?? null;
  }
  const tasks = ((await owner.get('/agents/tasks')).items ?? []).filter((t) => t.status === 'NeedsReview');
  let approved = 0, dismissed = 0;
  for (const t of tasks.slice(0, 25)) {
    const who = t.action === 'match_payment' ? accountant : owner;
    const yes = ['match_payment', 'send_reminder', 'send_quote'].includes(t.action) ? chance(0.85) : chance(0.5);
    const r = await raw(who.token, 'POST', `/api/agents/tasks/${t.id}/${yes ? 'approve' : 'dismiss'}`, {});
    if (r.status < 300) yes ? approved++ : dismissed++;
  }
  bump('agentTasksApproved', approved); bump('agentTasksDismissed', dismissed);
  agentLog.push({ week: d, waiting: tasks.length, approved, dismissed, ...summary });
}

// ------------------------------------------------------------------ run the months
const t0 = Date.now();
let lastMonth = '';
for (let d = FROM; d <= TODAY; d = addDays(d, 1)) {
  if (dow(d) === 0) continue; // Sundays closed
  const start = Date.now();
  const firstOfMonth = d.slice(0, 7) !== lastMonth;
  if (firstOfMonth) {
    if (lastMonth) { const m = lastMonth; console.log(`${m}: ${counts.invoices ?? 0} invoices, ${counts.inquiries ?? 0} inquiries, ${counts.payments ?? 0} payments so far · ${((Date.now() - t0) / 60000).toFixed(1)} min`); void m; }
    lastMonth = d.slice(0, 7);
    await payroll(d);
    await monthlyCosts(d);
  }
  for (const [on, name, sku, unit, price, cost, taxType, reorder, brand, supplier] of newLines.filter((l) => l[0] <= d && !items.some((i) => i.sku === l[2]))) {
    void on;
    await attempt('product', async () => {
      const it = await owner.post('/items', { name, sku, kind: 'Product', unit, price, taxType, trackStock: true, reorderLevel: reorder, brand });
      items.push({ ...it, brand, reorderLevel: reorder, taxType });
      costOf.set(it.id, cost);
      (supplierSkus[supplier] ??= []).push(sku);
      bump('productsAdded');
    });
  }
  for (const [on, name, pin] of newSuppliers.filter((s) => s[0] <= d && !suppliers.some((x) => x.name === s[1]))) {
    void on;
    await attempt('supplier', async () => { suppliers.push(await owner.post('/suppliers', { name, kraPin: pin, phone: `07220${int(10000, 99999)}` })); bump('suppliersAdded'); });
  }
  if (dow(d) === 1 || firstOfMonth) await restock(d);
  await people(d);
  await visits(d);
  for (let i = 0; i < Math.round(int(1, 5) * factor(d)); i++) await inquiryArrives(d);
  await inquiryWork(d);
  const active = sellers.filter((s) => !s.from || s.from <= d);
  if (chance(0.45 * factor(d))) await attempt('new-customer', () => newCustomer(pick(active), chance(0.7) ? 'shop' : 'hotel'));
  for (let i = 0; i < Math.round(int(6, 11) * factor(d)); i++) await attempt('invoice', () => sell(d, pick(active), weighted(customers, (c) => c.size)));
  await payments(d);
  await leads(d);
  await orderMessages(d);
  if (addDays(d, 1).slice(0, 7) !== d.slice(0, 7) || (dow(addDays(d, 1)) === 0 && addDays(d, 2).slice(0, 7) !== d.slice(0, 7))) await stockCount(d);
  if (dow(d) === 6) await agentsWatch(d);
  windows.push({ day: d, start, end: Date.now(), realDates: [...new Set([eatDate(start), eatDate()])] });
  fs.writeFileSync(OUT, JSON.stringify({ realToday: TODAY, windows, batchExpiry }, null, 1));
}
await agentsWatch(TODAY);
windows.push({ day: TODAY, start: windows.at(-1)?.end ?? Date.now(), end: Date.now(), realDates: [eatDate()] });

// Targets, so the dashboard has something to judge against.
await attempt('targets', () => owner.put('/insights/kpis/targets', { sales: 1_000_000, newCustomers: 15, collected: 950_000, margin: 15, repeat: 40, conversion: 30, response: 2, dso: 30, overdue: 15, stockDays: 45, accuracy: 98, stockouts: 0, payroll: 20, etims: 100 }));
fs.writeFileSync(OUT, JSON.stringify({ realToday: TODAY, windows, batchExpiry }, null, 1));
fs.writeFileSync(new URL('../demo/logins.json', import.meta.url), JSON.stringify({ company: 'Amani Distributors Ltd', logins }, null, 2));

const sorted = [...timings].sort((a, b) => a - b);
const p = (q) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]);
console.log(JSON.stringify({ minutes: ((Date.now() - t0) / 60000).toFixed(1), requests: timings.length, latencyMs: { p50: p(0.5), p95: p(0.95), p99: p(0.99), max: Math.round(sorted.at(-1)) }, counts, errors, agents: agentLog.slice(-6) }, null, 2));
fs.writeFileSync(new URL('../demo/sim-8-months-agents.json', import.meta.url), JSON.stringify(agentLog, null, 1));
