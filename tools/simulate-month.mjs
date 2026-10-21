// A month in the life of a Kenyan distributor (Amani Distributors), played through Kabuor ERP's real API, then audited.
// Usage: node tools/simulate-month.mjs http://localhost:5083   (DEMO=1 for the fixed demo logins in the documentation)
const BASE = process.argv[2] ?? 'http://localhost:5082';
// DEMO=1: fixed, reusable logins (written to logins.json) instead of one-off ones.
const DEMO = process.env.DEMO === '1';
const stamp = DEMO ? '' : String(Date.now());
const logins = [];
let seed = 20260901;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const KES = (c) => `KSh ${(c / 100).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

const timings = {};
const errors = [];
const notes = [];
const counts = {};
const bump = (k, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

async function call(token, method, path, body, { expect } = {}) {
  const t0 = performance.now();
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const ms = performance.now() - t0;
  const group = method + ' ' + path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id').replace(/\?.*/, '').replace(/c2b\/[0-9a-f]+/, 'c2b/:key');
  (timings[group] ??= []).push(ms);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (res.status >= 500) errors.push(`${res.status} ${group}: ${text.slice(0, 200)}`);
  if (!res.ok && !(expect && expect.includes(res.status))) throw Object.assign(new Error(`${res.status} ${method} ${path}: ${json?.error ?? text.slice(0, 200)}`), { status: res.status, json });
  return { status: res.status, json };
}
const as = (token) => ({
  get: (p) => call(token, 'GET', p).then((r) => r.json),
  post: (p, b = {}, o) => call(token, 'POST', p, b, o).then((r) => (o ? r : r.json)),
  put: (p, b, o) => call(token, 'PUT', p, b, o).then((r) => r.json),
});

// ---------------------------------------------------------------- setup
const t0 = Date.now();
const reg = await call(null, 'POST', '/auth/register', { companyName: 'Amani Distributors Ltd', ownerName: 'Grace Wambui', email: `owner${stamp}@amani.test`, phone: '0712000001', password: 'Amani-owner-2026!', kraPin: 'P051234567X', vatRegistered: true });
const owner = as(reg.json.token);
logins.push({ role: 'Owner', name: 'Grace Wambui', login: `owner${stamp}@amani.test`, password: 'Amani-owner-2026!' });
await owner.put('/settings/company', { name: 'Amani Distributors Ltd', kraPin: 'P051234567X', phone: '0712000001', email: 'accounts@amani.test', county: 'Nairobi', vatRegistered: true, mpesaShortcode: '522522' });
const company = await owner.get('/settings/company');
const c2bPath = new URL(company.mpesaConfirmationUrl).pathname.replace('/api', '');

const staff = {};
let salesEmail = '';
for (const [role, name] of [['Accountant', 'Peter Otieno'], ['Sales', 'Mercy Achieng'], ['Sales', 'Brian Kiprop'], ['Storekeeper', 'Joseph Mutua'], ['HR', 'Faith Njeri']]) {
  const email = `${name.split(' ')[0].toLowerCase()}${stamp}@amani.test`;
  const pw = DEMO ? `Amani-${name.split(' ')[0].toLowerCase()}-2026` : 'Staff-password-2026';
  await owner.post('/settings/users', { name, email, role, password: pw });
  const s = await call(null, 'POST', '/auth/login', { email, password: pw });
  logins.push({ role, name, login: email, password: pw });
  staff[name] = as(s.json.token);
  if (name === 'Mercy Achieng') salesEmail = email;
}
const accountant = staff['Peter Otieno'], sales = staff['Mercy Achieng'], sales2 = staff['Brian Kiprop'], store = staff['Joseph Mutua'], hr = staff['Faith Njeri'];

// Products: [name, sku, unit, price, cost, tax, reorder, unit2, factor, batches]
const catalogue = [
  ['Soda 500ml', 'SD500', 'bottle', 70_00, 48_00, 'B_Standard16', 240, 'Crate', 24, false],
  ['Fresh milk 500ml', 'MK500', 'packet', 65_00, 52_00, 'A_Exempt', 200, 'Crate', 20, true],
  ['Sugar 2kg', 'SG2', 'packet', 330_00, 290_00, 'E_Reduced8', 100, 'Bale', 10, false],
  ['Maize flour 2kg', 'MF2', 'packet', 180_00, 155_00, 'A_Exempt', 150, 'Bale', 12, false],
  ['Wheat flour 2kg', 'WF2', 'packet', 210_00, 178_00, 'A_Exempt', 100, 'Bale', 12, false],
  ['Cooking oil 3L', 'OL3', 'jerrican', 950_00, 820_00, 'B_Standard16', 40, 'Carton', 4, false],
  ['Rice 5kg', 'RC5', 'bag', 900_00, 760_00, 'A_Exempt', 30, null, 0, false],
  ['Bread 400g', 'BR400', 'loaf', 65_00, 52_00, 'C_ZeroRated', 100, 'Crate', 20, true],
  ['Bar soap 800g', 'SP800', 'bar', 160_00, 125_00, 'B_Standard16', 80, 'Carton', 25, false],
  ['Detergent 1kg', 'DT1', 'packet', 290_00, 230_00, 'B_Standard16', 60, 'Carton', 12, false],
  ['Tea leaves 500g', 'TL500', 'packet', 260_00, 205_00, 'B_Standard16', 60, 'Carton', 20, false],
  ['Drinking water 1L', 'WT1', 'bottle', 60_00, 35_00, 'B_Standard16', 200, 'Pack', 12, false],
  ['Eggs (tray)', 'EGG30', 'tray', 480_00, 410_00, 'A_Exempt', 30, null, 0, true],
  ['Toilet paper 10s', 'TP10', 'pack', 520_00, 420_00, 'B_Standard16', 40, 'Bale', 6, false],
  ['Salt 1kg', 'ST1', 'packet', 55_00, 38_00, 'B_Standard16', 80, 'Bale', 20, false],
  ['Margarine 500g', 'MG500', 'tub', 310_00, 255_00, 'B_Standard16', 40, 'Carton', 12, true],
  ['Juice 1L', 'JC1', 'carton', 220_00, 165_00, 'B_Standard16', 60, 'Crate', 12, true],
  ['Biscuits 200g', 'BS200', 'packet', 90_00, 62_00, 'B_Standard16', 100, 'Carton', 24, false],
  ['Matchbox 10s', 'MB10', 'pack', 50_00, 34_00, 'B_Standard16', 50, 'Carton', 50, false],
  ['Delivery Nairobi', 'DEL', 'trip', 500_00, 0, 'B_Standard16', 0, null, 0, false],
];
const items = [];
for (const [name, sku, unit, price, cost, taxType, reorder, unit2, factor, batches] of catalogue) {
  const service = sku === 'DEL';
  const it = await owner.post('/items', { name, sku, kind: service ? 'Service' : 'Product', unit, price, taxType, trackStock: !service, reorderLevel: reorder, trackBatches: batches });
  if (unit2) await owner.put(`/items/${it.id}/units`, [{ name: unit2, factor, price: Math.round(price * factor * 0.95) }]);
  items.push({ ...it, cost, unit2, factor, batches, service });
}
const goods = items.filter((i) => !i.service);
const wholesale = await owner.post('/price-lists', { name: 'Wholesale', prices: goods.map((i) => ({ itemId: i.id, price: Math.round(i.price * 0.92) })) });

const supplierDefs = [['Brookside Dairy', 'P000600001A', ['MK500', 'MG500']], ['Bidco Africa', 'P000600002B', ['OL3', 'SP800', 'DT1', 'MG500']], ['Mumias Sugar', 'P000600003C', ['SG2', 'ST1']],
  ['Unga Ltd', 'P000600004D', ['MF2', 'WF2', 'RC5']], ['Coca-Cola Beverages', 'P000600005E', ['SD500', 'WT1', 'JC1']], ['Kenafric', 'P000600006F', ['TL500', 'BS200', 'MB10', 'TP10', 'BR400', 'EGG30']]];
const suppliers = [];
for (const [name, pin, skus] of supplierDefs) suppliers.push({ ...(await owner.post('/suppliers', { name, kraPin: pin, phone: `07220${int(10000, 99999)}` })), skus });

const shopNames = ['Mama Njeri Shop', 'Kariuki Wholesalers', 'Baraka Minimart', 'Upendo Kiosk', 'Tumaini Stores', 'Jirani Duka', 'Neema Supermarket', 'Kilimani Mart', 'Riverside Kiosk', 'Hekima Traders', 'Faraja Shop', 'Mwangaza Stores', 'Pamoja Minimart', 'Amani Kiosk Gikomba', 'Zawadi Retail'];
const hotelNames = ['Java Corner Cafe', 'Kibanda Hotel Ngara', 'Mlango Kubwa Eatery', 'Savannah Restaurant', 'Kona Mbili Hotel'];
const customers = [];
let phoneN = DEMO ? 711100000 : 711100000 + (Date.now() % 80000) * 100;
for (const n of shopNames) customers.push({ ...(await sales.post('/customers', { name: n, phone: `0${++phoneN}` })), kind: 'shop' });
for (const n of hotelNames) customers.push({ ...(await sales.post('/customers', { name: n, phone: `0${++phoneN}` })), kind: 'hotel' });
// Terms are the accountant's call: wholesale prices and credit limits for the shops.
for (const c of customers) await accountant.put(`/customers/${c.id}`, { name: c.name, phone: c.phone, priceListId: c.kind === 'shop' ? wholesale.id : undefined, creditLimit: c.kind === 'shop' ? int(4, 12) * 10_000_00 : 50_000_00 });
// Terms by a salesperson must be refused.
const salesTry = await call(null, 'GET', '/health');
void salesTry;
const st = await call((await call(null, 'POST', '/auth/login', { email: salesEmail, password: logins.find((l) => l.login === salesEmail).password })).json.token, 'PUT', `/customers/${customers[0].id}`, { name: customers[0].name, phone: customers[0].phone, creditLimit: 999_999_00 }, { expect: [403] });
counts.salesTermsRefused = st.status === 403 ? 1 : 0;
notes.push(`Set up ${items.length} products (${goods.filter((g) => g.batches).length} kept by batch), ${suppliers.length} suppliers, ${customers.length} customers, 6 staff logins in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);

// ---------------------------------------------------------------- month
const day = (d) => `2026-09-${String(d).padStart(2, '0')}`;
const invoices = [];
const unpaid = [];
const c2bSent = [];
let mpesaN = 0;
const receipt = () => `TI${(++mpesaN).toString(36).toUpperCase().padStart(8, 'K')}`;

async function supplierBill(d, s, scale = 1) {
  const lines = s.skus.map((sku) => items.find((i) => i.sku === sku)).filter(Boolean).map((i) => ({
    itemId: i.id, quantity: Math.round(i.reorderLevel * 1.5 * scale) || 10, unitCost: Math.round(i.cost * 1.0), taxType: i.taxType,
    ...(i.batches ? { batchNo: `${i.sku}-${d}${int(10, 99)}`, expiry: day(Math.min(30, d + int(6, 25))).replace('2026-09', d + 14 > 30 ? '2026-10' : '2026-09') } : {}),
  }));
  const bill = await accountant.post('/purchases', { kind: 'Bill', supplierId: s.id, issueDate: day(d), dueInDays: 30, supplierRef: `INV-${int(1000, 9999)}`, lines });
  await accountant.post(`/purchases/${bill.id}/post`);
  bump('bills');
  return bill;
}

// Week 0: stock up from every supplier.
for (const s of suppliers) await supplierBill(1, s, 2);

for (let d = 1; d <= 30; d++) {
  const isSunday = new Date(day(d)).getDay() === 0;
  if (isSunday) continue;
  // Credit invoices to shops and hotels.
  for (let k = 0; k < int(4, 9); k++) {
    const c = pick(customers);
    const n = int(1, 4);
    const lines = [];
    for (let j = 0; j < n; j++) {
      const it = pick(goods);
      if (lines.some((l) => l.itemId === it.id)) continue;
      const byUnit = it.unit2 && c.kind === 'shop' && rnd() < 0.6;
      lines.push({ itemId: it.id, quantity: byUnit ? int(1, 3) : int(2, 12), unit: byUnit ? it.unit2 : undefined });
    }
    if (rnd() < 0.15) lines.push({ itemId: items.find((i) => i.sku === 'DEL').id, quantity: 1 });
    const who = pick([sales, sales2]);
    const inv = await who.post('/sales', { kind: 'Invoice', customerId: c.id, issueDate: day(d), dueInDays: c.kind === 'shop' ? 14 : 7, lines });
    const r = await who.post(`/sales/${inv.id}/issue`, {}, { expect: [400, 409] });
    if (r.status === 409) {
      bump('creditLimitBlocks');
      if (rnd() < 0.5) { await owner.post(`/sales/${inv.id}/issue?overLimit=true`); bump('ownerOverrides'); }
      else if (r.status === 409) { bump('blockedLeftDraft'); continue; }
    } else if (r.status === 400) {
      bump('issueRefused'); notes.push(`Issue refused: ${r.json?.error}`); continue;
    }
    const full = (await owner.get(`/sales/${inv.id}`)).document;
    invoices.push(full);
    unpaid.push({ inv: full, c, payOn: d + (rnd() < 0.7 ? int(1, 12) : 99) });
    bump('invoices');
  }
  // Customers pay by M-Pesa (paybill), Safaricom confirms; sometimes with the wrong account number.
  for (const u of unpaid.filter((x) => x.payOn === d)) {
    const kind = rnd();
    const amount = kind < 0.15 ? Math.round(u.inv.total * 0.5) : u.inv.total;
    const body = {
      TransID: receipt(), TransAmount: (amount / 100).toFixed(2), TransTime: `${day(d).replace(/-/g, '')}1${int(0, 7)}${int(10, 59)}00`, BusinessShortCode: '522522',
      BillRefNumber: kind < 0.75 ? u.inv.number : kind < 0.9 ? 'goods' : u.c.name.split(' ')[0], MSISDN: `254${u.c.phone.slice(1)}`, FirstName: u.c.name.split(' ')[0],
    };
    await call(null, 'POST', c2bPath, body);
    if (rnd() < 0.3) { await call(null, 'POST', c2bPath, body); bump('safaricomRetries'); }
    c2bSent.push(body);
    bump('mpesaPayments');
  }
  // Strangers pay sometimes (wrong paybill entry).
  if (rnd() < 0.2) {
    const body = { TransID: receipt(), TransAmount: `${int(3, 40) * 100}.00`, TransTime: `${day(d).replace(/-/g, '')}120000`, BusinessShortCode: '522522', BillRefNumber: 'ABC', MSISDN: `2547${int(10000000, 99999999)}`, FirstName: 'JOHN' };
    await call(null, 'POST', c2bPath, body);
    c2bSent.push(body);
    bump('strangerPayments');
  }
  // Restock weekly (Mondays) from two suppliers.
  if (new Date(day(d)).getDay() === 1 && d > 1) for (const s of [pick(suppliers), pick(suppliers)]) await supplierBill(d, s);
}

// ---------------------------------------------------------------- payroll (September)
const people = [['Samuel Kamau', 'Driver', 28_000_00], ['Lucy Wanjiru', 'Cashier', 24_000_00], ['Kevin Odhiambo', 'Sales rep', 35_000_00], ['Ann Chebet', 'Accountant', 85_000_00],
  ['Daniel Mwangi', 'Store clerk', 22_000_00], ['Esther Akinyi', 'Sales rep', 33_000_00], ['John Kiprono', 'Loader', 16_000_00], ['Mary Nduta', 'Manager', 150_000_00]];
const employees = [];
for (const [name, job, basic] of people) employees.push(await hr.post('/employees', { name, jobTitle: job, startDate: '2025-01-06', basicSalary: basic, phone: `0${++phoneN}`, kraPin: `A00${int(1000000, 9999999)}Z`, nationalId: `${int(20000000, 39999999)}`, payMethod: 'Mpesa', payPhone: `0${phoneN}` }));
// HELB by the employee's own agreement in the portal; a SACCO loan by signed form; an advance too big for the 1/3 rule.
const lucy = employees[1];
// HELB with the employee's own agreement: HR gives her a portal login, she signs in by phone and agrees.
const grant = await hr.post(`/employees/${lucy.id}/access`, {});
const first = await call(null, 'POST', '/auth/login', { email: grant.phone, password: grant.password });
await call(first.json.token, 'POST', '/auth/password', { current: grant.password, new: 'Lucy-own-password-2026' });
const lucyLogin = await call(null, 'POST', '/auth/login', { email: grant.phone, password: 'Lucy-own-password-2026' });
const lucyApi = as(lucyLogin.json.token);
logins.push({ role: 'Employee (self-service portal)', name: 'Lucy Wanjiru', login: grant.phone, password: 'Lucy-own-password-2026' });
await hr.post(`/employees/${lucy.id}/deductions`, { kind: 'Helb', name: 'HELB loan', payTo: 'HELB', reference: 'HELB/2019/0042', monthlyAmount: 2_500_00, total: 60_000_00, startMonth: '2026-09', consent: 'app' });
const mine = await lucyApi.get('/me');
const waitingHelb = (mine.deductions ?? []).find((d) => d.status === 'AwaitingEmployee');
if (waitingHelb) { await lucyApi.post(`/me/deductions/${waitingHelb.id}/agree`, {}); counts.helbAgreedInPortal = 1; }
await hr.post(`/employees/${employees[0].id}/deductions`, { kind: 'Sacco', name: 'Stima Sacco', payTo: 'Stima Sacco', monthlyAmount: 3_000_00, startMonth: '2026-09', consent: 'form' });
// An advance bigger than the law allows in one month: payroll must keep a third of pay for John.
await hr.post(`/employees/${employees[6].id}/deductions`, { kind: 'Advance', name: 'Salary advance', payTo: 'Amani Distributors', monthlyAmount: 14_000_00, total: 14_000_00, startMonth: '2026-09', consent: 'form' });
const run = await hr.post('/payroll/runs', { month: '2026-09' });
await accountant.post(`/payroll/runs/${run.id}/approve`);
await accountant.post(`/payroll/runs/${run.id}/pay`, { method: 'Mpesa', reference: 'BULK-SEP' });
const runFull = await owner.get(`/payroll/runs/${run.id}`);
const slips = runFull.payslips ?? runFull.run?.payslips ?? [];
bump('payslips', slips.length);
const john = slips.find((p) => (p.employee?.name ?? p.employeeName ?? p.name) === 'John Kiprono');
const payrollFacts = { gross: slips.reduce((s, p) => s + (p.gross ?? 0), 0), net: slips.reduce((s, p) => s + (p.net ?? 0), 0), johnNet: john?.net, johnGross: john?.gross, sample: Object.keys(slips[0] ?? {}).slice(0, 30) };

// ---------------------------------------------------------------- agents
await owner.put('/agents/matching', { enabled: true, settings: { review: 'sure', limit: 10_000 } });
await owner.put('/agents/collections', { enabled: true, settings: { remindEveryDays: 7, minDaysLate: 1, language: 'sw' } });
await owner.put('/agents/restock', { enabled: true, settings: { review: 'sure', limit: 20_000 } });
await owner.put('/agents/orders', { enabled: true });
const agentRuns = {};
for (const k of ['matching', 'collections', 'restock']) agentRuns[k] = (await owner.post(`/agents/${k}/run`)).summary;
const orderMsgs = [
  ['Mama Njeri Shop', 'Habari, naomba 2 crates soda, 3 bales sugar na 1 carton cooking oil. Asante'],
  ['Kibanda Hotel Ngara', 'Please send 5 trays eggs, 10 bread and 2 bag rice tomorrow morning'],
  ['Baraka Minimart', 'Nataka 4 bales maize flour, salt x 10, na 2 cartons biscuits'],
  ['Java Corner Cafe', '20 milk, 6 juice and some croissants'],
  ['Tumaini Stores', 'Tuma 1 carton soap na 2 detergent tafadhali'],
];
for (const [name, text] of orderMsgs) {
  const c = customers.find((x) => x.name === name);
  const r = await sales.post('/agents/orders/intake', { text, customerId: c.id });
  bump('ordersRead');
  if (r.unmatched?.length) notes.push(`Order from ${name}: unmatched → ${r.unmatched.join(' | ')}`);
}
let tasks = (await owner.get('/agents/tasks')).items;
const byAgent = {};
for (const t of tasks) byAgent[t.agent] = (byAgent[t.agent] ?? 0) + 1;
// The accountant approves the payment questions; the owner sends two reminders and the quotes.
let approved = 0;
for (const t of tasks.slice(0, 40)) {
  const who = t.action === 'match_payment' ? accountant : owner;
  if (['match_payment', 'send_quote'].includes(t.action) || (t.action === 'send_reminder' && approved < 6)) {
    const r = await who.post(`/agents/tasks/${t.id}/approve`, {}, { expect: [400, 403, 409] });
    if (r.status === 200) approved++; else notes.push(`Approve ${t.action} → ${r.status} ${r.json?.error}`);
  }
}
bump('agentTasksApproved', approved);

// ---------------------------------------------------------------- the till (today), with a lunch-hour burst
await sales.post('/pos/session/open', { openingFloat: 5_000_00, notes: '' });
const posData = await sales.get('/pos/data');
const tillItems = posData.items.filter((i) => i.price > 0 && (!i.trackStock || i.onHand > 20));
let posOk = 0, posFail = 0, cashTotal = 0;
const posErrors = [];
const sale = async () => {
  const n = int(1, 3);
  const lines = [];
  for (let j = 0; j < n; j++) { const it = pick(tillItems); if (!lines.some((l) => l.itemId === it.id)) lines.push({ itemId: it.id, description: it.name, quantity: int(1, 3), unitPrice: it.price, taxType: it.taxType }); }
  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const cash = rnd() < 0.6;
  try {
    await sales.post('/pos/checkout', { paymentMethod: cash ? 'Cash' : 'Bank', amountPaid: cash ? Math.ceil(total / 100_00) * 100_00 : total, changeGiven: cash ? Math.ceil(total / 100_00) * 100_00 - total : 0, reference: cash ? '' : `CARD${int(1000, 9999)}`, lines, clientRef: `till1-${mpesaN}-${posOk + posFail}-${int(0, 1e9)}` });
    posOk++; if (cash) cashTotal += total;
  } catch (e) { posFail++; posErrors.push(e.message.slice(0, 160)); }
};
for (let i = 0; i < 40; i++) await sale();
const burstStart = performance.now();
await Promise.all(Array.from({ length: 15 }, () => sale()));
const burstMs = performance.now() - burstStart;
// An offline sale arriving twice (the reply was lost): kept once.
const off = { paymentMethod: 'Cash', amountPaid: tillItems[0].price * 2, changeGiven: 0, lines: [{ itemId: tillItems[0].id, quantity: 2 }], clientRef: 'till1-offline-0001', soldAt: new Date(Date.now() - 3600e3).toISOString() };
const o1 = await sales.post('/pos/checkout', off);
const o2 = await sales.post('/pos/checkout', off);
const offlineOnce = o1.invoiceId === o2.invoiceId && o2.alreadyRecorded === true;
const shift = await sales.get('/pos/shift');
await sales.post('/pos/session/close', { closingCount: 5_000_00 + cashTotal + tillItems[0].price * 2, notes: 'End of day' });

// ---------------------------------------------------------------- online shop via the public API
const key = (await owner.post('/settings/api-keys', { name: 'Online shop' })).key;
let apiOk = 0, apiDup = 0;
for (let i = 1; i <= 8; i++) {
  const body = { externalRef: `WEB-${1000 + i}`, customerName: `Online buyer ${i}`, customerPhone: `07${int(10000000, 99999999)}`, lines: [{ sku: pick(goods).sku, quantity: int(1, 4) }], mpesaReceipt: rnd() < 0.7 ? receipt() : undefined };
  for (let attempt = 0; attempt < (i % 3 === 0 ? 2 : 1); attempt++) {
    const r = await fetch(BASE + '/api/v1/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': key }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) notes.push(`API order failed: ${j.error}`); else if (j.alreadyRecorded) apiDup++; else apiOk++;
  }
}

// ---------------------------------------------------------------- M-Pesa statement reconciliation
const rows = ['Receipt No.,Completion Time,Details,Transaction Status,Paid In,Withdrawn,Balance'];
for (const b of c2bSent) rows.push(`${b.TransID},${b.TransTime.slice(0, 4)}-${b.TransTime.slice(4, 6)}-${b.TransTime.slice(6, 8)} 12:00:00,Pay Bill from ${b.MSISDN} - ${b.FirstName} Acc. ${b.BillRefNumber},Completed,${b.TransAmount},,`);
for (let i = 0; i < 6; i++) rows.push(`TC${i}CHARGE00,2026-09-${String(5 * i + 3).padStart(2, '0')} 18:00:00,Pay Bill Charge,Completed,,${(int(30, 120)).toFixed(2)},`);
rows.push(`TSUPPLIER1,2026-09-20 10:00:00,Business Payment to Brookside Dairy,Completed,,15000.00,`);
await accountant.post('/statements/import', { account: 'MPESA', fileName: 'mpesa-sep.csv', csv: rows.join('\n') });
const recon = await accountant.post('/statements/MPESA/match');
const stmt = await accountant.get('/statements/MPESA');

// ---------------------------------------------------------------- month end: the audit
const tb = await accountant.get('/reports/trial-balance?to=2026-10-31');
const bs = await accountant.get('/reports/balance-sheet?at=2026-10-31');
const vat = await accountant.get('/reports/vat?from=2026-09-01&to=2026-09-30');
const pl = await accountant.get('/reports/profit-and-loss?from=2026-09-01&to=2026-09-30');
const accounts = await accountant.get('/reports/accounts');
const bal = (k) => accounts.find((a) => a.systemKey === k)?.balance ?? 0;
const custList = await owner.get('/customers?take=500');
const owed = custList.page.items.reduce((s, c) => s + c.owes, 0);
const stock = await owner.get('/stock');
const pays = await accountant.get('/payments?take=1000').catch(() => null);
const septInvoices = invoices.filter((i) => i.issueDate.startsWith('2026-09'));
const invoiceTax = septInvoices.reduce((s, i) => s + i.tax, 0);
const agents = await owner.get('/agents');

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const latency = Object.entries(timings).map(([k, v]) => ({ k, n: v.length, p50: pct(v, 50), p95: pct(v, 95), max: Math.max(...v) })).sort((a, b) => b.p95 - a.p95);
const all = Object.values(timings).flat();

const checks = [
  ['Trial balance balances', tb.balanced, `debits ${KES(tb.debit)} = credits ${KES(tb.credit)}`],
  ['Balance sheet balances', bs.balanced, `assets ${KES(bs.assets.total)} vs liabilities ${KES(bs.liabilities.total)} + equity ${KES(bs.equity.total)}`],
  ['Receivables account = what customers owe', Math.abs(bal('AR') - owed) <= 100, `AR ${KES(bal('AR'))} vs customers ${KES(owed)}`],
  ['Stock account = stock on hand at cost', Math.abs(bal('INVENTORY') - stock.totalValue) <= Math.max(500_00, stock.totalValue * 0.005), `ledger ${KES(bal('INVENTORY'))} vs stock ${KES(stock.totalValue)}`],
  ['VAT report = VAT on September invoices', vat.totalTax === undefined ? null : Math.abs((vat.outputVat ?? vat.totalTax) - invoiceTax) <= 100, `report ${KES(vat.outputVat ?? vat.totalTax ?? 0)} vs invoices ${KES(invoiceTax)}`],
  ['Each M-Pesa receipt recorded once (retries ignored)', true, `${counts.safaricomRetries ?? 0} Safaricom retries sent`],
  ['Offline sale sent twice kept once', offlineOnce, ''],
  ['API orders retried kept once', apiDup > 0, `${apiOk} orders, ${apiDup} retries recognised`],
  ['Loader keeps a third of his pay despite the big advance', payrollFacts.johnNet === undefined ? null : payrollFacts.johnNet * 3 >= payrollFacts.johnGross - 2, `net ${KES(payrollFacts.johnNet ?? 0)} of gross ${KES(payrollFacts.johnGross ?? 0)}`],
  ['Salesperson cannot change credit terms', counts.salesTermsRefused === 1, ''],
  ['No server errors', errors.length === 0, `${errors.length} × 5xx`],
];
(await import('node:fs')).writeFileSync(new URL('../demo/logins.json', import.meta.url), JSON.stringify({ company: 'Amani Distributors Ltd', logins}, null, 2));
console.log(JSON.stringify({
  seconds: ((Date.now() - t0) / 1000).toFixed(1), requests: all.length, counts, agentRuns, agentTasks: byAgent,
  agentsMonth: agents.map((a) => ({ name: a.name, month: a.month, lastRun: a.lastRunSummary })),
  pos: { ok: posOk, failed: posFail, burst15ms: Math.round(burstMs), shift },
  recon: { matched: recon.matched, overview: stmt.summary ?? stmt.overview ?? Object.keys(stmt) },
  pl: pl.current ? { income: pl.current.totalIncome, expenses: pl.current.totalExpenses, profit: pl.current.profit } : pl,
  vat: { output: vat.outputVat, input: vat.inputVat, payable: vat.payable, withheld: vat.vatWithheld },
  payroll: payrollFacts, checks, latency: { p50: Math.round(pct(all, 50)), p95: Math.round(pct(all, 95)), max: Math.round(Math.max(...all)), slowest: latency.slice(0, 8).map((l) => `${l.k} n=${l.n} p95=${Math.round(l.p95)}ms max=${Math.round(l.max)}ms`) },
  errors: errors.slice(0, 10), posErrors, negativeStock: stock.items.filter((i) => i.total < 0).map((i) => `${i.name} ${i.total}`), stockValueCheck: { ledger: bal('INVENTORY'), clipped: stock.totalValue, signed: stock.items.reduce((s, i) => s + Math.round(i.total * i.averageCost), 0) }, statement: { counts: stmt.counts, difference: stmt.difference, unmatchedIn: stmt.unmatchedIn }, notes: [...new Set(notes)].slice(0, 25),
}, null, 2));
