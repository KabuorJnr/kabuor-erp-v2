import sys
sys.path.insert(0, __file__.rsplit('\\', 1)[0])
from docbase import Builder, plain, small, ref

b = Builder(sys.argv[1], 'Kabuor ERP: Confidential Information Memorandum', 'Sale of the Kabuor ERP software business and intellectual property', 'KABUOR ERP · CONFIDENTIAL INFORMATION MEMORANDUM')
P, H1, H2, H3, B, N, T, BOX = b.P, b.H1, b.H2, b.H3, b.B, b.N, b.T, b.BOX

b.cover('Confidential · For qualified buyers only', 'Kabuor ERP', 'Information Memorandum for the sale of a Kenyan cloud ERP: accounting, eTIMS, M-Pesa, stock, payroll, CRM and AI agents in one product',
        ['Offered by Kabuor Builds, Nairobi, Kenya.',
         'Guide price: <b>KSh 3,500,000</b> for the software, intellectual property and documentation, with optional transition support.',
         'This memorandum is confidential and is provided on the terms of the Important Notice on the next page.'],
        [('Document', 'KAB-IM-001, Information Memorandum'), ('Date', '21 October 2026'), ('Seller', 'Kabuor Builds (David Kiragu)'),
         ('Asset', 'Kabuor ERP: source code, intellectual property, documentation, test and simulation tooling, brand name Kabuor ERP'),
         ('Contact', 'David Kiragu, dkiragunderitu@gmail.com'),
         ('Companion documents', 'Kabuor ERP System Documentation (PDF); Legal and Compliance Pack (KAB-LEG-001); API.md; OPERATIONS.md; PRODUCT.md')])

b.story.append(__import__('reportlab.platypus', fromlist=['PageBreak']).PageBreak())
P('<b>Important notice</b>', plain)
P('This Information Memorandum has been prepared by Kabuor Builds (the Seller) solely to help a prospective buyer decide whether to proceed with an evaluation of Kabuor ERP. It is confidential: by accepting it the recipient agrees not to copy it, disclose it, or use it for any other purpose without the Seller’s written consent, and to return or destroy it on request. A signed non-disclosure agreement is required before access to the source code or the data room.')
P('The information is given in good faith from the Seller’s records and tests as at the date above. It has not been independently audited. Forward-looking figures, including the scenarios in section 9, are illustrative and are not forecasts or promises. Price comparisons are drawn from published list prices and may change. Nothing in this document is an offer capable of acceptance; any sale will be on the terms of a signed sale and assignment agreement only. Buyers should carry out their own technical, legal and tax due diligence and take their own advice.')
b.contents()

# ------------------------------------------------------------------ 1
H1('Executive summary')
P('<b>Kabuor ERP</b> is a cloud business system built for Kenyan small and medium businesses. In one product it does what most of them today spread across an accounting package, an M-Pesa statement, a stock book, a payroll spreadsheet and WhatsApp: it issues KRA eTIMS invoices, matches M-Pesa payments to invoices, keeps stock by batch and expiry, buys from suppliers, runs payroll with PAYE, NSSF, SHIF and the Housing Levy, keeps the books in double entry, and manages customers from first inquiry to repeat sale. On top sits <b>Kabuor Intelligence</b>, which follows every customer from the link they clicked to what they bought, and six AI agents that watch the books and propose the next action for a person to approve.')
P('The product is complete, tested and running. Its full engine was exercised in an eight-month simulation of a Nairobi distributor (14,897 real API requests, 1,223 invoices, 1,089 payments, 418 inquiries, six payroll runs), after which the trial balance and balance sheet balanced, receivables matched customers’ balances to the shilling, and the slowest one percent of requests took under 56 milliseconds.')
T('Key facts', [
    ['Item', 'Detail'],
    ['What is for sale', 'The Kabuor ERP software and all intellectual property in it; repository and history; documentation; test suite and simulation tools; the Kabuor ERP name'],
    ['Stage', 'Product complete and deployed; pre-revenue (no paying customers yet)'],
    ['Market', 'Kenyan SMEs: 7.41 million MSMEs, 1.56 million licensed (KNBS, 2016); every business must invoice through eTIMS'],
    ['Pricing built in', 'Starter KSh 1,500, Business KSh 4,500, Growth KSh 9,500 per business per month; a year costs ten months; 30-day free trial; paid by M-Pesa'],
    ['Technology', '.NET 10 and ASP.NET Core API; React 19 and TypeScript web app; PostgreSQL (Neon) or SQLite; Docker on Render'],
    ['Size', 'About 28,000 lines of application code; 239 API endpoints; 57 database tables; 31 screens; 111 automated tests, all passing'],
    ['Compliance', 'Built for the Data Protection Act, 2019 (data export and erasure, processor terms, DPIA), tax record rules and eTIMS'],
    ['Guide price', 'KSh 3,500,000 for the asset; KSh 4,200,000 with three months of transition support; earn-out structures considered'],
], [1.8, 6.4])
H2('Why now')
B(['<b>eTIMS made software mandatory.</b> Since 1 September 2023 every business, VAT-registered or not, must issue invoices through KRA’s eTIMS, and since 1 January 2024 expenses not backed by an eTIMS invoice cannot be deducted for income tax (Income Tax Act s. 16(1)(c), as amended by the Finance Act, 2023). Businesses that kept paper books now need a system.',
   '<b>M-Pesa is how SMEs get paid</b>, yet most accounting products treat it as a bank feed. Kabuor reads Paybill and Till confirmations directly and matches them to invoices, including the common case of a customer typing the wrong account number.',
   '<b>AI that works on the books.</b> Buyers now expect assistants and agents. Kabuor’s are already built around the owner’s approval, which is how a cautious business will accept them.'])

# ------------------------------------------------------------------ 2
H1('The product')
P('Kabuor ERP is one web application that works on a phone, a tablet or a desk computer, in English and Kiswahili. Each business sees only its own records; inside a business, fourteen roles decide who sees and does what. The table lists what a business gets.')
T('Modules', [
    ['Area', 'What it does'],
    ['Sales', 'Quotes, invoices, credit notes and receipts; price lists and bulk units (crate, bale, carton); credit limits with owner override; recurring and overdue tracking; a till (point of sale) that keeps working offline and never records a sale twice'],
    ['Tax (KRA)', 'eTIMS system-to-system (OSCU): invoices signed by KRA with the KRA invoice number, control code and QR code; supplier invoices pulled from eTIMS into purchases; VAT report; withholding VAT and tax certificates'],
    ['M-Pesa', 'Paybill and Till confirmations matched to invoices automatically; STK prompts to customers; statement import and reconciliation; subscription billing by M-Pesa'],
    ['Stock', 'Multiple stores; batches and expiry dates (expired stock cannot be sold); counts with accuracy tracking; transfers; reorder levels; brands; stock valued at average cost in the ledger'],
    ['Buying', 'Purchase orders, supplier bills, expense bills to any account, supplier payments; restock suggestions from sales rates'],
    ['Production', 'Recipes and production runs that consume materials and add finished goods at cost'],
    ['Accounting', 'Double-entry ledger that refuses unbalanced entries; chart of accounts; trial balance, balance sheet, profit and loss, VAT and ageing reports; period-aware reports; opening balances import'],
    ['Payroll and people', 'Employees, PAYE with reliefs, NSSF by tier and year, SHIF, Housing Levy, NITA; HELB, SACCO and advance deductions (with the one-third rule); payslips, P9; leave with balances; an employee self-service portal'],
    ['CRM', 'Leads and pipeline, activities and follow-ups, campaigns by SMS with opt-out, customer profiles'],
    ['Online shop and portal', 'A public shop page per business; customers ask questions, sign in by phone code, see what they owe, pay by M-Pesa and reorder'],
    ['Kabuor Intelligence', 'Tracking links per salesperson and channel (WhatsApp, TikTok, Instagram, LinkedIn, Google...); the journey from first click to sale; what sells and what sits; who buys most; why inquiries do not buy; salesperson of the year'],
    ['KPI dashboard', 'Sixteen KPIs against the owner’s targets, pro-rated through the month, with trend, pace and links; twelve months of charts (sales against target, money in and out, debts by age, channels, best sellers, inquiry funnel)'],
    ['AI', 'Msaidizi, an assistant that answers questions about the books; six agents: payment matching, collections, restock, supplier invoices, order reading from WhatsApp text, and quote-to-invoice audit; custom agents in an agent studio'],
    ['Integrations', 'A public API (v1) for online shops: products, orders and status, with API keys; signed webhooks; CSV import'],
    ['Security and privacy', 'Two-step sign-in, sign out everywhere, lock-out, audit log of every change; export and erasure of a customer’s personal data as the Data Protection Act requires'],
], [1.6, 6.6])

# ------------------------------------------------------------------ 3
H1('Kabuor Intelligence and the agents')
P('Most SME systems record what happened. Kabuor Intelligence explains it, because the system holds the whole chain: the tracking link a person clicked, the question they asked, who answered and how fast, the quote, the invoice, the payment and the stock that left the shelf. From that chain it answers the questions owners actually ask.')
T('Questions answered from the data', [
    ['Owner’s question', 'How Kabuor answers it'],
    ['Which channel brings customers who pay?', 'Visits, inquiries, new customers and revenue by channel and by link'],
    ['Who is my salesperson of the year?', 'Sales, collections, customers brought in and conversion per person, from each person’s own links'],
    ['Why do people ask but not buy?', 'Lost reasons ranked; the step in the funnel where most are lost; answer times'],
    ['What should I order, and what is stuck?', 'Days of stock, items selling without stock, stock not moving, reorder suggestions'],
    ['Who buys most, and who is slipping away?', 'Recency, frequency and value segments: champions, at risk, lost'],
    ['Is the stock in the system what is in the store?', 'Count accuracy, value of differences, items never counted'],
], [2.6, 5.6])
P('The six agents run on a schedule and on demand. Each proposes actions (match this payment, send this reminder, raise this purchase order, check this price change) that a person approves; the owner can let a sure, small action go ahead within a limit. In the eight-month simulation the agents raised 590 items; the collections agent’s reminders were followed by KSh 217,639 of payments, and the audit agent flagged quote-to-invoice price and quantity changes for review.')

# ------------------------------------------------------------------ 4
H1('Technology and architecture')
T('Stack', [
    ['Layer', 'Technology', 'Notes'],
    ['API', '.NET 10, ASP.NET Core minimal APIs, C#', '239 endpoints in clear modules; rate limiting; problem responses'],
    ['Data', 'Entity Framework Core; PostgreSQL in production (Neon), SQLite locally', 'Company isolation on every table; migrations; double-entry ledger service'],
    ['Web', 'React 19, TypeScript, Tailwind CSS 4, Vite', '31 screens; works on phones; strict content security policy'],
    ['Hosting', 'Docker on Render (Frankfurt); Neon PostgreSQL; optional Redis or Valkey cache', 'render.yaml blueprint; health checks; nightly encrypted backup by GitHub Actions'],
    ['Monitoring', 'Sentry (no personal data)', 'Release tagged with the deployed commit'],
    ['AI', 'Anthropic Claude models through the API', 'Tool-using assistant and agents with approval steps'],
    ['Kenya services', 'KRA eTIMS (OSCU), Safaricom Daraja (C2B, STK), Africa’s Talking (SMS)', 'Sandbox and live switches in settings'],
], [1.3, 3.0, 3.9])
P('<b>Running cost.</b> The application runs on a Render Starter instance (from about US$7 a month) with a Neon PostgreSQL database billed by use; a small number of businesses fit comfortably within that. Variable costs are AI usage (paid per request) and SMS. Each new business adds very little fixed cost, which is what makes the subscription prices in section 8 profitable at modest volumes.')

# ------------------------------------------------------------------ 5
H1('Quality and evidence')
H2('Automated tests')
P('111 automated integration tests run the real API against a real database and pass. They cover, among others: VAT and eTIMS invoice signing, M-Pesa matching and duplicate receipts, credit limits, stock by batch and expiry, the ledger staying balanced, payroll statutory amounts, role permissions, one business never seeing another’s data, the KPI scorecard, the owner’s charts, and data export and erasure under the Data Protection Act.')
H2('Eight-month operating simulation')
P('To test the system as a business would use it, a simulation played eight months (March to October 2026) of a Nairobi distributor through the real API, using the staff logins a real business would have, with every agent switched on.')
T('Simulation results', [
    ['Measure', 'Result'],
    ['Requests', '14,897 in 2.3 minutes; median 5 ms; 95th percentile 33 ms; 99th percentile 56 ms; no server errors'],
    ['Customer side', '4,709 link visits; 418 inquiries (414 answered, 264 quoted, 135 bought, 272 lost with reasons); 80 new customers'],
    ['Sales and cash', '1,223 invoices; 1,089 customer payments; 209 supplier payments; credit limits held 147 invoices, the owner allowed 118'],
    ['Stock and buying', '261 restock bills; 10 new products from 2 new suppliers; monthly stock counts'],
    ['People', '6 hires; 6 payroll runs with statutory payments; 13 leave requests; 99 leads'],
    ['Agents', '590 items raised and decided by the owner and accountant'],
    ['Books after eight months', 'Trial balance balanced (KSh 80.8 million each side); balance sheet balanced; receivables equal to customers’ balances exactly (KSh 4,357,265); stock ledger within KSh 940 of stock on hand (0.06%); no negative stock'],
    ['Dashboard speed', 'Every dashboard and intelligence view answered in under 330 ms on the simulated data'],
], [2.0, 6.2])

# ------------------------------------------------------------------ 6
H1('Security, privacy and compliance')
P('The Legal and Compliance Pack (KAB-LEG-001) maps the system to Kenyan law and is available in the data room. In summary:')
B(['<b>Data protection</b>: privacy notice and processor terms written to the Data Protection Act, 2019 and the 2021 Regulations; built-in export (7-day access right) and erasure (14-day right) that keeps only tax records and scrubs the audit log; a completed impact assessment for Intelligence and the agents; a sub-processor and transfer register.',
   '<b>Registration</b>: Kabuor Builds is below the ODPC registration thresholds; voluntary registration (KSh 8,000 for controller and processor) is recommended and can be completed before completion of a sale.',
   '<b>Security</b>: self-assessment against OWASP ASVS Level 1 passed; no known-vulnerable dependencies; strict security headers; hashed passwords with lock-out; two-step sign-in; encrypted secrets; signed webhooks; hashed API keys.',
   '<b>Disclosed incident</b>: on 21 October 2026 an unreviewed commit allowed a published fallback signing key; it was found and fixed the same day, the production key was confirmed never to have been exposed, and a log review found no sign of access (incident INC-2026-001 in the Compliance Pack, closed). A buyer will receive new keys at handover and should rotate all secrets.',
   '<b>eTIMS</b>: OSCU integration is built and tested against the specification; the KRA sandbox test is the next step, followed by integrator certification, for which KRA asks vendors to show at least three qualified technical staff, a requirement a buyer with a team is better placed to meet.'])

# ------------------------------------------------------------------ 7
H1('Market and competition')
H2('The market')
P('Kenya had 7.41 million micro, small and medium enterprises in the last national survey, of which 1.56 million were licensed (Kenya National Bureau of Statistics, 2016). The licensed segment, especially distributors, wholesalers, retailers, restaurants and service firms with two to fifty staff, is Kabuor’s market: they have stock, staff, credit customers and an eTIMS obligation, and most still run on spreadsheets and M-Pesa statements. Capturing one tenth of one percent of licensed businesses (about 1,560) at the built-in average price would be about KSh 65 million a year in subscriptions.')
H2('Competition')
T('Published prices and scope (October 2026)', [
    ['Product', 'Price', 'Scope for a Kenyan SME', 'Kabuor’s position'],
    ['Zoho Books (Kenya edition)', 'KSh 849 to 15,000 per organisation per month, billed annually', 'Strong accounting; eTIMS through the Kenya edition; payroll, CRM and inventory depth vary by plan or need other Zoho apps', 'Cheaper for accounting alone; Kabuor includes Kenyan payroll, M-Pesa matching, stock by batch, CRM and agents in one price'],
    ['Odoo', 'About US$8.95 to 13.60 per user per month (about KSh 1,160 to 1,770), plus an implementation partner', 'Very broad ERP; localisation and setup through partners', 'For a 10-user business Odoo is about KSh 11,600 to 17,700 a month before implementation; Kabuor Business is KSh 4,500, with no implementation project'],
    ['QuickBooks Online', 'US$38 to 340 per month (US list prices; no published Kenya pricing)', 'Accounting; Kenyan statutory payroll and eTIMS are not part of its published plans', 'Kabuor is priced in shillings and paid by M-Pesa, with Kenyan tax and payroll built in'],
    ['Kabuor ERP', 'KSh 1,500 / 4,500 / 9,500 per business per month (3 / 15 / unlimited users)', 'Accounting, eTIMS, M-Pesa, stock, buying, production, payroll, CRM, shop, Intelligence, agents', '—'],
], [1.4, 2.0, 2.4, 2.4], 'Sources: Zoho Books Kenya pricing as published by FNJ & Associates (2026); Odoo Kenya pricelist (oec.sh, updated 1 August 2026) and Business Daily (2026); QuickBooks US pricing (NerdWallet, 2026). Prices change; verify before relying on them.')
H2('Differentiators')
N(['<b>Kenya first, not localised later</b>: eTIMS, M-Pesa, PAYE, NSSF, SHIF, the Housing Levy and the one-third pay rule are built in and tested.',
   '<b>One price per business, not per user</b>: an owner with ten staff does not pay ten licences.',
   '<b>From inquiry to stock in one system</b>: the data chain that powers Kabuor Intelligence does not exist when sales, CRM and stock live in different products.',
   '<b>Agents with a human in the loop</b>: practical automation that a cautious owner will switch on.'])

# ------------------------------------------------------------------ 8
H1('Business model')
P('Kabuor is sold as a subscription per business, paid in advance by M-Pesa, monthly or yearly (a year costs ten months). New businesses get a 30-day free trial with everything; after a 7-day grace, records stay readable but changes wait for payment. Prices are configuration, so they can change without a release.')
T('Plans', [
    ['Plan', 'Monthly', 'Yearly', 'Users', 'Staff on payroll', 'Includes'],
    ['Starter', 'KSh 1,500', 'KSh 15,000', '3', '5', 'Invoices, quotes, the till, M-Pesa matching, stock and suppliers, eTIMS'],
    ['Business', 'KSh 4,500', 'KSh 45,000', '15', '50', 'Everything in Starter, payroll and staff portal, CRM and campaigns, agents and Msaidizi'],
    ['Growth', 'KSh 9,500', 'KSh 95,000', 'Unlimited', 'Unlimited', 'Everything in Business, several branches and stores, priority WhatsApp support'],
], [0.95, 0.95, 1.0, 1.0, 1.1, 3.2])
P('Additional revenue lines a buyer can add: setup and data migration (a fixed fee per business), training, paid custom agents, an accountant partner programme, and a Kenya-hosted tier for schools and clinics (which must keep data in Kenya under Regulation 26 of the Data Protection (General) Regulations, 2021).')

# ------------------------------------------------------------------ 9
H1('Illustrative scenarios')
P('These scenarios show what the built-in prices produce at different numbers of paying businesses. They are not forecasts. They assume a mix of 50% Starter, 40% Business and 10% Growth, giving an average of KSh 3,500 per business per month, and running costs (hosting, AI, SMS, payment charges) of about 15% of revenue.')
T('Subscription revenue at different scales', [
    ['Scenario', 'Paying businesses', 'Monthly revenue', 'Annual revenue', 'Gross margin (about 85%)'],
    ['Conservative (year 1)', '30', 'KSh 105,000', 'KSh 1,260,000', 'KSh 1,071,000'],
    ['Base (year 2)', '100', 'KSh 350,000', 'KSh 4,200,000', 'KSh 3,570,000'],
    ['Ambitious (year 3)', '300', 'KSh 1,050,000', 'KSh 12,600,000', 'KSh 10,710,000'],
    ['0.1% of licensed MSMEs', '1,560', 'KSh 5,460,000', 'KSh 65,520,000', 'KSh 55,692,000'],
], [1.8, 1.3, 1.5, 1.6, 2.0], 'Sales and support staff costs are excluded; they depend on the buyer’s go-to-market plan.')

# ------------------------------------------------------------------ 10
H1('Valuation and the offer')
H2('Basis for the guide price')
T('How the guide price was reached', [
    ['Method', 'Working', 'Indication'],
    ['Cost to rebuild', 'About 8 to 11 developer-months at Kenyan senior rates of KSh 250,000 to 400,000 a month, plus design, testing and Kenya integrations (eTIMS, Daraja, statutory payroll)', 'KSh 3.0 to 4.5 million'],
    ['Pre-revenue software discount', 'Buyers of software without customers typically pay 40 to 70 percent of rebuild cost', 'KSh 1.5 to 3.0 million'],
    ['Strategic value', 'For a buyer who already sells to SMEs (an accounting firm, POS or payments company, telecom reseller), the product saves a year of building and opens subscription revenue', 'Up to about KSh 4.0 million'],
    ['Revenue cross-check', 'At 20 paying businesses the business would trade on two to four times annual revenue', 'KSh 1.4 to 2.9 million'],
], [1.8, 4.6, 1.8])
H2('What is offered')
T('Offer options', [
    ['Option', 'What the buyer gets', 'Price'],
    ['A. Asset purchase', 'All software and intellectual property, repository with history, documentation, tests and simulation tools, the Kabuor ERP name; handover of code and deployment instructions', 'KSh 3,500,000'],
    ['B. Asset purchase with transition', 'Option A plus three months of part-time support: deploying into the buyer’s own accounts, knowledge transfer, help with the eTIMS sandbox test and certification file', 'KSh 4,200,000'],
    ['C. Earn-out', 'Option A for KSh 2,500,000 on completion, plus 20% of subscription revenue for 24 months, capped at KSh 2,000,000', 'KSh 2.5 million plus up to KSh 2.0 million'],
], [1.8, 4.6, 1.8])
P('Payment is through an escrow or an advocate’s client account, released on delivery and verification of the repository. The Seller keeps the Kabuor Builds name and its other products; Kabuor ERP has no customers or customer data to transfer.')

# ------------------------------------------------------------------ 11
H1('Risks and how they are addressed')
T('Risks for a buyer', [
    ['Risk', 'Detail', 'Mitigation'],
    ['No revenue yet', 'Value rests on the product, not on customers', 'Price reflects this; the earn-out option shares the upside; 30-day trial and M-Pesa billing are ready'],
    ['eTIMS not yet certified', 'Businesses need a working eTIMS integration', 'OSCU integration built to KRA’s specification; sandbox test is next; certification needs a team, which a buyer has'],
    ['Single developer; short history', 'Built quickly by one person; about 30 commits since 20 October 2026', 'Clear module structure, 111 tests, full documentation, and the transition option'],
    ['Unreviewed commits', 'Two security findings came from unreviewed commits', 'Both fixed; protect the main branch and require reviews from completion; rotate every secret at handover'],
    ['No independent audit', 'Security reviewed by the developer only', 'OWASP ASVS self-assessment and test evidence in the data room; buyer’s penetration test welcome before completion'],
    ['Hosting abroad', 'Data is in Germany; schools and clinics need Kenyan hosting', 'Docker deployment runs anywhere, including a Kenyan cloud'],
    ['AI provider dependence', 'The assistant and agents use an external model', 'Agents fail safe (a person decides); the model can be changed behind the same interface'],
], [1.6, 3.0, 3.6])

# ------------------------------------------------------------------ 12
H1('Process and next steps')
N(['<b>Expression of interest</b> and a signed non-disclosure agreement.',
   '<b>Due diligence</b>: a live demonstration on the simulated distributor; read-only access to the repository and data room; a technical session with the developer.',
   '<b>Offer</b>: indicating the option (A, B or C), price and conditions.',
   '<b>Agreement</b>: a sale and intellectual-property assignment agreement drawn by advocates (Copyright Act, 2001), with warranties on ownership and no third-party claims.',
   '<b>Completion</b>: payment into escrow; transfer of the repository; rotation of all keys; deployment into the buyer’s accounts; release of funds on verification.'])
H2('Data room index')
T('Available on request after the NDA', [
    ['#', 'Document'],
    ['1', 'Kabuor ERP System Documentation (architecture, modules, roles, costs)'],
    ['2', 'Legal and Compliance Pack (KAB-LEG-001): legal register, ODPC registration, record of processing, DPIA, retention schedule, transfer register, breach procedure, security self-assessment, incident register'],
    ['3', 'Source code repository with full history; README, API.md, OPERATIONS.md, PRODUCT.md'],
    ['4', 'Test suite and latest results (111 passing)'],
    ['5', 'Eight-month simulation tool and results; demonstration logins for the simulated business'],
    ['6', 'Hosting blueprint (render.yaml), database migration and backup workflows'],
], [0.4, 7.8])
P('<b>Contact</b>: David Kiragu, Kabuor Builds, dkiragunderitu@gmail.com.')

# ------------------------------------------------------------------ A
H1('Appendix A: API surface', numbered=False)
P('The API is organised into these route groups: authentication and security; settings, users, API keys and webhooks; customers; items and price lists; sales documents; payments and M-Pesa (C2B confirmation, STK); eTIMS; purchases and suppliers; stock and locations; production; reports; statements and reconciliation; import; payroll, employees, leave and the employee self-service area; CRM and marketing; the till (POS); billing; insights, KPIs and charts; tracking links; inquiries; the public shop and customer portal; agents; the Msaidizi assistant; and the public integration API (v1).')

H1('References', numbered=False)
for r in [
    'Kenya National Bureau of Statistics. (2016). <i>Micro, small and medium establishments (MSME) survey: Basic report</i>. https://www.knbs.or.ke/2016-micro-small-and-medium-enterprises-msme-survey-basic-report-2/',
    'Kenya Revenue Authority. (2023). <i>On-boarding of non-VAT taxpayers on eTIMS</i> [Public notice]. https://www.kra.go.ke/news-center/public-notices/2071-on-boarding-of-non-vat-taxpayers-on-etims',
    'EY. (2023). <i>Kenya requires non-VAT-registered taxpayers to onboard on e-TIMS</i>. https://www.ey.com/en_gl/technical/tax-alerts/kenya-requires-non-vat-registered-taxpayers-to-onboard-on-e-tims',
    'Kenya Revenue Authority. (n.d.). <i>eTIMS system to system integration</i>. https://www.kra.go.ke/business/etims-electronic-tax-invoice-management-system/learn-about-etims/etims-system-to-system-integration',
    'FNJ & Associates. (2026). <i>Zoho Books in Kenya: The complete 2026 guide for SMEs</i>. https://fnjassociates.co.ke/?p=2755',
    'OEC. (2026). <i>Odoo pricing: Kenya</i> (pricelist updated 1 August 2026). https://oec.sh/odoo-pricing/kenya',
    'Business Daily Africa. (2026). <i>How business software firm Odoo is helping Kenyan firms replace fragmented systems</i> [Sponsored]. https://www.businessdailyafrica.com/bd/sponsored/how-business-software-firm-odoo-is-helping-kenyan-firms-5577500',
    'NerdWallet. (2026). <i>QuickBooks pricing 2026: How much does each version cost?</i> https://www.nerdwallet.com/article/small-business/quickbooks-pricing',
    'Data Protection Act, No. 24 of 2019, and the Data Protection (General) Regulations, 2021, Laws of Kenya.',
]:
    P(r, ref)

b.build()
print('built', sys.argv[1])
