# Kabuor ERP system documentation, APA 7th edition style, black and white, Times New Roman.
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, Table, TableStyle,
                                KeepTogether, NextPageTemplate, CondPageBreak)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon

OUT = sys.argv[1]
F = r'C:\Windows\Fonts'
pdfmetrics.registerFont(TTFont('TNR', F + r'\times.ttf'))
pdfmetrics.registerFont(TTFont('TNR-B', F + r'\timesbd.ttf'))
pdfmetrics.registerFont(TTFont('TNR-I', F + r'\timesi.ttf'))
pdfmetrics.registerFont(TTFont('TNR-BI', F + r'\timesbi.ttf'))
addMapping('TNR', 0, 0, 'TNR'); addMapping('TNR', 1, 0, 'TNR-B'); addMapping('TNR', 0, 1, 'TNR-I'); addMapping('TNR', 1, 1, 'TNR-BI')

BLACK = colors.black
LEAD = 24  # double spacing at 12 pt
body = ParagraphStyle('body', fontName='TNR', fontSize=12, leading=LEAD, firstLineIndent=0.5 * inch, alignment=TA_LEFT, textColor=BLACK)
plain = ParagraphStyle('plain', parent=body, firstLineIndent=0)
center = ParagraphStyle('center', parent=plain, alignment=TA_CENTER)
h1 = ParagraphStyle('h1', fontName='TNR-B', fontSize=12, leading=LEAD, alignment=TA_CENTER, spaceBefore=0, spaceAfter=0, textColor=BLACK)
h2 = ParagraphStyle('h2', fontName='TNR-B', fontSize=12, leading=LEAD, alignment=TA_LEFT, textColor=BLACK)
h3 = ParagraphStyle('h3', fontName='TNR-BI', fontSize=12, leading=LEAD, alignment=TA_LEFT, textColor=BLACK)
cell = ParagraphStyle('cell', fontName='TNR', fontSize=10.5, leading=13, textColor=BLACK)
cellb = ParagraphStyle('cellb', parent=cell, fontName='TNR-B')
label = ParagraphStyle('label', parent=plain, fontName='TNR-B', leading=LEAD)
ttl = ParagraphStyle('ttl', parent=plain, fontName='TNR-I', leading=LEAD)
note = ParagraphStyle('note', fontName='TNR', fontSize=10.5, leading=14, textColor=BLACK)
ref = ParagraphStyle('ref', parent=plain, leftIndent=0.5 * inch, firstLineIndent=-0.5 * inch)
bullet = ParagraphStyle('bullet', parent=plain, leftIndent=0.5 * inch, firstLineIndent=-0.25 * inch)

RUNNING = 'KABUOR ERP SYSTEM DOCUMENTATION'


class Doc(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(path, pagesize=A4, leftMargin=inch, rightMargin=inch, topMargin=inch, bottomMargin=inch,
                         title='Kabuor ERP: System Documentation', author='Rooney Odhiambo Kabuor', subject='Technical and functional documentation of Kabuor ERP')
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([PageTemplate(id='page', frames=[frame], onPage=self.header)])

    def header(self, canv, doc):
        canv.saveState()
        canv.setFont('TNR', 12)
        canv.setFillColor(BLACK)
        canv.drawString(inch, A4[1] - 0.6 * inch, RUNNING)
        canv.drawRightString(A4[0] - inch, A4[1] - 0.6 * inch, str(doc.page))
        canv.restoreState()

    def afterFlowable(self, f):
        if isinstance(f, Paragraph) and getattr(f, 'toc_level', None) is not None:
            self.notify('TOCEntry', (f.toc_level, f.getPlainText(), self.page))


story = []
def P(t, s=body): story.append(Paragraph(t, s))
def H1(t):
    p = Paragraph(t, h1); p.toc_level = 0; story.append(CondPageBreak(1.6 * inch)); story.append(p)
def H2(t):
    p = Paragraph(t, h2); p.toc_level = 1; story.append(CondPageBreak(1.2 * inch)); story.append(p)
def H3(t): story.append(CondPageBreak(1 * inch)); story.append(Paragraph(t, h3))
def B(items):
    for i in items: story.append(Paragraph('•&nbsp;&nbsp;' + i, bullet))

tables = [0]
def TABLE(title, rows, widths, notes=None, header=True):
    tables[0] += 1
    data = [[Paragraph(str(c), cellb if (header and r == 0) else cell) for c in row] for r, row in enumerate(rows)]
    t = Table(data, colWidths=[w * inch for w in widths], repeatRows=1 if header else 0)
    st = [('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEABOVE', (0, 0), (-1, 0), 0.8, BLACK), ('LINEBELOW', (0, -1), (-1, -1), 0.8, BLACK),
          ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]
    if header: st.append(('LINEBELOW', (0, 0), (-1, 0), 0.6, BLACK))
    t.setStyle(TableStyle(st))
    block = [Paragraph(f'Table {tables[0]}', label), Paragraph(title, ttl), t]
    if notes: block += [Spacer(1, 4), Paragraph('<i>Note.</i> ' + notes, note)]
    block.append(Spacer(1, 12))
    if len(rows) >= 14: story.append(CondPageBreak(4.5 * inch))  # a long table starts where several rows fit under its caption
    story.append(KeepTogether(block[:3]) if len(rows) < 14 else KeepTogether(block[:2]))
    if len(rows) >= 14: story.append(t)
    story.extend(block[3:])
    return tables[0]

# ------------------------------------------------------------------ title page
story.append(Spacer(1, 2.2 * inch))
story.append(Paragraph('<b>Kabuor ERP: System Documentation</b>', center))
story.append(Paragraph('<b>Technologies, Costs, Development Timeline, Challenges, and Use Across User Profiles and Industries</b>', center))
story.append(Spacer(1, LEAD))
story.append(Paragraph('Rooney Odhiambo Kabuor, Founder and Holder', center))
story.append(Paragraph('Kabuor Builds, Nairobi, Kenya', center))
story.append(Spacer(1, LEAD))
story.append(Paragraph('Version 1.0', center))
story.append(Paragraph('October 21, 2026', center))
story.append(Spacer(1, 2.2 * inch))
story.append(Paragraph('<b>Author Note</b>', center))
P('This document describes Kabuor ERP as built in the repository <i>vitamind38/kabuor-erp</i> at commit 05712f7, together with the companion '
  'Kabuor Builds shop platform. Figures marked as estimates are the author’s own and are labelled as such. Correspondence concerning this '
  'document should be addressed to Kabuor Builds, Nairobi, Kenya.')
story.append(PageBreak())

# ------------------------------------------------------------------ abstract
story.append(Paragraph('<b>Abstract</b>', h1))
P('Kabuor ERP is a cloud enterprise resource planning (ERP) system built for small and medium-sized businesses in Kenya. It brings sales, '
  'point of sale, M-Pesa payments, stock, purchasing, production, payroll, customer relationship management, marketing, accounting, and Kenya '
  'Revenue Authority (KRA) electronic tax invoicing (eTIMS) into one application, with an assistant and supervised artificial intelligence (AI) '
  'agents that propose work for people to approve. This document records the technologies used and why, the cost of building and running the '
  'system, the development timeline, the challenges met and how each was resolved, how the system works internally, and how it serves each user '
  'profile and the main industries it targets. The system was built between October 16 and 21, 2026 by a single developer working with an AI '
  'coding assistant; at the time of writing it has 102 automated tests, a continuous-integration pipeline on SQLite and PostgreSQL, and a '
  'month-long simulated operation of a Nairobi distributor whose books reconciled on every check. Its main limitations are that external '
  'integrations (eTIMS, Safaricom, SMS, AI) have been tested only against stand-ins and sandboxes, that it has not been load-tested on its '
  'production database, and that it has no paying customers yet.', plain)
story.append(Spacer(1, LEAD / 2))
P('<i>Keywords:</i> enterprise resource planning, small and medium enterprises, Kenya, eTIMS, M-Pesa, payroll, AI agents', plain)
story.append(PageBreak())

# ------------------------------------------------------------------ contents
story.append(Paragraph('<b>Contents</b>', h1))
toc = TableOfContents()
toc.levelStyles = [ParagraphStyle('t0', fontName='TNR', fontSize=12, leading=18, leftIndent=0), ParagraphStyle('t1', fontName='TNR', fontSize=12, leading=18, leftIndent=0.4 * inch)]
toc.dotsMinLevel = 0
story.append(toc)
story.append(PageBreak())

# ------------------------------------------------------------------ 1 introduction
H1('Introduction')
P('Small and medium-sized businesses in Kenya run their finances on a combination of tools that rarely talk to each other: a point-of-sale '
  'till, an M-Pesa statement read by hand, a spreadsheet for stock, an accountant’s package for the books, and a separate payroll service. '
  'Since the Finance Act (2023), an expense can only be deducted for tax if it is backed by an electronic tax invoice, and since January 2026 '
  'KRA has compared declared income and expenses with eTIMS invoice data (KPMG, 2026). A business therefore needs every sale and purchase to '
  'pass through eTIMS, while most of its customers pay through M-Pesa.')
P('Kabuor ERP was built to remove that fragmentation. It is one application, priced in shillings, in which a sale is invoiced, signed with '
  'KRA, matched to the M-Pesa payment that settles it, taken out of stock, and posted to the books in a single step. This document is a '
  'reference for owners, staff, accountants, implementers, investors, and developers. It describes what was built, with what, at what cost, in '
  'how long, against which difficulties, and how each kind of user and business uses it.')
H2('Scope of This Document')
P('The document covers the Kabuor ERP application (the application programming interface, the web application, the database, and the '
  'background services) and, where it touches the ERP, the Kabuor Builds shop platform, which runs online shops and the company website. It '
  'does not cover regulatory registration (for example, with the Office of the Data Protection Commissioner) or legal review, which are '
  'outside the technical build.')

# ------------------------------------------------------------------ 2 overview
H1('System Overview')
P('The system is organised into modules that share one set of books and one customer, product, and employee record. Table 1 lists them.')
TABLE('Modules of Kabuor ERP and What Each Does', [
    ['Module', 'What it does'],
    ['Sales', 'Quotes and invoices with VAT-inclusive prices, customer price lists, units such as crates and cartons, credit limits, and voiding with a KRA credit note.'],
    ['Point of sale (till)', 'A till with opening float and closing count, barcode search, cash, M-Pesa and card payments, offline selling with later synchronisation, and 58 mm or 80 mm thermal receipts.'],
    ['Money in (M-Pesa)', 'Paybill and till payments received from Safaricom and matched to invoices automatically; payment prompts (STK push) sent from an invoice; statement import and reconciliation.'],
    ['Stock', 'Several stores, moving-average cost, counts, transfers, reorder levels, batches with expiry dates sold first-to-expire-first-out, and write-offs.'],
    ['Purchasing', 'Suppliers, purchase orders, bills, supplier payments, and supplier invoices received from KRA eTIMS.'],
    ['Production', 'Recipes, capacity from stock on hand, and production runs that consume ingredients and produce finished goods.'],
    ['People and payroll', 'Employees, leave, statutory payroll (PAYE, NSSF, SHIF, Housing Levy, NITA), deductions such as HELB and SACCO loans that apply only once the employee agrees, payslips, and a self-service portal.'],
    ['Customers and marketing', 'Leads, pipeline, follow-ups, segments, SMS and WhatsApp campaigns with opt-outs.'],
    ['Accounting and reports', 'Double-entry ledger, profit and loss, balance sheet, cash flow, trial balance, VAT return with withheld VAT, iTax CSV export, and ageing.'],
    ['Assistant and agents', 'Msaidizi, an assistant that answers in English, Kiswahili, or Sheng; and agents that draft reminders, match payments, reorder stock, read supplier invoices and customer orders, plus agents the owner describes.'],
    ['Platform', 'Subscription plans in shillings with a 30-day trial, data import from Excel, QuickBooks, or Sage, a public API with signed webhooks, and privacy and terms pages.'],
], [1.45, 5.0])

# ------------------------------------------------------------------ 3 technologies
H1('Technologies Used')
P('The technologies were chosen for three reasons: the work is mostly money and rules, which favour a strongly typed language and a relational '
  'database; the users are often on phones with patchy connections, which favours a light web application that can work offline; and the '
  'system is run by a very small team, which favours managed hosting and a single deployable unit. Table 2 lists each technology and its role.')
TABLE('Technologies, Versions, and Their Roles', [
    ['Layer', 'Technology (version)', 'Role and reason'],
    ['Server language', 'C# on .NET 10', 'Typed, fast, and well supported for financial rules; one runtime for the API and background services (Microsoft, n.d.-a).'],
    ['Web framework', 'ASP.NET Core minimal APIs', 'Small endpoint definitions with built-in authentication, rate limiting, and dependency injection.'],
    ['Data access', 'Entity Framework Core 10', 'Object mapping, migrations, per-company query filters, and optimistic concurrency (Microsoft, n.d.-b).'],
    ['Production database', 'PostgreSQL 18 (Railway)', 'Reliable relational store with transactions for double-entry accounting (PostgreSQL Global Development Group, n.d.).'],
    ['Local database', 'SQLite', 'Zero-setup development and fast automated tests.'],
    ['Authentication', 'JSON Web Tokens; TOTP', 'Stateless sign-in, token versions to end sessions, optional two-step sign-in, AES-GCM sealing of stored secrets.'],
    ['Web application', 'React 19, TypeScript, React Router 8', 'Component-based interface with type checking (Meta Open Source, n.d.).'],
    ['Styling and build', 'Tailwind CSS 4, Vite 8', 'Consistent design tokens and fast builds; the build is served by the API.'],
    ['Icons and QR', 'Lucide, qrcode', 'Interface icons; QR codes on eTIMS-signed receipts.'],
    ['Offline', 'Service worker; local storage queue', 'The till loads and sells without internet and synchronises later.'],
    ['Tax authority', 'KRA eTIMS OSCU API', 'Item registration, invoice signing, credit notes, and supplier invoices (Kenya Revenue Authority [KRA], n.d.).'],
    ['Payments', 'Safaricom Daraja (C2B, STK push)', 'Receiving paybill and till payments; sending payment prompts (Safaricom PLC, n.d.).'],
    ['Messaging', 'Africa’s Talking SMS; WhatsApp links', 'Reminders and campaigns.'],
    ['Artificial intelligence', 'Anthropic Claude API', 'The assistant, agent reasoning, and reading customer orders (Anthropic, 2026).'],
    ['Error monitoring', 'Sentry (server and browser)', 'Crash and error reports without personal data (Functional Software, n.d.).'],
    ['Hosting', 'Docker on Railway; Vercel', 'The ERP runs as one container on Railway; the company website runs on Vercel (Railway Corp., n.d.; Vercel Inc., n.d.).'],
    ['Source and automation', 'GitHub; GitHub Actions', 'Private repository, tests on every push against SQLite and PostgreSQL, nightly encrypted backups.'],
    ['Testing', 'xUnit 2.9; ASP.NET test host', '102 tests that drive the real API end to end, plus a month-long simulation script.'],
    ['Shop platform', 'Node.js, Express 5, node:sqlite, React 19', 'Multi-shop online stores with one database per shop; sends paid orders to the ERP.'],
    ['Development tools', 'Claude Code; Visual Studio Code', 'AI-assisted development by one developer.'],
], [1.25, 1.85, 3.35])

H2('Architecture')
P('Figure 1 shows how the parts fit together. Every person, till, and outside service talks to one ASP.NET Core application. The application '
  'decides which company a request belongs to from the sign-in token or the secret key in a callback address, and every database query is '
  'filtered by that company, so one business can never see another’s records. Business rules live in service classes (sales, payments, '
  'stock, payroll, eTIMS, agents) which always post to the double-entry ledger in the same database transaction as the business change.')

def figure():
    d = Drawing(6.4 * inch, 3.35 * inch)
    def box(x, y, w, h, text, bold=False):
        d.add(Rect(x, y, w, h, strokeColor=BLACK, fillColor=None, strokeWidth=0.8))
        lines = text.split('\n')
        for i, l in enumerate(lines):
            d.add(String(x + w / 2, y + h / 2 + (len(lines) / 2 - i - 0.75) * 11, l, fontName='TNR-B' if bold else 'TNR', fontSize=9.5, textAnchor='middle', fillColor=BLACK))
    def arrow(x1, y1, x2, y2):
        d.add(Line(x1, y1, x2, y2, strokeColor=BLACK, strokeWidth=0.8))
        import math
        a = math.atan2(y2 - y1, x2 - x1); s = 5
        d.add(Polygon([x2, y2, x2 - s * math.cos(a - 0.4), y2 - s * math.sin(a - 0.4), x2 - s * math.cos(a + 0.4), y2 - s * math.sin(a + 0.4)], fillColor=BLACK, strokeColor=BLACK))
    W = 6.4 * inch
    box(5, 205, 105, 34, 'Web app\n(phone, PC, till)')
    box(5, 150, 105, 34, 'Online shops\n(public API)')
    box(5, 95, 105, 34, 'Safaricom\n(M-Pesa callbacks)')
    box(5, 40, 105, 34, 'KRA eTIMS\n(OSCU API)')
    box(160, 35, 160, 210, '', True)
    d.add(String(240, 228, 'Kabuor ERP application', fontName='TNR-B', fontSize=10, textAnchor='middle', fillColor=BLACK))
    for i, t in enumerate(['Sign-in, roles, company filter', 'Sales, POS, payments', 'Stock, purchasing, production', 'Payroll and people', 'Ledger and reports', 'Assistant and agents']):
        d.add(String(240, 203 - i * 28, t, fontName='TNR', fontSize=9.5, textAnchor='middle', fillColor=BLACK))
    box(370, 175, 95, 40, 'PostgreSQL\n(one database)')
    box(370, 110, 95, 40, 'Background:\nagents, webhooks')
    box(370, 45, 95, 40, 'Claude API,\nSMS, Sentry')
    for y in (222, 167, 112, 57):
        arrow(110, y, 160, y)
    arrow(320, 195, 370, 195); arrow(320, 130, 370, 130); arrow(320, 65, 370, 65)
    d.add(String(W / 2 - 10, 10, 'Every change and its ledger entries are saved in one transaction.', fontName='TNR-I', fontSize=9.5, textAnchor='middle', fillColor=BLACK))
    return d

story.append(KeepTogether([Paragraph('Figure 1', label), Paragraph('Architecture of Kabuor ERP', ttl), figure()]))
story.append(Spacer(1, 6))

# ------------------------------------------------------------------ 4 how it works
H1('How the System Works')
H2('Selling and Getting Paid')
P('When a salesperson issues an invoice, the system, in one database transaction, (a) checks the customer’s credit limit, (b) posts the sale '
  'and its VAT to the ledger, (c) takes the goods out of stock at their moving-average cost, drawing first from the batch that expires soonest '
  'and refusing expired stock, and (d) queues the invoice for signing with KRA. Signing returns a receipt number, a control code, and a QR code '
  'that are printed on the invoice. If KRA cannot be reached, the sale still stands and signing is retried.')
P('When a customer pays the business’s M-Pesa paybill, Safaricom sends a confirmation to a secret address unique to that business. The '
  'system records the payment once, even if Safaricom sends the same confirmation again, and matches it to an invoice: with certainty when '
  'the account number is the invoice or customer number, as a strong likelihood when it comes from the customer’s own phone, and only as a '
  'guess when nothing but the amount agrees. Certain matches are applied immediately; the rest go to a person or, within an owner-set limit, '
  'to the payment matching agent. From an invoice, staff can also send an M-Pesa prompt to the customer’s phone, and the payment lands on '
  'that invoice when Safaricom confirms it.')
H2('The Till and Offline Selling')
P('A cashier opens the till with a float, sells by tapping products or scanning barcodes, and closes the till by counting the drawer. If the '
  'internet drops, the till keeps working from the last price list saved on the device; each sale is given a unique key on the device and '
  'queued. When the connection returns, the queue is sent; a sale that arrives twice is recorded once and keeps the time it was really made. '
  'Receipts print at 58 mm, 80 mm, or A4.')
H2('Buying, Stock, and Production')
P('Purchase orders go to suppliers; when goods arrive the order becomes a bill, and posting the bill adds the stock at its cost and records '
  'what is owed. Items kept by batch need the batch number and expiry when the bill is posted. Supplier invoices issued through eTIMS can be '
  'fetched from KRA and accepted as bills. For manufacturers, a recipe lists ingredients per batch; a production run consumes them and adds '
  'the finished product at the combined cost.')
H2('Payroll')
P('Each month, HR starts a payroll run. The system calculates gross pay, NSSF, the Social Health Insurance Fund (SHIF) contribution, the '
  'Affordable Housing Levy, PAYE after personal and pension relief, and agreed deductions such as HELB repayments, SACCO loans, and salary '
  'advances. A deduction applies only after the employee agrees in the portal, or after HR records a signed form or a HELB notice, and the '
  'system never deducts so much that the employee keeps less than one third of wages, as section 19(3) of the Employment Act (2007) requires. '
  'The accountant approves the run, which posts salaries and every amount owed to KRA, NSSF, SHIF, the Housing Levy, and third parties.')
H2('Books and Reports')
P('Every business event posts balanced entries to a chart of accounts. From the ledger the system produces the profit and loss statement, '
  'balance sheet, cash flow, trial balance, VAT return (with VAT withheld by customers), iTax import files, and customer and supplier ageing. '
  'Bank and M-Pesa statements can be imported and matched to the books.')
H2('Agents and the Assistant')
P('The design of the agents follows what Microsoft, SAP, Oracle, and Odoo ship in their ERPs (Microsoft, n.d.-c; Odoo S.A., n.d.; Oracle, n.d.; '
  'SAP SE, n.d.). An agent acts under its own name and only with the rights of the person who switched it on. It starts on a schedule, when a '
  'business event wakes it (for example, a payment that could not be matched), or when a person hands it work. It drafts; a person approves '
  'anything that leaves the business or moves money, unless the owner allows it to act alone when it is sure and the amount is within a '
  'limit. Table 3 lists the agents.')
TABLE('Agents in Kabuor ERP', [
    ['Agent', 'Does by itself', 'Asks first'],
    ['Collections', 'Finds overdue invoices; drafts reminders in English or Kiswahili.', 'Sending any message (later reminders to customers already approved can go automatically by SMS, if the owner allows).'],
    ['Payment matching', 'Applies certain matches; works out the likely invoice for others.', 'Applying uncertain matches (likely matches within the limit may be applied, if allowed).'],
    ['Restock', 'Watches reorder levels; drafts purchase orders to the last supplier.', 'Sending an order (regular suppliers within the limit, if allowed).'],
    ['Payables', 'Reads supplier invoices from KRA; finds the purchase order; notes differences.', 'Recording the bill (exact matches within the limit, if allowed).'],
    ['Order taking', 'Reads a pasted WhatsApp, SMS, or email order; drafts a quote at the customer’s prices; names what it could not match.', 'Sending the quote.'],
    ['Owner-built agents', 'Whatever the owner describes, using only the skills ticked.', 'Everything it proposes.'],
], [1.2, 2.65, 2.6])

# ------------------------------------------------------------------ 5 profiles
H1('How It Works for Each User Profile')
P('Each person signs in with a role. The role decides which menus, pages, and actions they see, and the server enforces the same rules on '
  'every request. Table 4 summarises what each role can do; the subsections describe a typical day.')
TABLE('Roles and What Each Can Do', [
    ['Role', 'Can see', 'Can do'],
    ['Owner', 'Everything', 'Everything, including users, settings, plan and billing, agents, credit limits, and approvals.'],
    ['Accountant', 'Sales, money, purchases, stock, payroll, reports', 'Post bills, pay suppliers, match payments, approve payroll, set credit terms, run VAT and iTax reports. No till.'],
    ['Sales', 'Customers, quotes, invoices, money in, CRM', 'Sell at the till, make quotes and invoices, record payments, hand orders to the order taking agent.'],
    ['Storekeeper', 'Stock, purchases, production', 'Count and transfer stock, raise purchase orders, receive goods, run production.'],
    ['Procurement', 'Suppliers, purchases, stock', 'Raise purchase orders and receive goods.'],
    ['HR', 'Employees, leave, payroll', 'Add employees and deductions, approve leave, start payroll runs, give employees portal access.'],
    ['Viewer', 'Reports, sales, stock (read only)', 'Look only; suited to an investor, auditor, or partner.'],
    ['Employee', 'Their own portal', 'Apply for leave, download payslips and the P9 form, agree to or decline deductions.'],
], [1.1, 1.85, 3.5])
H3('Owner.')
P('The owner opens <i>Today</i>, which shows money in this week, overdue invoices, payments waiting to be matched, cash in M-Pesa and the bank, '
  'and VAT owed. They approve what the agents have drafted, ask Msaidizi questions such as “Nani ananidai zaidi?” (“Who owes me the most?”), '
  'and set the rules: credit limits, price lists, how much each agent may decide alone, and whether stock may be sold below zero.')
H3('Accountant.')
P('The accountant enters and posts supplier bills, imports the month’s M-Pesa and bank statements to reconcile them, records VAT withheld by '
  'customers, approves payroll, and at month end downloads the VAT return figures and iTax files and reviews the balance sheet and trial balance.')
H3('Salesperson and cashier.')
P('The cashier opens the till, sells, and closes with a count. A salesperson makes quotes and invoices, sends M-Pesa prompts from invoices, '
  'pastes customer orders for the order taking agent, and follows up leads. They cannot change credit terms or prices on price lists.')
H3('Storekeeper and procurement officer.')
P('They watch low stock and expiring batches, raise and receive purchase orders, count stock, transfer between stores, write off expired '
  'batches, and run production.')
H3('HR officer.')
P('HR adds employees with their statutory numbers, records leave, sets up deductions that wait for the employee’s agreement, starts the '
  'monthly payroll run, and gives employees access to the self-service portal by phone number.')
H3('Employee.')
P('An employee signs in with their phone number, chooses their own password, applies for leave, downloads payslips and the P9 tax form, and '
  'agrees to or declines deductions such as a HELB repayment.')
H3('Developers and integrators.')
P('An outside system uses an API key made in Settings to read products and send orders (each order is recorded once however many times it '
  'is sent), and receives signed webhook messages when payments arrive or invoices are paid.')

# ------------------------------------------------------------------ 6 industries
H1('How It Works Across Industries')
P('The same application adapts to different kinds of business through settings rather than separate versions. Table 5 shows how the main '
  'industries in the target market use it, and where it is less suited.')
TABLE('Use of Kabuor ERP by Industry', [
    ['Industry', 'Features that matter most', 'Fit'],
    ['Retail shops and minimarts', 'Till with barcode and offline selling, M-Pesa matching, thermal receipts, reorder levels, restock agent.', 'Strong'],
    ['Wholesale and distribution', 'Customer price lists, crates and cartons, credit limits, statements, collections agent, order taking agent for WhatsApp orders.', 'Strong'],
    ['Food and beverage manufacturing', 'Recipes, production runs, batch costing, batches with expiry, eTIMS with reduced and exempt VAT bands.', 'Strong'],
    ['Pharmacies and agro-vets', 'Batches and expiry sold first-to-expire-first-out, expired stock blocked and written off, supplier invoices from eTIMS.', 'Good; no prescription records'],
    ['Restaurants and cafes', 'Till, recipes for ingredient costing, daily takings, M-Pesa.', 'Good; no table or kitchen screens'],
    ['Professional services', 'Service items, quotes, invoices, withholding VAT and tax certificates, collections, CRM.', 'Good'],
    ['Online sellers', 'Kabuor Builds shops that send paid orders to the ERP, public API, M-Pesa prompts.', 'Strong'],
    ['Hardware and construction supply', 'Units (bags, pieces), price lists, credit limits, several stores.', 'Good; no project costing'],
    ['Schools, NGOs, and churches', 'Invoicing and payroll work, but there is no fund or grant accounting or student billing.', 'Limited'],
], [1.6, 3.75, 1.1])

# ------------------------------------------------------------------ 7 timeline
H1('Development Timeline')
P('The system was built by one developer with an AI coding assistant over six days. The shop platform came first (October 16–20, 2026); the '
  'ERP was built on October 20 and extended on October 21. Table 6 lists the main steps from the source history.')
TABLE('Development Timeline', [
    ['Date (2026)', 'Work completed'],
    ['October 16', 'Kabuor Builds shop platform: self-service, multi-shop online stores; brand kit.'],
    ['October 18–19', 'Shop platform hosted on Vercel; owner dashboard, M-Pesa prompts per shop, backups.'],
    ['October 20, morning', 'Kabuor ERP first version: sales, eTIMS-ready invoices, M-Pesa matching, books and VAT, buying and stock, till, payroll, CRM, production, marketing, employee portal, assistant, and first three agents.'],
    ['October 20, evening', 'Production readiness: database migrations, two-step sign-in, sessions, continuous integration, nightly encrypted backups; deployed on Railway.'],
    ['October 21, morning', 'Kenyan market gaps: real eTIMS integration, accountant reports, M-Pesa prompts and statements, offline till, plans and trial, import, price lists, units, batches, credit limits, public API, webhooks, legal pages, consent-based deductions; agents extended with review policies, event triggers, payables and order taking agents, and the agent studio.'],
    ['October 21, late morning', 'Month-long simulation of a Nairobi distributor; five defects found and fixed; error monitoring added.'],
], [1.45, 5.0])
P('In conventional terms, the author estimates the scope at six to nine developer-months for a small team without AI assistance; the AI '
  'assistant compressed this to days, but the work still required the developer to set direction, review results, and decide every trade-off.')

# ------------------------------------------------------------------ 8 cost
H1('Cost')
H2('Cost of Building')
P('The direct cash cost of building was the developer’s own tool subscriptions (the AI coding assistant and existing hardware and internet), '
  'which are not itemised here. Table 7 gives the author’s estimate of what the same scope would cost to build conventionally, as a reference '
  'for valuation and budgeting.')
TABLE('Estimated Cost of Building the Same Scope Conventionally', [
    ['Approach', 'Effort', 'Estimated cost (KSh)'],
    ['In-house team at local senior salaries (about KSh 250,000–400,000 per developer-month)', '6–9 developer-months', '2,000,000–4,000,000'],
    ['Kenyan software agency', 'Same scope, quoted', '4,000,000–8,000,000'],
    ['Customised open-source ERP (for comparison)', 'Implementation of ERPNext or Odoo with eTIMS, M-Pesa, and payroll', '300,000–910,000 plus monthly support'],
], [3.0, 1.7, 1.75], notes='Estimates by the author. Comparison figures for customised open-source ERP are from IT Kenya (2026) and Aqiq Solutions (2026).')
H2('Cost of Running')
P('Table 8 lists the services the system uses and how they are charged. Most have free tiers sufficient for a pilot.')
TABLE('Running Costs', [
    ['Service', 'Purpose', 'How it is charged'],
    ['Railway', 'Hosting the ERP and its PostgreSQL database', 'Paid plan with usage-based charges (Railway Corp., n.d.).'],
    ['Vercel', 'Company website', 'Free hobby tier.'],
    ['GitHub and GitHub Actions', 'Source code, tests, nightly backups', 'Free tier for a private repository.'],
    ['Anthropic Claude API', 'Assistant, agents, order reading', 'Per use (tokens); the largest variable cost as businesses grow.'],
    ['Africa’s Talking', 'SMS reminders and campaigns', 'Per message.'],
    ['Safaricom Daraja', 'M-Pesa callbacks and prompts', 'No API fee; normal M-Pesa tariffs are paid by the business.'],
    ['KRA eTIMS', 'Tax invoice signing', 'No fee.'],
    ['Sentry', 'Error alerts and uptime', 'Free developer tier.'],
], [1.6, 2.35, 2.5])
H2('Price to Customers')
P('Plans are set in shillings per business, with a 30-day free trial. The launch configuration is KSh 1,500 (Starter), KSh 4,500 (Business), '
  'and KSh 9,500 (Growth) per month, with a year charged as ten months; prices are a server setting and can change without a release. For '
  'comparison, Zoho Books in Kenya lists KSh 999 to 18,000 per month for accounting only (FNJ Associates, 2026), Veira lists KSh 2,999 to 9,999 '
  'for accounting and point of sale (Veira, 2026), and Odoo costs about KSh 1,155 per user per month before implementation (Aqiq Solutions, 2026). '
  'The author recommends raising the launch prices to about KSh 2,500, 6,500, and 12,500–15,000 and metering AI use beyond a monthly allowance.')

# ------------------------------------------------------------------ 9 challenges
H1('Challenges Met and How They Were Resolved')
P('Table 9 records the significant problems met during the build, in order, and how each was resolved. Several were found only by the '
  'month-long simulation described in the next section, which is why it was run.')
TABLE('Challenges and Resolutions', [
    ['Challenge', 'Resolution'],
    ['A live database created before migrations existed had to be brought under migration control without data loss.', 'On start, the system detects such a database, records it as being at the first migration, and applies only later ones.'],
    ['Railway stopped deploying new versions during a platform outage, and later lost access to the private GitHub repository.', 'The service source was reconnected; repository access must be re-granted by the account owner. Deployment waits for tests to pass.'],
    ['The nightly backup could not reach the database through Railway’s internal address.', 'A public TCP proxy was added and the backup script was made to show exactly what is wrong with a supplied address without revealing it.'],
    ['The company website failed to build on Vercel because its root directory was the client folder.', 'The Vercel configuration was moved into the client folder and the build installs from the workspace root.'],
    ['SQLite cannot compare or sort some date-time values that PostgreSQL can.', 'Those comparisons are done in memory after narrowing the query, so the same code runs on both.'],
    ['Two document numbers taken in one save conflicted.', 'Number sequences check the records already being saved before reading the database.'],
    ['On existing SQLite databases, a new index was created before its new column existed, crashing start-up.', 'Schema updates now create tables, then add missing columns, then create indexes.'],
    ['An agent’s spending limit stored as a whole number could not be read back as a long number.', 'Agent settings are read through a tolerant number parser.'],
    ['Backdated invoices were refused because batch expiry was judged against today.', 'Expiry is judged on the sale date.'],
    ['Stock value disagreed with the ledger by about 6%.', 'Items sold below zero had been counted as zero; stock value is now signed and agrees with the ledger to the shilling, and owners can forbid selling below zero.'],
    ['Purchase orders for batch-kept products demanded batch numbers, which crashed the restock agent.', 'Batch numbers are required only when a bill is posted.'],
    ['The till offered products whose only remaining stock had expired.', 'The till counts only sellable stock.'],
    ['The development editor kept the build output locked while it ran its own copy of the server.', 'Builds and tests write to separate output folders; demonstrations run on another port.'],
], [3.05, 3.4])

# ------------------------------------------------------------------ 10 quality
H1('Quality Assurance')
P('Quality is checked in three ways. First, 102 automated tests drive the real application programming interface through a test host, from '
  'registration to month-end reports, including role restrictions, company isolation, payroll rules, eTIMS behaviour against a simulated KRA, '
  'M-Pesa prompts against a simulated Safaricom, agents against a simulated AI, webhooks, and the public API. Second, every push to the '
  'repository runs the tests twice, on SQLite and on PostgreSQL with the real migrations. Third, a simulation script plays a month of trading at '
  'a fictional Nairobi distributor through the live interface: six staff accounts, eight employees, twenty products (five kept by batch), twenty '
  'customers on credit, about 140 invoices, about 70 M-Pesa payments with deliberate duplicates, a busy till hour, online orders, offline sales, '
  'payroll, agents, and statement reconciliation. Table 10 shows the checks made at the end of the simulated month.')
TABLE('Results of the Month-End Checks in the Final Simulation Run', [
    ['Check', 'Result'],
    ['Trial balance balances', 'Passed'],
    ['Balance sheet balances (assets equal liabilities plus equity)', 'Passed'],
    ['Receivables account equals what customers owe', 'Passed, to the shilling'],
    ['Stock account equals stock on hand at cost', 'Passed, to the shilling'],
    ['VAT report equals VAT on the month’s invoices', 'Passed'],
    ['Each M-Pesa receipt recorded once despite repeated confirmations', 'Passed'],
    ['Offline sale sent twice kept once', 'Passed'],
    ['Online order sent twice kept once', 'Passed'],
    ['Employee keeps at least one third of pay despite a large advance', 'Passed'],
    ['Salesperson cannot change credit terms', 'Passed'],
    ['No server errors', 'Passed; median response 12 ms, 95th percentile 73 ms'],
], [4.45, 2.0], notes='The simulation ran on SQLite on a developer computer; it has not yet been repeated on PostgreSQL under concurrent load.')

# ------------------------------------------------------------------ 11 security
H1('Security and Privacy')
B(['Every query is limited to the signed-in person’s company; callbacks from Safaricom and KRA are tied to a company by a secret key in their address.',
   'Roles are enforced on the server, not only hidden in the interface; approving an agent’s proposal needs the approver’s own rights.',
   'Passwords are hashed; sign-in locks after five wrong attempts; two-step sign-in and “sign out everywhere” are available.',
   'Stored secrets such as KRA and Daraja keys are encrypted; API keys are stored only as hashes and shown once.',
   'The web application runs under a strict content security policy; error reports to Sentry exclude names, phone numbers, and request bodies.',
   'The privacy notice and terms are written for the Data Protection Act (2019) and the Tax Procedures Act (2015), and await legal review.'])

# ------------------------------------------------------------------ 12 limitations
H1('Limitations and Future Work')
B(['The eTIMS, M-Pesa, SMS, and AI integrations have been tested against stand-ins; sandbox and live certification remain.',
   'The system has not been load-tested on PostgreSQL; when two sales collide, one may fail instead of retrying automatically.',
   'Some screens and agents read whole tables into memory, which will slow down after years of busy trading.',
   'Background agents and webhooks assume a single server instance.',
   'There is no accounting period lock, partial credit note, customer return, fixed asset register, or multi-currency support.',
   'The web application has no automated interface tests.',
   'The WhatsApp Business API is not integrated; WhatsApp is used through prepared message links.',
   'There are no paying customers yet; a pilot with three to five businesses is the next step.'])

# ------------------------------------------------------------------ 13 conclusion
H1('Conclusion')
P('Kabuor ERP shows that a single developer working with an AI assistant can, in under a week, build an ERP whose scope matches products that '
  'normally take teams many months, and whose books reconcile under a realistic month of trading. Its distinguishing features for the Kenyan '
  'market are native eTIMS, deep M-Pesa handling, statutory payroll with consent-based deductions, offline selling, and supervised AI agents, '
  'at a price in shillings per business. Its next milestones are technical certification of its integrations, load testing on its production '
  'database, and real use by paying businesses.')

# ------------------------------------------------------------------ references
story.append(PageBreak())
p = Paragraph('<b>References</b>', h1); p.toc_level = 0; story.append(p)
refs = [
    'Anthropic. (2026). <i>Claude API documentation</i>. https://docs.anthropic.com',
    'Aqiq Solutions. (2026). <i>ERP software pricing in Kenya 2026: How much does ERPNext or Odoo actually cost?</i> https://aqiqsolutions.com/en-ke/blog/erp-software-pricing-kenya-erpnext-odoo-cost-2026/',
    'Data Protection Act, No. 24 of 2019, Laws of Kenya (2019).',
    'Employment Act, No. 11 of 2007, Laws of Kenya (2007).',
    'Finance Act, 2023, Laws of Kenya (2023).',
    'FNJ Associates. (2026). <i>Zoho Books in Kenya: The complete 2026 guide for SMEs</i>. https://fnjassociates.co.ke/?p=2755',
    'Functional Software. (n.d.). <i>Sentry documentation</i>. https://docs.sentry.io',
    'IT Kenya. (2026). <i>ERP software cost in Kenya: 2026 pricing guide</i>. https://itkenya.com/erp-software-cost-kenya-2026/',
    'Kenya Revenue Authority. (n.d.). <i>eTIMS online sales control unit (OSCU) integration specification</i> (Version 2.0).',
    'KPMG. (2026). <i>eTIMS</i> [Tax thought leadership]. https://assets.kpmg.com/content/dam/kpmgsites/ke/pdf/thought_leaderships/tax/2026/eTIMS.pdf',
    'Meta Open Source. (n.d.). <i>React</i>. https://react.dev',
    'Microsoft. (n.d.-a). <i>ASP.NET Core documentation</i>. https://learn.microsoft.com/aspnet/core',
    'Microsoft. (n.d.-b). <i>Entity Framework Core documentation</i>. https://learn.microsoft.com/ef/core',
    'Microsoft. (n.d.-c). <i>Payables agent FAQ</i>. Dynamics 365 Business Central. https://learn.microsoft.com/dynamics365/business-central/faqs-payables-agent',
    'Odoo S.A. (n.d.). <i>AI in support workflows</i>. https://www.odoo.com/documentation/saas-19.1/applications/productivity/ai/support_operations.html',
    'Oracle. (n.d.). <i>Overview of AI Agent Studio</i>. https://docs.oracle.com/en/cloud/saas/fusion-ai/aiaas/overview.html',
    'PostgreSQL Global Development Group. (n.d.). <i>PostgreSQL documentation</i>. https://www.postgresql.org/docs/',
    'Railway Corp. (n.d.). <i>Railway documentation</i>. https://docs.railway.com',
    'Safaricom PLC. (n.d.). <i>Daraja API documentation</i>. https://developer.safaricom.co.ke',
    'SAP SE. (n.d.). <i>Joule agents</i>. https://www.sap.com/products/artificial-intelligence/ai-agents.html',
    'Tax Procedures Act, No. 29 of 2015, Laws of Kenya (2015).',
    'Veira. (2026). <i>ERP software Kenya 2026: eTIMS, M-Pesa, live same day</i>. https://veirahq.com/blog/erp-software-kenya',
    'Vercel Inc. (n.d.). <i>Vercel documentation</i>. https://vercel.com/docs',
]
for r in refs: story.append(Paragraph(r, ref))

# ------------------------------------------------------------------ appendix: demonstration accounts
story.append(PageBreak())
p = Paragraph('<b>Appendix</b>', h1); p.toc_level = 0; story.append(p)
story.append(Paragraph('<b>Demonstration Accounts</b>', h1))
P('The month-long simulation described under Quality Assurance can be loaded into a demonstration database for a fictional company, Amani '
  'Distributors Ltd, a VAT-registered wholesaler in Nairobi. The database holds September 2026 trading: about 140 invoices, 70 M-Pesa '
  'payments, 14 supplier bills, a payroll run for eight employees, a day of till sales, online orders, a reconciled M-Pesa statement, and '
  'agent tasks waiting for review. Each account in Table 11 signs in to the same company with a different role, so a reader can see exactly '
  'what each user profile sees and can do.')
TABLE('Demonstration Logins for Amani Distributors Ltd', [
    ['Role', 'Name', 'Sign-in', 'Password'],
    ['Owner', 'Grace Wambui', 'owner@amani.test', 'Amani-owner-2026!'],
    ['Accountant', 'Peter Otieno', 'peter@amani.test', 'Amani-peter-2026'],
    ['Sales', 'Mercy Achieng', 'mercy@amani.test', 'Amani-mercy-2026'],
    ['Sales', 'Brian Kiprop', 'brian@amani.test', 'Amani-brian-2026'],
    ['Storekeeper', 'Joseph Mutua', 'joseph@amani.test', 'Amani-joseph-2026'],
    ['HR', 'Faith Njeri', 'faith@amani.test', 'Amani-faith-2026'],
    ['Employee (portal)', 'Lucy Wanjiru', '0711100022 (phone number)', 'Lucy-own-password-2026'],
], [1.35, 1.25, 2.05, 1.8], notes='These accounts exist only in the local demonstration database (demo/amani-demo.db) and the .test addresses '
   'cannot receive email. They are not accounts on the live service, must never be created there, and their passwords must not be reused '
   'anywhere else.')
H3('Starting the demonstration.')
P('From the project folder, run the application against the demonstration database and open http://localhost:5083 in a browser:')
story.append(Paragraph('<font face="Courier" size="10">ConnectionStrings__Erp="Data Source=demo/amani-demo.db" dotnet run --project src/Kabuor.Erp.Api --urls http://localhost:5083</font>', ParagraphStyle('code', parent=plain, leading=14, leftIndent=0.5 * inch, spaceAfter=12)))
H3('Recreating it.')
P('To build a fresh copy, start the application against an empty database file at the same address and run the simulation with fixed '
  'logins; it creates the company, plays the month, checks the books, and writes the logins to demo/logins.json:')
story.append(Paragraph('<font face="Courier" size="10">DEMO=1 node tools/simulate-month.mjs http://localhost:5083</font>', ParagraphStyle('code2', parent=plain, leading=14, leftIndent=0.5 * inch, spaceAfter=12)))
H3('Suggested walk-through.')
B(['Sign in as Grace (owner): open <i>Today</i>, then <i>Agents</i> to review drafted reminders and payment questions.',
   'Sign in as Peter (accountant): open <i>Reports</i> for the balance sheet and VAT return, and <i>Reconcile</i> for the M-Pesa statement.',
   'Sign in as Mercy (sales): open the till, make an invoice for Mama Njeri Shop (wholesale prices and a credit limit apply), and paste an order into the order taking agent.',
   'Sign in as Joseph (storekeeper): open <i>Stock</i> to see low, below-zero, and expiring items.',
   'Sign in as Faith (HR): open <i>Payroll</i> for September and an employee’s deductions.',
   'Sign in as Lucy (employee) with her phone number: see her payslip and the HELB deduction she agreed to.'])

doc = Doc(OUT)
doc.multiBuild(story)
print('ok')
