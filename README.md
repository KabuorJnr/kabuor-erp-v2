# Kabuor ERP

An ERP built in Kenya for Kenyan businesses: M-Pesa first, KRA eTIMS ready, plain English or Kiswahili, and an
assistant (Msaidizi) that does the work with your approval. A Kabuor Builds product.
Why it exists and who it's for: [docs/PRODUCT.md](docs/PRODUCT.md).

## What works today (slice 1: foundation + sales & finance)

- **Accounts and security:** a business signs up in two minutes; owner adds people with roles (Owner,
  Accountant, Sales, Storekeeper, Viewer). Every record belongs to one company and every query is filtered by
  it in the database layer. Passwords hashed (ASP.NET Identity hasher), 15-minute lockout after 5 wrong tries,
  request limits on sign-in and the assistant, security headers, every change written to an audit log.
- **Sales:** customers, products & services, quotes → invoices with one tap, VAT from VAT-inclusive prices
  (16%, 8%, zero-rated, exempt, non-VAT), drafts editable, issued invoices locked (void + reissue).
- **KRA eTIMS:** issuing signs the invoice (control code + QR link) through an `IEtimsClient`. Today that's a
  sandbox client that validates PINs and marks codes `TEST-`; the real OSCU client needs KRA certification.
- **M-Pesa:** each business gets a private C2B confirmation URL. Payments arrive by themselves (Safaricom retries
  are ignored) and match invoices on strong evidence: invoice number or customer number typed as the account,
  or the customer's phone paying exactly a balance. Weaker evidence becomes a one-tap suggestion. Money that
  arrives before its invoice is matched when the invoice is issued.
- **Books:** real double entry. Invoices, receipts and matches post balanced journal entries (an unbalanced
  entry can't be saved). Unmatched money sits in "Payments not yet matched" so the books are right before anyone
  knows who paid.
- **Reports:** Today (jobs first: overdue, to match, eTIMS problems, drafts; then money in vs last week, owed,
  cash by M-Pesa/bank/cash), profit & loss vs the period before, who owes you by age, VAT by tax type, trial
  balance.
- **Msaidizi (Claude):** ask in English, Kiswahili or Sheng; it answers from the company's data through tools
  limited to the asker's role, and can only *propose* actions (match a payment, WhatsApp reminder), which run
  through the normal service code when a person approves. Needs `ANTHROPIC__APIKEY`.
- **Web app:** React + TypeScript, phone-first (tab bar on phones, sidebar on computers), English/Kiswahili
  switch, WhatsApp share for invoices and reminders, printable invoices.

## Slice 2: buying and stock

- **Suppliers** with what we owe each one, overdue first.
- **Purchase orders → bills:** receiving an order makes a draft bill with the same lines to check against the
  supplier's invoice. Only the owner or an accountant posts bills (they create debt) and pays suppliers;
  storekeepers raise orders, receive goods, count and move stock.
- **Posting a bill:** stocked items go to Stock at their cost before VAT, other lines to the chosen expense
  account, VAT paid to "VAT paid on purchases", the total to "Money we owe suppliers". Paying a bill: Dr owed to
  suppliers, Cr M-Pesa/Bank/Cash. Voiding reverses both the books and the stock.
- **Stock:** several stores, every movement recorded (received, sold, returned, counted, transferred), moving
  average cost, cost of sales posted when an invoice with stocked items is issued (and returned on void),
  stock counts that post losses and finds, transfers that change no money, opening stock against equity,
  low-stock and out-of-stock on Today and the Stock page.
- **VAT:** output VAT less input VAT = VAT payable, with bills missing the supplier's invoice number flagged
  (input VAT isn't claimable without it).

## Slices 3–5: people, customers, making and marketing

- **HR & payroll** (`Payroll/`): employees with a live take-home preview, leave in working days with an annual
  balance, monthly payroll from dated statutory rate sets (`Payroll/Statutory.cs`: PAYE bands and relief, SHIF
  2.75% min KSh 300, Housing Levy 1.5% + 1.5%, NSSF tiers to KSh 108,000 from Feb 2026, NITA KSh 50). HR drafts;
  the owner or an accountant approves (posts gross, deductions and employer costs), records salaries paid and
  each statutory payment (due by the 9th). Payslips on WhatsApp, P9 per employee, a P10 CSV for iTax. Salaries
  are visible only to Owner, Accountant and HR.
- **CRM** (`Crm/`): leads with source and value, a New → Contacted → Quoted → Won/Lost board, conversations
  (call, WhatsApp, visit…) on leads and customers, follow-ups due on Today; winning makes (or links) a customer
  and moves the history; losing needs a reason.
- **Manufacturing** (`Production/`): recipes (what a batch uses and makes, plus labour and running costs),
  "how many batches can this store make" with the limiting ingredient, cost per unit and margin; runs refuse to
  finish without the stock, take ingredients out at average cost and add finished goods at real cost.
- **Marketing** (`Marketing/`): segments (all, recent, lapsed, top, owing, never bought, open leads) with live
  counts and who's left out; personalised messages; SMS through Africa's Talking (test mode without keys, an
  opt-out line on every SMS) or WhatsApp one chat at a time; opted-out customers are never included; results show
  what recipients bought in the 14 days after.

## Employee self-service and the Dynamics-style shell

- **Staff portal** (`SelfEndpoints.cs`, `web/src/pages/MyPortal.tsx`): HR gives an employee app access from their
  record (one-time password, shared on WhatsApp). The employee signs in with their phone and must choose their own
  password before anything else. They then see only their own data: the leave balance (earned so far against
  the year's entitlement), applying for and cancelling leave, payslips from approved runs, their P9, and their
  statutory numbers. Leave they request lands in HR's Leave queue for approval. A leaver loses access automatically.
- **Borrowed from Microsoft Dynamics 365 Business Central:** Today is a *Role Center* with a headline,
  an actions bar and cue tiles grouped by area (Sell, Money, Operations, People), each showing a count that links
  to the filtered list. Every page has a sticky *action bar* under its title. *Tell me* (Ctrl+K or "/") searches
  actions, pages and records (customers, invoices, quotes, items, leads, suppliers, bills, orders and staff,
  each limited by role). Record pages use *FactBox*-style side panels.

## Who sees what

One access list in `Auth/Auth.cs` (`Policies`) drives the API, the sign-in payload (`user.permissions`) and the
app's menu, pages, Today tiles and Tell me. Each part has a "view" and a "change" permission:

| Role | Sees |
|---|---|
| Owner | everything |
| Accountant | sales, money in, books and reports, buying, stock, payroll approval (not the till, CRM or production) |
| Sales | the till (POS), quotes, invoices, customers, money in, pipeline and campaigns |
| Storekeeper | stock, production, purchase orders and receiving (not customers, sales or pay) |
| Procurement | suppliers, orders and bills, stock |
| HR | employees, leave and payroll only |
| Viewer | read-only sales, stock, buying and reports |
| Employee | their own portal only |

## Point of sale

`pages/Pos.tsx` + `PosEndpoints.cs`. No sale without an open till (float counted); each sale is one database
transaction; M-Pesa payments Safaricom already sent are listed to tap (`/pos/mpesa-waiting`) and are applied to
the sale instead of being recorded twice; closing shows expected vs counted cash. Barcode scanners work in the
search box (Enter adds the exact code).

## Agents (agentic AI)

`Agents/` follows Dynamics 365 Business Central's agent design: each agent is its own actor in the audit log,
works with the rights of whoever switched it on (and approving needs the approver's rights), does safe internal
work itself, and turns anything that leaves the business or moves money into a task with a timeline.
`AgentScheduler` runs them in the background (`Agents:TickMinutes`, default 5; `Agents:Disabled` for tests).

- **Collections**: daily; drafts one reminder per customer with overdue invoices (Claude wording when
  `ANTHROPIC__APIKEY` is set, and only if it keeps the real amount; standard wording otherwise). Approve = SMS
  (Africa's Talking) or WhatsApp, logged on the customer.
- **Payment matching**: hourly; applies certain matches, asks about likely ones, flags unknown payments.
- **Restock**: daily; drafts purchase orders to each low item's last supplier at last cost; approve = sent.

## Hosting (Railway)

`Dockerfile` builds the web app and the API into one container; `railway.json` sets the health check. Set
`DATABASE_URL` (Railway Postgres; URLs are converted for Npgsql) and `JWT__KEY` (32+ characters). Optional:
`ANTHROPIC__APIKEY`, Africa's Talking keys. New tables are added on start (`Data/SchemaSync.cs`); new columns
on existing tables still need EF migrations.

## Run it

Needs the .NET 10 SDK and Node 20+.

```bash
cd web && npm install && npm run build      # builds the web app into the API's wwwroot
cd ../src/Kabuor.Erp.Api && dotnet run      # http://localhost:5080 (Development uses a local SQLite file)
```

While working on the screens: `npm run dev` in `web/` (http://localhost:5173, proxies `/api` to :5080).
Tests: `dotnet test` from the repo root (money rules + the whole flow through the real API).

## Configuration (environment variables in production)

| Setting | What |
|---|---|
| `ConnectionStrings__Erp` | PostgreSQL: `Host=…;Database=…;Username=…;Password=…` (SQLite file if not `Host=`) |
| `JWT__KEY` | 32+ random characters; signs sign-in tokens |
| `AFRICASTALKING__USERNAME`, `AFRICASTALKING__APIKEY`, `AFRICASTALKING__SENDERID` | Live SMS for campaigns (test mode without) |
| `ANTHROPIC__APIKEY` | Turns Msaidizi on; `ANTHROPIC__MODEL` to change the model (default `claude-opus-5-5`) |
| `ASPNETCORE_ENVIRONMENT` | `Production` (error details are only shown in Development) |

## Layout

```
src/Kabuor.Erp.Api/
  Domain/        records (money in cents, company-owned rows)
  Data/          ErpDb: company filter, audit trail, concurrency
  Auth/          sign-up, sign-in, roles → policies, tokens
  Accounting/    VAT, double-entry ledger, starter chart of accounts
  Sales/         quotes and invoices
  Payments/      M-Pesa C2B, matching engine (pure, tested), allocation
  Etims/         eTIMS client interface + sandbox
  Reports/       Today, P&L, aging, VAT, trial balance
  Assistant/     Msaidizi: tools, proposals, approval
  Endpoints.cs   every HTTP endpoint
web/             the React app
tests/           xUnit: money rules + API flow
docs/PRODUCT.md  research, audience, market, roadmap
```

## Before the first paying customer

- Switch from `EnsureCreated` to EF Core migrations.
- KRA eTIMS: apply for OSCU certification, build `OscuEtimsClient` against the KRA sandbox.
- Safaricom: register each business's C2B URLs (Daraja `registerurl`), production keys.
- PostgreSQL with daily off-site backups; HTTPS; ODPC registration (customer data).
- Next modules: purchases & bills (input VAT), inventory, HR & payroll (PAYE/SHIF/AHL/NSSF tables), then
  manufacturing and marketing.
