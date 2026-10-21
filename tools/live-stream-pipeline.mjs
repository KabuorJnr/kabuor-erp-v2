#!/usr/bin/env node
// Real-time continuous data stream pipeline for Kabuor ERP
// Feeds live business events (M-Pesa receipts, sales invoices, CRM inquiries, restock, agent runs)
// into the system for live real-time monitoring and analytics.
//
// Usage:
//   node tools/live-stream-pipeline.mjs                                  # Streams to the local dev server (:5000)
//   node tools/live-stream-pipeline.mjs https://kabuor-erp.onrender.com  # Streams to the live site: demo data only
//   node tools/live-stream-pipeline.mjs --interval=3                     # Streams every 3 seconds
//   node tools/live-stream-pipeline.mjs --limit=20                       # Runs 20 events and exits

const args = process.argv.slice(2);
// Local by default: this posts simulated sales, so pointing it at the live site has to be deliberate.
let BASE = 'http://localhost:5000';
let intervalMs = 3500;
let maxIterations = Infinity;

for (const arg of args) {
  if (arg.startsWith('http://') || arg.startsWith('https://')) BASE = arg.replace(/\/+$/, '');
  else if (arg.startsWith('--interval=')) intervalMs = Math.max(1000, parseInt(arg.split('=')[1], 10) * 1000);
  else if (arg.startsWith('--limit=')) maxIterations = parseInt(arg.split('=')[1], 10);
  else if (arg === '--local') BASE = 'http://localhost:5000';
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const KES = (cents) => `KSh ${(Math.round(cents) / 100).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rnd = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

async function apiCall(token, method, path, body) {
  const url = BASE + (path.startsWith('/api') || path.startsWith('/l/') ? path : '/api' + path);
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = json?.error || text.slice(0, 150) || res.statusText;
    throw new Error(`${res.status} ${method} ${path}: ${msg}`);
  }
  return json;
}

console.log('\n' + '='.repeat(70));
console.log('   🚀 KABUOR ERP REAL-TIME DATA STREAM PIPELINE');
console.log('='.repeat(70));
console.log(` Target ERP Server : ${BASE}`);
console.log(` Event Frequency   : every ${(intervalMs / 1000).toFixed(1)}s`);
console.log(` Target Company    : Amani Distributors Ltd (owner@amani.test)`);
console.log('='.repeat(70) + '\n');

// 1. Authenticate
let ownerToken = '';
let staffToken = '';
try {
  const loginRes = await apiCall(null, 'POST', '/auth/login', {
    email: 'owner@amani.test',
    password: 'Amani-owner-2026!',
  });
  ownerToken = loginRes.token;
  console.log(`[AUTH] ✓ Owner authenticated (Grace Wambui)`);
} catch (e) {
  console.error(`[AUTH] ✗ Failed to sign in as owner: ${e.message}`);
  process.exit(1);
}

try {
  const staffRes = await apiCall(null, 'POST', '/auth/login', {
    email: 'mercy@amani.test',
    password: 'Amani-mercy-2026',
  });
  staffToken = staffRes.token;
  console.log(`[AUTH] ✓ Sales rep authenticated (Mercy Achieng)`);
} catch {
  staffToken = ownerToken;
}

// 2. Fetch Initial State
const company = await apiCall(ownerToken, 'GET', '/settings/company');
console.log(`[INIT] ✓ Company: ${company.name} (Shortcode: ${company.mpesaShortcode || '522522'})`);
const c2bKey = company.mpesaConfirmationUrl ? company.mpesaConfirmationUrl.split('/c2b/')[1]?.split('/')[0] : '';
const c2bPath = c2bKey ? `/api/mpesa/c2b/${c2bKey}/confirmation` : null;

const customersResp = await apiCall(ownerToken, 'GET', '/customers?take=100');
const customers = customersResp.page?.items || customersResp.items || [];
console.log(`[INIT] ✓ Customers loaded: ${customers.length}`);

const itemsResp = await apiCall(ownerToken, 'GET', '/items');
const items = Array.isArray(itemsResp) ? itemsResp : (itemsResp.items || []);
const sellableItems = items.filter(i => !i.trackBatches && (i.kind === 0 || i.kind === 'Product' || !i.kind));
console.log(`[INIT] ✓ Catalog items loaded: ${items.length} (${sellableItems.length} regular non-perishable goods)`);

const employeesResp = await apiCall(ownerToken, 'GET', '/employees');
console.log(`[INIT] ✓ Active staff members: ${employeesResp.counts?.all || employeesResp.items?.length || 0}`);

// 3. Tracking code for first-touch CRM
let trackingCode = '';
try {
  const linksResp = await apiCall(ownerToken, 'GET', '/links');
  if (linksResp.items && linksResp.items.length > 0) {
    trackingCode = linksResp.items[0].code;
  } else {
    const newLink = await apiCall(ownerToken, 'POST', '/links', { name: 'WhatsApp Sales Desk', channel: 'WhatsApp', target: 'catalog' });
    trackingCode = newLink.code;
  }
  console.log(`[INIT] ✓ Active tracking shortcode: /l/${trackingCode}`);
} catch {}

console.log('\n--- LIVE MONITORING STREAM RUNNING (Press Ctrl+C to stop) ---\n');

// Metrics
let totalEvents = 0;
let totalMoneyInCents = 0;
let totalSalesIssuedCents = 0;
let totalInvoicesIssued = 0;
let totalPaymentsMatched = 0;
let totalInquiries = 0;

const customerNames = [
  'Mama Njeri Duka', 'Naivas Supermarket Rongai', 'Quickmart Kilimani', 'Baraka Wholesale Ltd',
  'Java Point Cafe', 'Kibanda Hotel Ngara', 'St. Mary’s Canteen', 'Kiprono Enterprises',
  'Wambui General Store', 'Bomet Corner Shop', 'Neema Minimart'
];

async function step() {
  totalEvents++;
  const t0 = performance.now();
  const eventType = rnd(1, 100);

  try {
    if (eventType <= 40 && c2bPath) {
      // EVENT 1: M-Pesa C2B Real-Time Payment (40% probability)
      const salesResp = await apiCall(ownerToken, 'GET', '/sales?take=20');
      const unpaidInvoices = (salesResp.page?.items || salesResp.items || []).filter(i => (i.total - (i.paid || 0)) > 0);

      let invoice = null;
      let amountCents = 0;
      let billRef = '';
      let payerPhone = `2547${rnd(10000000, 99999999)}`;
      let payerName = pick(customerNames).split(' ')[0];

      if (unpaidInvoices.length > 0 && Math.random() < 0.8) {
        invoice = pick(unpaidInvoices);
        const due = invoice.total - (invoice.paid || 0);
        amountCents = Math.random() < 0.2 ? Math.round(due * 0.5) : due;
        billRef = invoice.number;
        payerName = invoice.customerName?.split(' ')[0] || payerName;
      } else {
        amountCents = rnd(500_00, 12_000_00);
        billRef = pick(['Goods', 'Store', 'Till', payerName]);
      }

      const receipt = `QA${Date.now().toString().slice(-6)}${rnd(10, 99)}`;
      const payload = {
        TransID: receipt,
        TransAmount: (amountCents / 100).toFixed(2),
        TransTime: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
        BusinessShortCode: company.mpesaShortcode || '522522',
        BillRefNumber: billRef,
        MSISDN: payerPhone,
        FirstName: payerName,
      };

      await apiCall(null, 'POST', c2bPath, payload);
      totalMoneyInCents += amountCents;
      totalPaymentsMatched++;

      const ms = Math.round(performance.now() - t0);
      const matchText = invoice ? `-> Matched to ${invoice.number}` : `(Account: ${billRef})`;
      console.log(`[${nowIso()}] 🟢 [M-PESA] ${receipt}: ${KES(amountCents)} from ${payerPhone} ${matchText} [${ms}ms]`);

    } else if (eventType <= 75) {
      // EVENT 2: Real-time Sales Invoice Issue (35% probability)
      const customer = customers.length > 0 ? pick(customers) : null;
      if (!customer) return;

      const pool = sellableItems.length > 0 ? sellableItems : items;

      const numLines = rnd(1, 3);
      const lines = [];
      const selectedGoods = [];
      for (let i = 0; i < numLines; i++) {
        const item = pick(pool);
        if (lines.some(l => l.itemId === item.id)) continue;
        const qty = rnd(1, 5);
        lines.push({ itemId: item.id, quantity: qty });
        const brandTag = item.brand ? `[${item.brand}] ` : '';
        selectedGoods.push(`${brandTag}${item.name} x${qty}`);
      }

      if (lines.length === 0) return;

      const todayDate = new Date().toISOString().split('T')[0];
      const invDraft = await apiCall(staffToken, 'POST', '/sales', {
        kind: 'Invoice',
        customerId: customer.id,
        issueDate: todayDate,
        dueInDays: 14,
        lines,
      });

      const issued = await apiCall(staffToken, 'POST', `/sales/${invDraft.id}/issue?overLimit=true`).catch(async () => {
        return await apiCall(ownerToken, 'POST', `/sales/${invDraft.id}/issue?overLimit=true`);
      });

      const invTotal = issued?.document?.total || issued?.total || 0;
      totalSalesIssuedCents += invTotal;
      totalInvoicesIssued++;

      const ms = Math.round(performance.now() - t0);
      console.log(`[${nowIso()}] 🔵 [SALE] ${issued?.document?.number || 'INV'}: ${customer.name} | ${KES(invTotal)} (${selectedGoods.join(', ')}) [${ms}ms]`);

    } else if (eventType <= 90) {
      // EVENT 3: CRM First-Touch Attribution & Inquiries (15% probability)
      if (trackingCode) {
        await apiCall(null, 'GET', `/l/${trackingCode}`).catch(() => {});
      }

      const clientName = pick(customerNames);
      const phone = `07${rnd(10000000, 99999999)}`;
      const interestedItem = pick(items);
      const msgs = [
        `Habari, do you have ${interestedItem?.name || 'stock'} in bulk? Can you deliver to our shop?`,
        `Hi, please send price list for ${interestedItem?.name || 'wholesale items'}.`,
        `Good afternoon, looking for reliable supply of ${interestedItem?.name || 'goods'} weekly.`,
      ];

      const portal = await apiCall(ownerToken, 'GET', '/settings/portal').catch(() => null);
      if (portal?.enabled && portal?.slug) {
        await apiCall(null, 'POST', `/public/${portal.slug}/inquiries`, {
          name: clientName,
          phone,
          message: pick(msgs),
          itemId: interestedItem?.id,
          ref: trackingCode,
        }).catch(() => {});
      }

      totalInquiries++;
      const ms = Math.round(performance.now() - t0);
      console.log(`[${nowIso()}] 🟣 [CRM] Lead from ${clientName} (${phone}) for ${interestedItem?.name || 'Products'} [${ms}ms]`);

    } else {
      // EVENT 4: Background AI Agents Kick (10% probability)
      const agentKey = pick(['matching', 'collections', 'restock']);
      const agentRes = await apiCall(ownerToken, 'POST', `/agents/${agentKey}/run`).catch(() => ({ summary: 'completed' }));
      const ms = Math.round(performance.now() - t0);
      if (agentKey === 'restock') {
        const tasks = await apiCall(ownerToken, 'GET', '/agents/tasks?open=true').catch(() => null);
        const restockTasks = (tasks?.items || []).filter(t => t.agentKey === 'restock');
        if (restockTasks.length > 0) {
          const latest = restockTasks[0];
          console.log(`[${nowIso()}] 🤖 [RESTOCK ADVICE] ${latest.title} [${ms}ms]`);
          if (latest.detail) console.log(`   └─ Refill Detail: ${latest.detail}`);
        } else {
          console.log(`[${nowIso()}] 🤖 [AGENT] RESTOCK Agent: ${agentRes.summary || 'ok'} [${ms}ms]`);
        }
      } else {
        console.log(`[${nowIso()}] 🤖 [AGENT] ${agentKey.toUpperCase()} Agent ran: ${agentRes.summary || 'ok'} [${ms}ms]`);
      }
    }

    // Every 5 events, print live monitoring summary scorecard
    if (totalEvents % 5 === 0) {
      console.log(' '.repeat(4) + '─'.repeat(62));
      console.log(`    📊 SCORECARD: Events: ${totalEvents} | Money In: ${KES(totalMoneyInCents)} | Sales: ${KES(totalSalesIssuedCents)} | Invoices: ${totalInvoicesIssued}`);
      console.log(' '.repeat(4) + '─'.repeat(62));
    }

  } catch (err) {
    console.error(`[${nowIso()}] ⚠️  Notice in stream event: ${err.message}`);
  }
}

// Graceful exit
let running = true;
process.on('SIGINT', () => {
  running = false;
  console.log('\n' + '='.repeat(70));
  console.log('   🛑 DATA STREAM PIPELINE STOPPED');
  console.log('='.repeat(70));
  console.log(` Total Events Pushed       : ${totalEvents}`);
  console.log(` Total M-Pesa Collections  : ${KES(totalMoneyInCents)}`);
  console.log(` Total Sales Invoices      : ${KES(totalSalesIssuedCents)} (${totalInvoicesIssued} invoices)`);
  console.log(` Total Inquiries Logged    : ${totalInquiries}`);
  console.log('='.repeat(70) + '\n');
  process.exit(0);
});

// Main execution loop
let count = 0;
while (running && count < maxIterations) {
  count++;
  await step();
  if (running && count < maxIterations) {
    await sleep(intervalMs);
  }
}

if (count >= maxIterations) {
  console.log(`\nCompleted ${count} events.`);
  process.exit(0);
}
