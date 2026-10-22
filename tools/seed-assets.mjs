// Adds a sample asset register (17 items: chairs, laptop, pallet jacks, drill, motorbike) to one business, for demos.
// It signs in with the login you give it and refuses to run if that business already has assets.
//
// Usage (PowerShell):
//   $env:KABUOR_EMAIL="owner@example.com"; $env:KABUOR_PASSWORD="..."; node tools/seed-assets.mjs https://kabuor-erp.onrender.com
// Two-step sign-in on that login: also set $env:KABUOR_CODE to the current 6-digit code.
const BASE = (process.argv[2] ?? '').replace(/\/+$/, '');
const { KABUOR_EMAIL: email, KABUOR_PASSWORD: password, KABUOR_CODE: code } = process.env;
if (!BASE.startsWith('http') || !email || !password) {
  console.error('Usage: set KABUOR_EMAIL and KABUOR_PASSWORD, then: node tools/seed-assets.mjs <site address>');
  process.exit(1);
}

async function call(token, method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${res.status} ${path}: ${json?.error ?? text.slice(0, 200)}`);
  return json;
}

let session = await call(null, 'POST', '/auth/login', { email, password });
if (session.needsCode) {
  if (!code) throw new Error('This login has two-step sign-in: set KABUOR_CODE to the current 6-digit code and run again.');
  session = await call(null, 'POST', '/auth/login/code', { challenge: session.challenge, code });
}
const token = session.token;
console.log(`Signed in to ${session.company.name}.`);

const existing = await call(token, 'GET', '/assets');
if (existing.counts.all > 0 || existing.counts.disposed > 0) {
  console.error(`${session.company.name} already has ${existing.counts.all} assets. Nothing added, so a real register is never mixed with samples.`);
  process.exit(1);
}
const [store] = await call(token, 'GET', '/locations');
const samples = [
  { name: 'Office chair', category: 'FUR', quantity: 12, locationId: store?.id, cost: 4_500_00, supplier: 'Victoria Furniture', purchaseDate: '2026-03-02' },
  { name: 'HP ProBook laptop', category: 'ELC', serialNumber: '5CD2141XQ7', assignedTo: 'Peter Otieno', cost: 72_000_00 },
  { name: 'Pallet jack', category: 'EQP', quantity: 2, locationId: store?.id, cost: 35_000_00 },
  { name: 'Bosch cordless drill', category: 'TLS', assignedTo: 'Joseph Mutua', cost: 14_500_00 },
  { name: 'Delivery motorbike', category: 'VEH', serialNumber: 'KMFG 214Q', assignedTo: 'Samuel Kamau', cost: 165_000_00 },
];
for (const s of samples) {
  const r = await call(token, 'POST', '/assets', s);
  console.log(`  ${r.added} × ${s.name}: ${r.items[0].tag}${r.added > 1 ? ` to ${r.items.at(-1).tag}` : ''}`);
}
const after = await call(token, 'GET', '/assets');
console.log(`Done: ${after.counts.all} assets, KSh ${Math.round(after.totalCost / 100).toLocaleString('en-KE')} at cost. Open ${BASE}/assets`);
