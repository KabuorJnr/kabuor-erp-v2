# Kabuor ERP: product brief

An ERP built in Kenya, for how Kenyan businesses actually run: M-Pesa first, KRA-compliant by default,
easy enough that a shop attendant, a storekeeper and an accountant can all use it on day one.
A Kabuor Builds product.

## Why the imported systems don't fit

- **Compliance is bolted on.** KRA's eTIMS (OSCU for always-online, VSCU for offline/bulk invoicing) needs a
  partner add-on in Odoo, Sage and NetSuite. KRA now matches expenses claimed in returns against eTIMS invoices,
  so invoicing outside the core system puts deductions at risk.
- **Payroll rules move every year** (2026: NSSF Tier II limit KSh 108,000; SHIF 2.75%, min KSh 300; Housing
  Levy 1.5% each side; PAYE bands 10/25/30/32.5/35% with KSh 2,400 relief). Foreign systems lag; sources disagree
  on details, so rates must be data, not code.
- **M-Pesa is the bank account** for most customers and suppliers, yet it's an integration project elsewhere.
- **Fit and usability.** Kenyan ERP studies keep finding the clash between ERP-imposed standard processes and
  local ways of working, plus infrastructure gaps (power, connectivity). Screens are built for trained clerks,
  not for the people who actually record the sale.

## What makes Kabuor ERP stand out

1. **Compliance inside the core.** Every invoice is eTIMS-ready (buyer PIN, item tax class, control number, QR).
   Statutory rates (PAYE, SHIF, AHL, NSSF, VAT) are effective-dated tables updated centrally; payslips, P9 and
   iTax return files come out of the box.
2. **M-Pesa native.** Paybill/Till payments (C2B) match to invoices automatically by account number, amount and
   phone; STK prompts to collect; B2C payouts for salaries and suppliers. Cash and bank sit beside it.
3. **Built for the people using it.**
   - Opens on *today's work* ("3 invoices overdue", "KSh 42,000 in M-Pesa to match"), not a module menu.
   - English or Kiswahili, plain words ("Money in", not "Accounts receivable" on the shop floor).
   - Phone-first for field sales and stock counts; keeps working offline and syncs.
   - Invoices, receipts and payslips sent on WhatsApp and SMS.
4. **An assistant that does the work (agentic AI).** Ask in English, Kiswahili or Sheng ("nani hajalipa mwezi
   huu?"). It chases overdue invoices, matches M-Pesa payments, drafts payroll, suggests reorders, and turns a
   photo of a supplier invoice into a bill. **Every action is a proposal a person approves**; every step is in
   the audit log; the assistant only sees what the user's role allows.
5. **Priced and set up the Kabuor way.** Per business, not per seat; working in an afternoon, not a 6-month
   implementation.

## Who it's for

**First customers:** Kenyan businesses with 5–200 staff that sell goods on credit and get paid by M-Pesa:
distributors and wholesalers, small manufacturers and agro-processors (sauces, honey, soaps, feeds), retail
with a few branches, and service firms that invoice. Usually VAT-registered (so eTIMS is mandatory), run today
on Excel + QuickBooks/Tally + an M-Pesa statement, with one bookkeeper doing reconciliation by hand.
**Built-in upgrade path:** Kabuor Builds shop owners whose online orders should flow straight into the ERP.

## The market (October 2026)

- **Global all-in-ones (e.g. Barawave):** "AI Business Operating System", 100+ modules, free tier, AI named per
  job (forecasting, contract clauses, duplicate-invoice "fraud shield"), industry pages, "set up in 5 minutes".
  Priced for Australia (AUD 199 / 599 / 2,499 a month) with PayPal/Stripe; nothing for M-Pesa, eTIMS or Kenyan
  payroll; proof sections still show template placeholders. *Take:* pick-what-you-need setup by use case,
  industry starting points, a free tier, AI features named by the job they do. *Avoid:* breadth over depth,
  dollar pricing, empty social proof.
- **Kenyan software houses (e.g. Beatsy Solutions, Thika/Nairobi, since 2018):** "One technology partner. Every
  business need." Ten separate vertical systems (POS, inventory, schools, hospitals, SACCOs, hotels, property, CRM,
  HR & payroll, ERP) plus websites, apps, hosting, AI chatbots, marketing and a hardware shop; ~150 clients in
  manufacturing, wholesale, retail, schools, SACCOs, hospitals and government. Strong on local plumbing (Daraja
  STK/C2B/B2C, eTIMS, KCB/Equity/NCBA, Africa's Talking, WhatsApp) and on-site support; priced per project
  (websites KSh 15,000–300,000; systems "request a quote"). *Take:* the local integrations list is table stakes,
  vertical starting points sell, WhatsApp-first contact, on-site help matters outside Nairobi. *Avoid:* separate
  systems per vertical that don't share data, custom quotes instead of a price, testimonials from their own staff.
- **Localised open-source (ERPNext, Odoo partners):** have M-Pesa and KRA localisation via partners/modules, but
  carry the imported-ERP learning curve and partner implementation costs.
- **Kenyan single-purpose tools:** payroll/HR (Workpay, KaziQuest, FaidiHR) and eTIMS/POS invoicing tools do one
  job well and leave the business with several disconnected systems.
- **Where Kabuor ERP sits:** between the two. As local as the Kenyan software houses (M-Pesa, eTIMS, statutory
  payroll, Kiswahili, WhatsApp), but one connected product rather than a custom project per client; as modern
  as the global AI suites, but priced in shillings per business, with a published price, and usable without
  an implementation partner. Industry starting points (distribution, manufacturing, retail, services) instead
  of separate systems per industry.

## Modules

| Area | Module | Status |
|---|---|---|
| Front office | Sales (quotes, invoices, WhatsApp sending, eTIMS-ready) | ✅ built |
| | Customer management (customers, statements, leads, pipeline, conversations, follow-ups) | ✅ built |
| | Marketing (segments, SMS and WhatsApp campaigns, opt-outs, sales after) | ✅ built |
| Back office | Finance (double entry, M-Pesa matching, AR/AP, VAT in and out, reports) | ✅ built |
| | Inventory (multi-store stock, average cost, counts, transfers, reorder) | ✅ built |
| | Purchasing (suppliers, orders, bills, paying suppliers) | ✅ built |
| | Human resources & payroll (employees, leave, PAYE/SHIF/Housing Levy/NSSF/NITA, P9, P10 file) | ✅ built |
| | Manufacturing (recipes, capacity, production runs, cost per unit) | ✅ built |
| | Employee self-service (phone sign-in, leave requests, payslips, P9) | ✅ built |
| | Point of sale (till sessions, cash count, M-Pesa tap-to-apply, receipts) | ✅ built |
| Across | Agents: collections, payment matching, restock (Dynamics-style: own identity, approvals, timelines) | ✅ built |
| | Role-based access (one list drives API, menus and Today) | ✅ built |
| Across | Assistant (agentic AI), audit log, roles, Kiswahili, phone-first | ✅ built (assistant needs an API key) |
| Next | Live KRA eTIMS (certification), M-Pesa B2C salary payouts, WhatsApp Business API, Kabuor Shops orders into the ERP, EF migrations + PostgreSQL hosting | planned |

## Principles

- **UI patterns borrowed from Dynamics 365 Business Central:** Role Center (headline + cues), a sticky action
  bar, "Tell me" search across actions and records, FactBoxes. Kept the Dynamics structure but dropped its density:
  plain words instead of codes, phone-first layouts.

- **Front end:** ease of use first. Design for the decision on each screen; numbers always have context
  ("KSh 42,000 of 61,500 paid"); every list has search, filters with counts and a clear next action.
- **Back end:** secure by default (every row belongs to a company and every query is filtered by it; roles
  checked on every endpoint; passwords hashed; all changes audited), fast (indexed by company, paged lists,
  money as whole cents), correct (double-entry: every posting balances or nothing is saved).

## Stack

ASP.NET Core (.NET 10, LTS) · Entity Framework Core (SQLite locally, PostgreSQL in production) · React +
TypeScript (Vite) · Claude API for the assistant.
