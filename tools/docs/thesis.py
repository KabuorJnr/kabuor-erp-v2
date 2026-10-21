"""Kabuor ERP investment thesis: the case for investing, answered as a series of "why" questions, for a foreign investor.
Usage: python tools/docs/thesis.py docs/Kabuor-ERP-Investment-Thesis.pdf"""
import sys
sys.path.insert(0, __file__.replace('/', '\\').rsplit('\\', 1)[0])
from docbase import Builder, plain, small, ref

b = Builder(sys.argv[1], 'Kabuor ERP: Investment Thesis', 'Why invest in Kabuor ERP: the problem, the timing, the country, the product, the team and the risks', 'KABUOR ERP · INVESTMENT THESIS')
P, H1, H2, B, N, T, BOX = b.P, b.H1, b.H2, b.B, b.N, b.T, b.BOX

b.cover('Confidential · Prepared for investors', 'Why Kabuor', 'The investment thesis for Kabuor ERP: why this problem, why now, why Kenya, why this product, and why invest at this stage',
        ['Kabuor ERP is a Kenya-first cloud business system for small and medium enterprises: KRA eTIMS invoicing, M-Pesa, stock, payroll and customers in one product, with AI agents that watch the books.',
         'Raising: [US$150,000] pre-seed, for 18 months. Figures in brackets are proposals for the founders to confirm.'],
        [('Document', 'KAB-IT-001, Investment Thesis'), ('Date', '21 October 2026'),
         ('Company', 'Kabuor Builds, Nairobi, Kenya'), ('Founders', 'Rooney Odhiambo Kabuor, Founder and Holder, who built the product; David Kiragu, Co-founder [role to confirm]'),
         ('Companion documents', 'Investor pitch deck; Information Memorandum (KAB-IM-001); Legal and Compliance Pack (KAB-LEG-001); System Documentation'),
         ('Contact', 'Rooney Odhiambo Kabuor, Founder and Holder; rooneyodhiambo2004@gmail.com · +254 705 607 954 · linkedin.com/in/rooney-odhiambo'),
         ('Currency', 'Kenya shillings; US dollars at KSh 129 = US$1 where shown')])
b.contents()

H1('The thesis on one page')
P('Kenya has turned business software from a choice into an obligation. Since 1 September 2023 every business must issue invoices through the Kenya Revenue Authority’s eTIMS, and since 1 January 2024 a business cannot deduct an expense for income tax unless it is backed by an eTIMS invoice. At the same time, Kenyan SMEs are paid almost entirely by M-Pesa, whose roughly 40 million monthly users make Kenya one of the deepest mobile-money markets in the world. The tools these businesses use were not built for either fact.')
P('Kabuor ERP was. It is complete, deployed and tested, and it joins in one system what Kenyan SMEs today keep in five: invoices, M-Pesa, stock, payroll and customers. Because everything lives in one place, Kabuor can follow a customer from the link they clicked to the stock that left the shelf, which no combination of separate tools can do, and its AI agents act on that chain with the owner’s approval.')
T('Five questions, five answers', [
    ['Why...', 'Answer'],
    ['this problem?', 'SMEs run on disconnected tools, cannot see what sells or who owes, and now face a tax cost for every missing eTIMS invoice.'],
    ['now?', 'eTIMS made software mandatory (2023 to 2024); M-Pesa is universal; Kenya’s data law (2019) rewards systems built to it.'],
    ['Kenya?', 'The 30% local-ownership rule for ICT firms was removed in 2023; English common law; Nairobi is East Africa’s tech hub; the region is following with its own e-invoicing.'],
    ['Kabuor?', 'Kenya-first, one price per business, a data chain from inquiry to stock, and agents with a human in the loop: built, tested on eight months of simulated business, and compliant.'],
    ['invest now?', 'The product risk is largely retired; the remaining risks (certification, first customers) are exactly what a small round removes, at a pre-revenue entry price.'],
], [1.4, 6.8])

H1('Why this problem')
P('A typical Kenyan distributor, wholesaler or retailer with five to fifty staff keeps its invoices in a paper book or a desktop package, reconciles M-Pesa statements by hand, counts stock in a notebook that never matches the store, runs payroll in a spreadsheet against changing statutory rules (PAYE, NSSF tiers, SHIF and the Housing Levy), and talks to customers on WhatsApp where nobody can measure anything. None of these tools talks to the others, and none of them signs invoices with KRA.')
P('The cost is concrete. The owner cannot answer the questions that decide growth: which products earn the margin, who owes and for how long, what to reorder, which salesperson or channel brings customers who actually pay, and why people who ask do not buy. And since 2024, a supplier invoice that did not go through eTIMS is an expense the business cannot deduct, so poor systems now cost tax, not just time.')

H1('Why now')
H2('The law created the market')
P('Kenya moved from hardware tax devices to software integration, and then made the software universal: eTIMS onboarding applied to all persons carrying on business, VAT-registered or not, from 1 September 2023, and section 16(1)(c) of the Income Tax Act, as amended by the Finance Act, 2023, disallows expenses not supported by an eTIMS invoice from 1 January 2024. Compliance now sends every formal business looking for a system, and accountants are telling their clients so.')
H2('Payments are already digital')
P('Safaricom reported about 40 million monthly active M-Pesa customers in Kenya in March 2026. SMEs collect through Paybill and Till numbers, so the data a business system needs already exists in digital form; what is missing is software that reads it, matches it to invoices and turns it into books.')
H2('A data law that rewards doing it properly')
P('The Data Protection Act, 2019 and its 2021 Regulations set strict rules on how customer and employee data are held, shared and erased. Most SME tools ignore them; Kabuor was built to them, including data export and erasure, processor terms, an impact assessment and a transfer register. As enforcement grows, compliance becomes a reason to choose Kabuor.')

H1('Why Kenya, and why it works for a foreign investor')
B(['<b>Ownership</b>: the requirement that ICT companies have 30% Kenyan ownership, introduced in the 2020 ICT Policy Guidelines, was deleted by gazette notice on 22 August 2023, so foreign investors can hold equity in a Kenyan software company directly.',
   '<b>Market depth</b>: 7.41 million MSMEs, 1.56 million of them licensed (KNBS, 2016), with mobile money as the default way to pay.',
   '<b>Legal familiarity</b>: English-language contracts, common-law courts, a modern data protection regime and a Copyright Act that protects software as a literary work.',
   '<b>Regional runway</b>: Uganda (EFRIS, recently extended to non-VAT businesses in twelve sectors), Rwanda (EBM, second generation since 2017) and Tanzania (EFD and VFD) all require electronic tax invoicing. Kabuor keeps the tax-authority link in its own module, so each country is an integration plus local payroll rules, not a rebuild.',
   '<b>Structure</b>: investors should take their own legal and tax advice on the instrument (equity or SAFE), holding structure and any treaty position.'])

H1('Why Kabuor')
H2('What it is')
P('One web application, usable on a phone, in English and Kiswahili, covering sales and the till, KRA eTIMS, M-Pesa matching and prompts, stock by store, batch and expiry, buying, production, double-entry accounting and reports, payroll with Kenyan statutory deductions and a staff portal, CRM and campaigns, an online shop and customer portal, a KPI dashboard against the owner’s targets, and AI: an assistant and six agents.')
H2('Why it is different')
N(['<b>Kenya first.</b> eTIMS, M-Pesa, PAYE, NSSF tiers, SHIF, the Housing Levy and the one-third pay rule are native and tested, not plug-ins on a foreign product.',
   '<b>One price per business.</b> KSh 1,500, 4,500 or 9,500 a month (about US$12, 35 or 74) for 3, 15 or unlimited users. An owner with ten staff pays one subscription, not ten licences; Odoo at its Kenyan list price would cost such a business KSh 11,600 to 17,700 a month before implementation.',
   '<b>A data chain competitors cannot copy by integration.</b> Kabuor Intelligence links tracking link, inquiry, quote, invoice, M-Pesa payment and stock, so it can say which channel and which salesperson bring paying customers and why inquiries are lost.',
   '<b>Agents an SME owner will switch on.</b> Payment matching, collections, restock, supplier invoices, order reading and quote audit all propose actions that a person approves, with small automatic limits the owner sets.'])
H2('Evidence that it works')
P('There are no paying customers yet, so the evidence is engineering evidence, and it is strong for the stage. 111 automated tests pass against a real database. An eight-month simulation of a Nairobi distributor ran 14,897 requests through the real API with every agent switched on: 1,223 invoices, 1,089 payments, 418 inquiries, six payroll runs. Afterwards the trial balance and balance sheet balanced, receivables matched customers’ balances to the shilling, stock matched the ledger within 0.06%, and 99% of requests took under 56 milliseconds.')

H1('Why it can win')
H2('Go to market')
B(['<b>Accountants and tax agents</b> are the moment of need: each serves dozens of SMEs facing eTIMS. A partner programme makes them the channel.',
   '<b>Distributors and wholesalers first</b>: stock, credit customers and staff are where Kabuor’s depth pays off fastest.',
   '<b>Measured field sales</b>: Kabuor’s own tracking links measure every rep and channel from day one.',
   '<b>Frictionless conversion</b>: a 30-day trial, then an M-Pesa prompt; records stay readable after the trial, so nobody is held hostage.'])
H2('Economics')
P('Running costs (hosting, AI usage, SMS, payment charges) are about 15% of revenue at small scale, giving gross margins near 85%. At the average plan of KSh 3,500 a month, 100 businesses bring about KSh 4.2 million (US$32,600) a year and 1,560 businesses, one tenth of one percent of licensed Kenyan SMEs, about KSh 65.5 million (US$508,000), before any expansion beyond Kenya.')
T('Illustrative scale (not a forecast)', [
    ['Paying businesses', 'Annual revenue (KSh)', 'Annual revenue (US$)'],
    ['30', '1,260,000', '9,800'],
    ['100', '4,200,000', '32,600'],
    ['300', '12,600,000', '97,700'],
    ['1,560 (0.1% of licensed MSMEs)', '65,520,000', '508,000'],
], [3.0, 2.6, 2.6], 'Assumes 50% Starter, 40% Business and 10% Growth plans (average KSh 3,500 a month). Sales and staff costs excluded.')

H1('Why this team')
P('<b>Rooney Odhiambo Kabuor, Founder and Holder</b>, owns the company and built Kabuor ERP end to end: the .NET API, the React application, the KRA eTIMS and Safaricom Daraja integrations, Kenyan payroll, Kabuor Intelligence and the agents, together with its test suite and compliance documentation. [Background and experience to be added.]')
P('<b>David Kiragu, Co-founder</b>. [Role and background to be confirmed.]')
P('The round adds two engineers and a sales lead. That also meets KRA’s requirement that integrator applicants show at least three qualified technical staff.')

H1('Why invest now')
P('The most expensive risk in software, building a product that works, is largely behind Kabuor. What remains is certification with KRA and the first hundred paying businesses, which a small round can buy. An investor entering now pays a pre-revenue price for a product that would cost KSh 3 to 4.5 million (US$23,000 to 35,000) and the better part of a year to rebuild, and participates before the round that will be priced on revenue.')
T('Proposed round', [
    ['Item', 'Proposal'],
    ['Amount', '[US$150,000], pre-seed, for about 18 months'],
    ['Instrument and valuation', '[Equity or SAFE; terms to agree]'],
    ['Use of funds', 'Team: two engineers and a sales lead (70%); go to market and partners (17%); KRA certification, independent security test, legal and ODPC registration (7%); hosting, AI and contingency (6%)'],
    ['Milestones', 'KRA eTIMS integrator certification; ODPC registration and independent security test; 100 paying businesses in Kenya; a Uganda EFRIS pilot'],
], [2.0, 6.2])

H1('What would make us wrong')
P('A thesis is only useful if it says what would disprove it. These are the risks, and how the plan tests them early.')
T('Risks', [
    ['If...', 'Then...', 'How we find out early'],
    ['SMEs will not pay, even for compliance', 'Revenue stalls below the scenarios', 'Conversion from the 30-day trial in the first 90 days of selling'],
    ['KRA certification is slow or refused', 'Larger and VAT-registered customers wait', 'Sandbox test now; certification file filed in the first quarter of the round'],
    ['Zoho or Odoo localise faster and cheaper', 'Price pressure', 'Win rate against them in accountant-led sales; Kabuor’s edge is breadth at one price and the data chain'],
    ['The team cannot sell as well as it builds', 'Slow growth', 'The sales hire and accountant partners; every channel measured by Kabuor’s own links'],
    ['A security or data incident damages trust', 'Lost customers and regulatory action', 'Compliance pack in place; independent test funded; incident response tested on 21 October 2026'],
    ['Hosting abroad limits some sectors', 'Schools and clinics cannot use it (Regulation 26)', 'Kenya-hosted tier when those sectors are targeted'],
], [2.4, 2.4, 3.4])

H1('References', numbered=False)
for r in [
    'Kenya Revenue Authority. (2023). <i>On-boarding of non-VAT taxpayers on eTIMS</i> [Public notice]. https://www.kra.go.ke/news-center/public-notices/2071-on-boarding-of-non-vat-taxpayers-on-etims',
    'EY. (2023). <i>Kenya requires non-VAT-registered taxpayers to onboard on e-TIMS</i>. https://www.ey.com/en_gl/technical/tax-alerts/kenya-requires-non-vat-registered-taxpayers-to-onboard-on-e-tims',
    'Kenya Revenue Authority. (n.d.). <i>eTIMS system to system integration</i>. https://www.kra.go.ke/business/etims-electronic-tax-invoice-management-system/learn-about-etims/etims-system-to-system-integration',
    'Kenya National Bureau of Statistics. (2016). <i>Micro, small and medium establishments (MSME) survey: Basic report</i>. https://www.knbs.or.ke/2016-micro-small-and-medium-enterprises-msme-survey-basic-report-2/',
    'Khusoko. (2026, March 6). <i>M-Pesa turns 19 with 40 million customers as mobile money reshapes Kenya</i>. https://khusoko.com/2026/03/06/m-pesa-turns-19-with-40-million-customers-as-mobile-money-reshapes-kenya/',
    'Afriwise. (2023). <i>Kenya removes 30% local shareholding requirement in ICT sector</i>. https://www.afriwise.com/blog/kenya-removes-30-local-shareholding-requirement-in-ict-sector',
    'Daily Monitor. (2026). <i>URA extends EFRIS coverage to 12 sectors</i>. https://www.monitor.co.ug/uganda/business/markets/ura-extends-efris-coverage-to-12-sectors--5555056',
    'OEC. (2026). <i>Odoo pricing: Kenya</i>. https://oec.sh/odoo-pricing/kenya',
    'FNJ & Associates. (2026). <i>Zoho Books in Kenya: The complete 2026 guide for SMEs</i>. https://fnjassociates.co.ke/?p=2755',
    'Data Protection Act, No. 24 of 2019, and the Data Protection (General) Regulations, 2021, Laws of Kenya.',
]:
    P(r, ref)

b.build()
print('built', sys.argv[1])
