// Adds Kabuor Intelligence activity to the Amani demo: tracking links, visits, web inquiries (answered, sold
// and lost), and a stock count. Usage: node tools/seed-intelligence.mjs http://localhost:5083
const BASE = process.argv[2] ?? 'http://localhost:5083';
const call = async (token, method, path, body, extra = {}) => {
  const r = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
  if (r.status >= 400) throw new Error(`${r.status} ${method} ${path}: ${j?.error ?? t.slice(0, 160)}`);
  return j;
};
const login = async (email, password) => (await call(null, 'POST', '/api/auth/login', { email, password })).token;
const owner = await login('owner@amani.test', 'Amani-owner-2026!');
const mercy = await login('mercy@amani.test', 'Amani-mercy-2026');
const brian = await login('brian@amani.test', 'Amani-brian-2026');
const portal = await call(owner, 'PUT', '/api/settings/portal', { enabled: true });
const slug = portal.slug;
const mk = async (t, name, channel) => (await call(t, 'POST', '/api/links', { name, channel, target: 'shop' })).code;
const links = {
  mercyWa: await mk(mercy, 'Mercy’s WhatsApp', 'WhatsApp'), brianWa: await mk(brian, 'Brian’s WhatsApp', 'WhatsApp'),
  tiktok: await mk(owner, 'TikTok bio', 'TikTok'), linkedin: await mk(owner, 'LinkedIn page', 'LinkedIn'), facebook: await mk(owner, 'Facebook page', 'Facebook'),
};
// Visits from different people (each with their own browser id).
const visits = { mercyWa: 34, brianWa: 21, tiktok: 88, linkedin: 12, facebook: 40 };
for (const [k, n] of Object.entries(visits)) for (let i = 0; i < n; i++) await call(null, 'GET', `/l/${links[k]}`, null, { Cookie: `kv=${k}visitor${i % Math.ceil(n * 0.7)}xxxxxxxx` });
const shop = await call(null, 'GET', `/api/public/${slug}`);
const item = (n) => shop.items.find((i) => i.name.startsWith(n))?.id;
const asks = [
  ['tiktok', 'Wanjiku Cafe', '0745100001', 'Do you supply 10 crates of soda weekly to Kilimani?', 'Soda', 'won'],
  ['tiktok', 'Otieno Mini Mart', '0745100002', 'Price for 20 bales of maize flour?', 'Maize flour', 'lost:Price too high'],
  ['tiktok', 'Kevin', '0745100003', 'Do you have 5L cooking oil?', 'Cooking oil', 'lost:Out of stock'],
  ['tiktok', 'Grace Hair Salon', '0745100004', 'Can you deliver drinking water every Monday?', 'Drinking water', 'open'],
  ['mercyWa', 'Hotel Baraka Thika', '0745100005', 'We need drinking water and soda daily for the restaurant.', 'Drinking water', 'won'],
  ['mercyWa', 'Mama Wairimu', '0745100006', 'Sugar 2kg price for 3 bales?', 'Sugar', 'won'],
  ['brianWa', 'St. Mary’s School', '0745100007', 'Quote for rice 5kg x 40 bags for the term.', 'Rice', 'lost:Bought elsewhere'],
  ['linkedin', 'Savannah Caterers Ltd', '0745100008', 'Looking for a monthly supplier of tea leaves and sugar.', 'Tea leaves', 'answered'],
  ['facebook', 'Juma', '0745100009', 'Do you sell toilet paper in bales?', 'Toilet paper', 'lost:No reply from customer'],
  ['facebook', 'Neema Shop Rongai', '0745100010', 'How much is detergent per carton?', 'Detergent', 'lost:Took too long to answer'],
];
for (const [k, name, phone, message, product, outcome] of asks) {
  await call(null, 'POST', `/api/public/${slug}/inquiries`, { name, phone, message, itemId: item(product), ref: links[k] });
}
const list = (await call(owner, 'GET', '/api/inquiries?status=active')).items;
for (const [k, name, , , , outcome] of asks) {
  const inq = list.find((i) => i.name === name);
  const who = k === 'brianWa' ? brian : mercy;
  if (outcome === 'open') continue;
  await call(who, 'POST', `/api/inquiries/${inq.id}/reply`, { text: `Hello ${name.split(' ')[0]}, thank you for asking. Yes, we can help: I'll send you a quote now.` });
  if (outcome === 'answered') continue;
  if (outcome.startsWith('lost:')) { await call(who, 'POST', `/api/inquiries/${inq.id}/close`, { won: false, reason: outcome.slice(5) }); continue; }
  const q = await call(who, 'POST', `/api/inquiries/${inq.id}/quote`, {});
  const doc = (await call(who, 'GET', `/api/sales/${q.quoteId}`)).document;
  await call(who, 'PUT', `/api/sales/${q.quoteId}`, { kind: 'Quote', customerId: doc.customerId, lines: [{ itemId: doc.lines[0].itemId, quantity: 12 }] });
  await call(who, 'POST', `/api/sales/${q.quoteId}/issue`, {});
  const inv = await call(who, 'POST', `/api/sales/${q.quoteId}/to-invoice`, {});
  await call(who, 'POST', `/api/sales/${inv.id}/issue?overLimit=true`, {}).catch(async () => call(owner, 'POST', `/api/sales/${inv.id}/issue?overLimit=true`, {}));
}
// A stock count: most lines match, a few don't.
const stock = (await call(owner, 'GET', '/api/stock')).items.filter((i) => i.total > 0).slice(0, 12);
await call(owner, 'POST', '/api/stock/count', { counts: stock.map((s, i) => ({ itemId: s.id, counted: i % 4 === 0 ? Math.max(0, s.total - 3) : s.total })), note: 'Monthly count' });
console.log(JSON.stringify({ slug, links, inquiries: asks.length, counted: stock.length }));
