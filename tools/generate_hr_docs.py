#!/usr/bin/env python3
"""
Generator for Kabuor ERP Executive Word Documents (.docx):
- Mutual Non-Disclosure Agreement (NDA)
- 5 Tailored Executive Offer Letters for Scaling Pods
- 1 Universal Executive Offer Letter Template
"""

import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "recruitment"))
os.makedirs(OUT_DIR, exist_ok=True)

# Corporate Colors
BRAND_NAVY = RGBColor(10, 37, 64)       # #0A2540
ACCENT_BLUE = RGBColor(0, 112, 240)     # #0070F0
SLATE_GRAY = RGBColor(74, 85, 104)      # #4A5568
CHARCOAL = RGBColor(26, 32, 44)         # #1A202C
LIGHT_BG = "F7FAFC"
BORDER_COLOR = "E2E8F0"

def set_cell_background(cell, fill_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_base_document():
    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)
        section.page_width = Inches(8.27)  # A4
        section.page_height = Inches(11.69)
    return doc

def add_letterhead(doc, doc_ref, doc_type="OFFICIAL CORRESPONDENCE"):
    # Header Table with Logo / Title and Company Info
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    col_widths = [Inches(4.2), Inches(2.37)]
    for i, col in enumerate(table.columns):
        col.width = col_widths[i]
    
    row = table.rows[0]
    cell_left = row.cells[0]
    cell_right = row.cells[1]
    
    # Left: Brand Name & Slogan
    p_logo = cell_left.paragraphs[0]
    p_logo.paragraph_format.space_after = Pt(2)
    run_logo = p_logo.add_run("KABUOR BUILDS LIMITED")
    run_logo.font.name = "Georgia"
    run_logo.font.size = Pt(14)
    run_logo.font.bold = True
    run_logo.font.color.rgb = BRAND_NAVY
    
    p_sub = cell_left.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(0)
    run_sub = p_sub.add_run("KABUOR ERP · FINANCIAL OPERATING SYSTEM")
    run_sub.font.name = "Calibri"
    run_sub.font.size = Pt(8.5)
    run_sub.font.bold = True
    run_sub.font.color.rgb = ACCENT_BLUE
    
    # Right: Company Details
    p_addr = cell_right.paragraphs[0]
    p_addr.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_addr.paragraph_format.space_after = Pt(1)
    
    lines = [
        "The Mirage Tower, Mezzanine 2",
        "Chiromo Road, Westlands, Nairobi",
        "Republic of Kenya · P.O. Box 45210-00100",
        "legal@kabuor.com · www.kabuor.com"
    ]
    for line in lines:
        r = p_addr.add_run(line + "\n")
        r.font.name = "Calibri"
        r.font.size = Pt(8)
        r.font.color.rgb = SLATE_GRAY
    
    # Horizontal Rule below letterhead
    p_rule = doc.add_paragraph()
    p_rule.paragraph_format.space_before = Pt(4)
    p_rule.paragraph_format.space_after = Pt(12)
    p_rule_border = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="12" w:space="1" w:color="0A2540"/></w:pBdr>')
    p_rule._p.get_or_add_pPr().append(p_rule_border)
    
    # Reference & Metadata Block
    t_meta = doc.add_table(rows=1, cols=2)
    t_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, col in enumerate(t_meta.columns):
        col.width = col_widths[i]
    r_meta = t_meta.rows[0]
    
    p_meta_l = r_meta.cells[0].paragraphs[0]
    p_meta_l.paragraph_format.space_after = Pt(0)
    r1 = p_meta_l.add_run(f"REF: {doc_ref}\n")
    r1.font.bold = True
    r1.font.size = Pt(9)
    r1.font.color.rgb = BRAND_NAVY
    r2 = p_meta_l.add_run(f"CLASSIFICATION: {doc_type}")
    r2.font.size = Pt(8.5)
    r2.font.color.rgb = SLATE_GRAY
    
    p_meta_r = r_meta.cells[1].paragraphs[0]
    p_meta_r.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_meta_r.paragraph_format.space_after = Pt(0)
    r3 = p_meta_r.add_run("DATE: [Insert Date, e.g., 25th October 2026]\n")
    r3.font.size = Pt(9)
    r3.font.color.rgb = CHARCOAL
    r4 = p_meta_r.add_run("JURISDICTION: Republic of Kenya")
    r4.font.size = Pt(8.5)
    r4.font.color.rgb = SLATE_GRAY
    
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

def add_heading_styled(doc, text, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.keep_with_next = True
    if level == 1:
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(6)
        run = p.add_run(text)
        run.font.name = "Georgia"
        run.font.size = Pt(12.5)
        run.font.bold = True
        run.font.color.rgb = BRAND_NAVY
        # Subtle bottom border for H1
        bdr = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="6" w:space="2" w:color="E2E8F0"/></w:pBdr>')
        p._p.get_or_add_pPr().append(bdr)
    elif level == 2:
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.color.rgb = ACCENT_BLUE
    return p

def add_body_p(doc, text, bold_prefix="", space_after=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix + " ")
        r_pre.font.name = "Calibri"
        r_pre.font.size = Pt(10)
        r_pre.font.bold = True
        r_pre.font.color.rgb = CHARCOAL
    r = p.add_run(text)
    r.font.name = "Calibri"
    r.font.size = Pt(10)
    r.font.color.rgb = CHARCOAL
    return p

def add_bullet(doc, text, bold_title=""):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.12
    if bold_title:
        r_pre = p.add_run(bold_title + ": ")
        r_pre.font.name = "Calibri"
        r_pre.font.size = Pt(9.5)
        r_pre.font.bold = True
        r_pre.font.color.rgb = CHARCOAL
    r = p.add_run(text)
    r.font.name = "Calibri"
    r.font.size = Pt(9.5)
    r.font.color.rgb = CHARCOAL

def add_table_grid(doc, headers, rows_data):
    table = doc.add_table(rows=len(rows_data) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    # Header row
    hdr_row = table.rows[0]
    for i, h_text in enumerate(headers):
        cell = hdr_row.cells[i]
        set_cell_background(cell, "0A2540")
        set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h_text)
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)
    
    # Data rows
    for r_idx, row_items in enumerate(rows_data):
        row = table.rows[r_idx + 1]
        bg = "FFFFFF" if r_idx % 2 == 0 else "F7FAFC"
        for c_idx, cell_value in enumerate(row_items):
            cell = row.cells[c_idx]
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(cell_value)
            r.font.name = "Calibri"
            r.font.size = Pt(9)
            r.font.color.rgb = CHARCOAL
            if c_idx == 0:
                r.font.bold = True
    
    # Spacer
    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(6)
    p_sp.paragraph_format.space_after = Pt(6)

def add_dual_signatures(doc, recipient_name="[Candidate Name]", recipient_title="Prospective Executive"):
    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(12)
    p_sp.paragraph_format.space_after = Pt(4)
    
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    col_w = [Inches(3.3), Inches(3.3)]
    for i, col in enumerate(table.columns):
        col.width = col_w[i]
    
    row = table.rows[0]
    c1, c2 = row.cells[0], row.cells[1]
    
    # Left: Employer
    p1 = c1.paragraphs[0]
    p1.paragraph_format.space_after = Pt(2)
    p1.add_run("FOR: KABUOR BUILDS LIMITED\n\n\n").font.bold = True
    p1.add_run("_________________________________________\n")
    p1.add_run("Rooney Odhiambo Kabuor\n").font.bold = True
    p1.add_run("Founder & Chief Executive Officer\nDate: ___________________________________")
    
    # Right: Candidate
    p2 = c2.paragraphs[0]
    p2.paragraph_format.space_after = Pt(2)
    p2.add_run(f"ACCEPTED & AGREED:\n\n\n").font.bold = True
    p2.add_run("_________________________________________\n")
    p2.add_run(f"{recipient_name}\n").font.bold = True
    p2.add_run(f"{recipient_title}\nDate: ___________________________________")


# ==============================================================================
# 1. MUTUAL NON-DISCLOSURE & PROPRIETARY INFORMATION AGREEMENT
# ==============================================================================
def generate_nda_doc():
    doc = create_base_document()
    add_letterhead(doc, "KAB-LEG-NDA-2026", "LEGAL & PROPRIETARY INFORMATION AGREEMENT")
    
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_t = p_title.add_run("MUTUAL NON-DISCLOSURE AND INTELLECTUAL PROPERTY AGREEMENT")
    r_t.font.name = "Georgia"
    r_t.font.size = Pt(13)
    r_t.font.bold = True
    r_t.font.color.rgb = BRAND_NAVY
    
    add_body_p(doc, 
        "This Mutual Non-Disclosure and Proprietary Information Agreement (the \"Agreement\") is entered into as of the date written below by and between:",
        "PREAMBLE:")
    
    add_bullet(doc, "KABUOR BUILDS LIMITED, a company incorporated under the Companies Act of the Republic of Kenya, having its principal office at The Mirage Tower, Chiromo Road, Westlands, Nairobi, Kenya (\"Disclosing Party\" / \"Company\"); and", "Party 1")
    add_bullet(doc, "[Insert Full Legal Name], residing at [Insert Address / City], holder of Kenyan National ID / Passport No. [Insert Number] (\"Receiving Party\" / \"Prospective Partner / Candidate\").", "Party 2")
    
    add_body_p(doc, "The Company and the Receiving Party are collectively referred to as the \"Parties\" and individually as a \"Party\".")
    
    add_heading_styled(doc, "1. Purpose of Disclosure", level=1)
    add_body_p(doc, "The Parties intend to engage in highly sensitive discussions concerning potential employment, executive co-founding, advisory roles, strategic partnerships, and technical collaboration regarding Kabuor ERP—the financial operating system and cloud ERP developed by Kabuor Builds Limited (the \"Permitted Purpose\").")
    
    add_heading_styled(doc, "2. Definition of Confidential Information", level=1)
    add_body_p(doc, "\"Confidential Information\" encompasses all technical, business, financial, operational, and architectural data disclosed by the Company to the Receiving Party, whether oral, written, electronic, or visual, including but not limited to:")
    add_bullet(doc, "Proprietary source code, modular monolith architecture, Entity Framework Core schemas, and SQLite/PostgreSQL synchronization protocols (.NET 10 & React 19).", "Source Code & Architecture")
    add_bullet(doc, "The SequenceGate concurrency control arbiter, in-memory sequence caches, and optimistic locking mechanisms.", "Concurrency Algorithms")
    add_bullet(doc, "Real-time cryptographic eTIMS OSCU/VSCU signing pipelines, control number generation, and KRA protocol adapters.", "Fiscal Integrations")
    add_bullet(doc, "Safaricom Daraja M-Pesa C2B/B2C webhook handlers, STK push orchestration, and settlement routing architecture.", "Fintech & Payment Rails")
    add_bullet(doc, "Financial models, customer pipeline data, merchant take-rate economics, Series A valuation benchmarks, and VDR documents.", "Commercial Data")
    
    add_heading_styled(doc, "3. Obligations of Confidentiality & Non-Use", level=1)
    add_body_p(doc, "The Receiving Party agrees to maintain the strictest confidentiality regarding the Disclosing Party's Confidential Information and specifically covenants that it shall:")
    add_bullet(doc, "Use the Confidential Information solely and exclusively for the Permitted Purpose.", "Strict Purpose Limitation")
    add_bullet(doc, "Apply no less than a reasonable degree of care, and at least the same degree of care it uses to protect its own highly confidential assets.", "Standard of Care")
    add_bullet(doc, "Not disclose, publish, duplicate, decompile, reverse-engineer, or transmit any Confidential Information to third parties without prior written consent.", "Non-Circumvention")
    add_bullet(doc, "Comply with the Kenya Data Protection Act, 2019 regarding any customer, merchant, or employee personal data encountered.", "Data Protection Act")
    
    add_heading_styled(doc, "4. Intellectual Property & Inventions", level=1)
    add_body_p(doc, "All right, title, and interest in and to any intellectual property, software, documentation, trade secrets, trademarks, patents, and technical discoveries concerning Kabuor ERP remain the sole, absolute, and exclusive property of Kabuor Builds Limited. Nothing in this Agreement grants the Receiving Party any license, right, or title to the Company's IP.")
    
    add_heading_styled(doc, "5. Term, Return of Materials & Remedies", level=1)
    add_body_p(doc, "This Agreement shall remain in force for a period of three (3) years from the date of execution. Upon written request, the Receiving Party shall immediately destroy or return all materials, notes, electronic files, and code repositories containing Confidential Information.")
    add_body_p(doc, "The Receiving Party acknowledges that any breach of this Agreement would cause irreparable harm to the Company for which monetary damages alone would be inadequate, and the Company shall be entitled to seek injunctive relief before the High Court of Kenya without posting bond.")
    
    add_heading_styled(doc, "6. Governing Law & Dispute Resolution", level=1)
    add_body_p(doc, "This Agreement shall be governed by and construed in accordance with the laws of the Republic of Kenya. Any dispute arising out of or in connection with this Agreement shall be referred to arbitration in Nairobi under the Arbitration Act, 1995, before a single arbitrator appointed by the Chartered Institute of Arbitrators (Kenya Branch).")
    
    add_dual_signatures(doc, "[Candidate / Partner Name]", "Prospective Founding Executive / Partner")
    
    path = os.path.join(OUT_DIR, "KABUOR_MUTUAL_NON_DISCLOSURE_AGREEMENT.docx")
    doc.save(path)
    print(f"Generated: {path}")


# ==============================================================================
# 2. ROLE-SPECIFIC EXECUTIVE OFFER LETTERS
# ==============================================================================
ROLES = [
    {
        "filename": "OFFER_LETTER_HEAD_OF_GROWTH.docx",
        "ref": "KAB-HR-OFF-GROWTH-001",
        "title": "Head of Growth & Commercial Sales",
        "pod": "Commercial & Merchant Acquisition Pod",
        "reporting": "Founder & Chief Executive Officer (Rooney Odhiambo Kabuor)",
        "salary_range": "KSh 250,000 – KSh 380,000 per month (Gross, subject to statutory deductions)",
        "bonus": "Up to 35% annual performance bonus tied to Net New ARR and active merchant milestones",
        "equity": "1.5% – 2.5% Equity Options under the Kabuor Builds ESOP Pool (4-year vesting, 1-year cliff)",
        "mission": "Spearhead nationwide merchant acquisition across wholesale distributors, retail supermarkets, and FMCG trade corridors (Nairobi Eastleigh, CBD, Industrial Area, Mombasa, Kisumu).",
        "kpis": [
            "Scale paying merchant base from 250 to 2,500 active businesses within 12 months.",
            "Drive monthly gross merchandise volume (GMV) processed on Kabuor ERP past KSh 500M.",
            "Establish distribution partnerships with Kenya Association of Manufacturers (KAM) and wholesale trade associations.",
            "Build and lead a high-performing field sales team of 8 regional merchant acquisition reps."
        ]
    },
    {
        "filename": "OFFER_LETTER_LEAD_PLATFORM_ARCHITECT.docx",
        "ref": "KAB-HR-OFF-ARCH-002",
        "title": "Lead Platform Architect (.NET / Distributed Systems)",
        "pod": "Platform & Cloud Engineering Pod",
        "reporting": "Founder & Chief Executive Officer (Rooney Odhiambo Kabuor)",
        "salary_range": "KSh 300,000 – KSh 450,000 per month (Gross, subject to statutory deductions)",
        "bonus": "Up to 30% annual performance bonus tied to system availability (99.95% SLA) and sub-50ms P95 API response times",
        "equity": "2.0% – 3.0% Equity Options under the Kabuor Builds ESOP Pool (4-year vesting, 1-year cliff)",
        "mission": "Own the technical architecture of Kabuor ERP's .NET 10 Minimal APIs, multi-tenant PostgreSQL clustering, SequenceGate thread arbitration, and high-concurrency ledger performance.",
        "kpis": [
            "Maintain 99.95%+ platform SLA across all multi-tenant environments under 500k+ daily transactions.",
            "Ensure zero-loss ledger invariants and gapless sequential document numbering under heavy peak concurrency.",
            "Architect database read-replicas, connection pooling (PgBouncer), and zero-downtime EF Core migrations.",
            "Oversee automated testing standards, keeping test coverage above 90% across financial and fiscal paths."
        ]
    },
    {
        "filename": "OFFER_LETTER_HEAD_OF_TAX_COMPLIANCE.docx",
        "ref": "KAB-HR-OFF-TAX-003",
        "title": "Head of Tax Compliance & eTIMS Architecture",
        "pod": "Regulatory, Fiscal & Fintech Integrations Pod",
        "reporting": "Founder & Chief Executive Officer (Rooney Odhiambo Kabuor)",
        "salary_range": "KSh 220,000 – KSh 320,000 per month (Gross, subject to statutory deductions)",
        "bonus": "Up to 25% annual performance bonus tied to KRA audit approvals and zero fiscal downtime",
        "equity": "1.0% – 1.8% Equity Options under the Kabuor Builds ESOP Pool (4-year vesting, 1-year cliff)",
        "mission": "Maintain an unassailable regulatory moat by leading native integration with the Kenya Revenue Authority (KRA eTIMS), statutory payroll authorities, and public fiscal standards.",
        "kpis": [
            "Maintain 100% cryptographic compliance with KRA eTIMS OSCU and VSCU real-time signing specifications.",
            "Ensure annual statutory payroll rule updates (PAYE, NSSF Tier I/II, SHIF 2.75%, Housing Levy) are automated seamlessly.",
            "Lead technical certification and regulatory interface with KRA officials and ICPAK accounting bodies.",
            "Build automated reconciliation tools that protect merchants from tax audit disqualifications."
        ]
    },
    {
        "filename": "OFFER_LETTER_HEAD_OF_MERCHANT_SUCCESS.docx",
        "ref": "KAB-HR-OFF-SUCCESS-004",
        "title": "Head of Merchant Success & Customer Delight",
        "pod": "Merchant Operations & Customer Delight Pod",
        "reporting": "Founder & Chief Executive Officer (Rooney Odhiambo Kabuor)",
        "salary_range": "KSh 180,000 – KSh 260,000 per month (Gross, subject to statutory deductions)",
        "bonus": "Up to 25% annual performance bonus tied to Gross Logo Retention (>95%) and Net Revenue Retention (>120%)",
        "equity": "0.8% – 1.5% Equity Options under the Kabuor Builds ESOP Pool (4-year vesting, 1-year cliff)",
        "mission": "Deliver world-class merchant onboarding, sub-5-minute technical support via WhatsApp and in-app chat, and guarantee zero churn across our retail and wholesale customer base.",
        "kpis": [
            "Maintain Gross Logo Retention above 95% across all paid tiers (Starter, Business, Growth).",
            "Achieve sub-5-minute first response time and 98%+ customer satisfaction (CSAT) rating.",
            "Manage merchant catalog migrations from legacy Excel/Tally systems into Kabuor ERP.",
            "Run community webinars and merchant academies in English and Kiswahili."
        ]
    },
    {
        "filename": "OFFER_LETTER_SENIOR_FRONTEND_PWA.docx",
        "ref": "KAB-HR-OFF-FE-005",
        "title": "Senior Edge & Frontend Engineer (React 19 / PWA)",
        "pod": "Platform & Cloud Engineering Pod",
        "reporting": "Lead Platform Architect / CEO",
        "salary_range": "KSh 200,000 – KSh 320,000 per month (Gross, subject to statutory deductions)",
        "bonus": "Up to 25% annual performance bonus tied to offline sync reliability and POS UX fluidity",
        "equity": "1.0% – 1.8% Equity Options under the Kabuor Builds ESOP Pool (4-year vesting, 1-year cliff)",
        "mission": "Craft the fastest, most reliable offline-first retail POS experience in emerging markets using modern React 19, ServiceWorkers, and IndexedDB caching.",
        "kpis": [
            "Ensure 100% reliability of offline POS kiosk mode during complete cellular and fiber network blackouts.",
            "Maintain sub-100ms UI interaction latency on entry-level Android and Windows tablet touchscreens.",
            "Integrate hardware peripherals: ESC/POS thermal receipt printers, USB/Bluetooth barcode scanners, and cash drawers.",
            "Optimize frontend bundle sizes and maintain 2.2-second clean Vite build pipelines."
        ]
    },
    {
        "filename": "OFFER_LETTER_HEAD_OF_MARKETING.docx",
        "ref": "KAB-HR-OFF-MKT-006",
        "title": "Head of Growth & Performance Marketing",
        "pod": "Growth & Marketing Pod",
        "reporting": "Founder & Chief Executive Officer (Rooney Odhiambo Kabuor)",
        "salary_range": "KSh 250,000 – KSh 360,000 per month (Gross, subject to statutory deductions)",
        "bonus": "Up to 35% annual performance bonus tied to CAC (< KSh 2,500) and Monthly Recurring Revenue growth",
        "equity": "1.5% – 2.5% Equity Options under the Kabuor Builds ESOP Pool (4-year vesting, 1-year cliff)",
        "mission": "Architect and lead Kabuor ERP's multi-channel growth engine: viral receipt loops, trade corridor blitzes, digital performance, and partner affiliate channels to acquire 10,000+ merchants.",
        "kpis": [
            "Scale active merchant subscriber base from 250 to 5,000 paying businesses within 18 months.",
            "Maintain Blended Customer Acquisition Cost (CAC) under KSh 2,500 with CAC Payback under 5 months.",
            "Optimize the 'Powered by Kabuor ERP' viral receipt loop to achieve a viral K-factor above 0.35.",
            "Manage and deploy growth marketing budget across trade activations, digital funnels, and referral channels."
        ]
    },
    {
        "filename": "OFFER_LETTER_FIELD_MARKETING_LEAD.docx",
        "ref": "KAB-HR-OFF-FIELD-007",
        "title": "Trade Corridor & Field Marketing Lead",
        "pod": "Growth & Marketing Pod",
        "reporting": "Head of Growth & Marketing",
        "salary_range": "KSh 160,000 – KSh 240,000 per month (Gross, subject to statutory deductions)",
        "bonus": "Up to 30% quarterly performance bonus tied to on-the-ground merchant activations and trade corridor density",
        "equity": "0.6% – 1.2% Equity Options under the Kabuor Builds ESOP Pool (4-year vesting, 1-year cliff)",
        "mission": "Lead on-the-ground BTL activations, merchant market storms, and the '3-Minute eTIMS Challenge' across commercial hubs in Nairobi (Eastleigh, Gikomba, Industrial Area), Mombasa, and Kisumu.",
        "kpis": [
            "Execute 20+ monthly trade corridor blitzes across wholesale hubs and supermarket belts.",
            "Achieve an on-site demonstration-to-onboarding conversion rate of > 40%.",
            "Manage hardware bundle promotions (tablets + thermal receipt printers) to drive instant till activations.",
            "Recruit and lead a squad of 12 energetic field market stormers and product demonstrators."
        ]
    },
    {
        "filename": "OFFER_LETTER_CONTENT_AND_BRAND_LEAD.docx",
        "ref": "KAB-HR-OFF-BRAND-008",
        "title": "Content, Social & Brand Marketing Lead",
        "pod": "Growth & Marketing Pod",
        "reporting": "Head of Growth & Marketing",
        "salary_range": "KSh 140,000 – KSh 200,000 per month (Gross, subject to statutory deductions)",
        "bonus": "Up to 25% annual performance bonus tied to organic reach, video views, and brand search volume",
        "equity": "0.5% – 1.0% Equity Options under the Kabuor Builds ESOP Pool (4-year vesting, 1-year cliff)",
        "mission": "Establish Kabuor ERP as the most recognizable, trusted SME brand in Kenya through authentic storytelling, merchant video case studies, TikTok/WhatsApp campaigns, and high-energy content.",
        "kpis": [
            "Grow Kabuor ERP's TikTok, YouTube, and LinkedIn channels past 500,000 monthly organic video impressions.",
            "Produce 4 weekly merchant spotlight videos across wholesale, retail, and manufacturing sectors (in English & Sheng).",
            "Demystify KRA eTIMS tax compliance and M-Pesa automated billing through viral educational content.",
            "Own the brand voice, event collateral, and merchant customer story library."
        ]
    },
    {
        "filename": "OFFER_LETTER_PARTNER_MARKETING_LEAD.docx",
        "ref": "KAB-HR-OFF-PARTNER-009",
        "title": "Partner Marketing & Channel Affiliates Lead",
        "pod": "Growth & Marketing Pod",
        "reporting": "Head of Growth & Marketing",
        "salary_range": "KSh 180,000 – KSh 260,000 per month (Gross, subject to statutory deductions)",
        "bonus": "Up to 30% performance bonus tied to affiliate merchant volume and partner revenue share milestones",
        "equity": "0.8% – 1.5% Equity Options under the Kabuor Builds ESOP Pool (4-year vesting, 1-year cliff)",
        "mission": "Build and scale Kabuor ERP's certified accountant (ICPAK) affiliate network, trade association partnerships (KAM, KNCCI), and POS hardware distribution channels.",
        "kpis": [
            "Onboard 250+ certified accounting firms and tax consultants onto the Kabuor Accountant Multi-Client Console.",
            "Drive 35% of all new merchant acquisitions through the 15% recurring affiliate revenue share program.",
            "Establish joint go-to-market partnerships with hardware distributors (POS printers, barcode scanners).",
            "Host quarterly ICPAK accredited tax modernization workshops and financial tech seminars."
        ]
    },
    {
        "filename": "EXECUTIVE_OFFER_LETTER_TEMPLATE.docx",
        "ref": "KAB-HR-OFF-EXEC-TEMPLATE",
        "title": "[Insert Executive Title, e.g., Chief Operating Officer / Head of Product]",
        "pod": "[Insert Department / Pod Name]",
        "reporting": "Founder & Chief Executive Officer (Rooney Odhiambo Kabuor)",
        "salary_range": "KSh [Insert Amount] per month (Gross, payable on the 28th of each month)",
        "bonus": "Up to [Insert %] annual performance bonus based on mutually agreed OKRs and platform milestones",
        "equity": "[Insert %] Equity Options under the Kabuor Builds ESOP Pool (4-year vesting, 1-year cliff)",
        "mission": "[Insert 1-2 sentence core mission for this executive appointment].",
        "kpis": [
            "[Insert Key Deliverable 1 - e.g., Scale specific business unit / deliver core architecture].",
            "[Insert Key Deliverable 2 - e.g., Manage strategic vendor / regulator partnerships].",
            "[Insert Key Deliverable 3 - e.g., Build and mentor high-performing team].",
            "[Insert Key Deliverable 4 - e.g., Achieve targeted operational efficiency / ARR targets]."
        ]
    }
]

def generate_offer_letter_doc(role_data):
    doc = create_base_document()
    add_letterhead(doc, role_data["ref"], "EXECUTIVE APPOINTMENT & EMPLOYMENT OFFER")
    
    # Recipient Info
    p_to = doc.add_paragraph()
    p_to.paragraph_format.space_before = Pt(0)
    p_to.paragraph_format.space_after = Pt(8)
    p_to.add_run("PRIVATE & CONFIDENTIAL\n").font.bold = True
    p_to.add_run("TO: [Candidate Full Legal Name]\n")
    p_to.add_run("ADDRESS: [Candidate Residential Address / Email / Phone]\n")
    p_to.add_run("LOCATION: Nairobi, Republic of Kenya")
    
    # Subject Line
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(6)
    p_sub.paragraph_format.space_after = Pt(10)
    r_sub = p_sub.add_run(f"RE: APPOINTMENT OFFER — {role_data['title'].upper()}")
    r_sub.font.name = "Georgia"
    r_sub.font.size = Pt(11.5)
    r_sub.font.bold = True
    r_sub.font.color.rgb = BRAND_NAVY
    
    add_body_p(doc, 
        f"Dear [Candidate First Name],\n\n"
        f"On behalf of Kabuor Builds Limited, I am delighted to extend this formal offer of employment for the position of {role_data['title']}. "
        f"Following our extensive discussions regarding Kabuor ERP and the scaling of our compound financial operating system across East Africa, "
        f"we are convinced that your leadership, domain expertise, and entrepreneurial drive make you the ideal executive to lead our {role_data['pod']}.",
        bold_prefix="")
    
    add_heading_styled(doc, "1. Position, Reporting & Core Mission", level=1)
    add_body_p(doc, role_data['title'], bold_prefix="Position Title:")
    add_body_p(doc, role_data['pod'], bold_prefix="Organizational Pod:")
    add_body_p(doc, role_data['reporting'], bold_prefix="Reporting Line:")
    add_body_p(doc, "Kabuor Builds Limited HQ, The Mirage Tower, Chiromo Road, Westlands, Nairobi (with flexible hybrid working arrangements).", bold_prefix="Primary Location:")
    add_body_p(doc, role_data['mission'], bold_prefix="Core Mission:")
    
    add_heading_styled(doc, "2. Key Objectives & Performance Milestones (KPIs)", level=1)
    add_body_p(doc, "In this leadership role, your initial 12-to-18-month strategic milestones will focus on:")
    for kpi in role_data["kpis"]:
        add_bullet(doc, kpi)
    
    add_heading_styled(doc, "3. Remuneration, Equity & Executive Benefits", level=1)
    add_body_p(doc, "The comprehensive executive compensation package for this appointment is structured as follows:")
    
    comp_rows = [
        ["Monthly Base Salary", role_data["salary_range"]],
        ["Performance Incentive", role_data["bonus"]],
        ["Equity Stock Options (ESOP)", role_data["equity"]],
        ["Medical & Health Insurance", "Comprehensive inpatient/outpatient cover for employee + direct dependents (Tier-1 private hospitals in Kenya)"],
        ["Statutory Deductions", "Subject to applicable Kenyan statutory deductions: PAYE, NSSF Tier I/II, SHIF (2.75%), Affordable Housing Levy (1.5%)"],
        ["Annual Leave", "24 working days paid annual leave per calendar year, plus gazetted public holidays"]
    ]
    add_table_grid(doc, ["Compensation Component", "Terms & Details"], comp_rows)
    
    add_heading_styled(doc, "4. ESOP Vesting & Equity Mechanics", level=1)
    add_body_p(doc, 
        "Your equity option grant represents an essential component of your executive alignment with the long-term enterprise valuation of Kabuor ERP. "
        "The equity shall vest over a standard four (4) year period, subject to a one (1) year cliff, wherein 25% vests upon the first anniversary of your start date, "
        "with the remaining 75% vesting in equal monthly increments over the subsequent 36 months, governed by the Kabuor Builds Employee Stock Option Scheme.",
        bold_prefix="Vesting Schedule:")
    
    add_heading_styled(doc, "5. Intellectual Property & Confidentiality", level=1)
    add_body_p(doc, 
        "You acknowledge and agree that all proprietary code, database architectures, inventions, algorithms, trade secrets, "
        "and client relationships developed during your employment belong exclusively and absolutely to Kabuor Builds Limited. "
        "This appointment is strictly conditional upon your execution of our standard Mutual Non-Disclosure & Proprietary Inventions Agreement.",
        bold_prefix="IP Assignment:")
    
    add_heading_styled(doc, "6. Commencement & Acceptance", level=1)
    add_body_p(doc, 
        "This offer is open for formal acceptance until [Insert Expiry Date, e.g., 5 business days from receipt]. "
        "Your anticipated commencement date is [Insert Start Date, e.g., 1st December 2026]. "
        "To confirm your acceptance, please sign, date, and return the duplicate copy of this letter.",
        bold_prefix="Offer Validity:")
    
    add_dual_signatures(doc, "[Candidate Full Legal Name]", role_data["title"])
    
    path = os.path.join(OUT_DIR, role_data["filename"])
    doc.save(path)
    print(f"Generated: {path}")

def main():
    print("Generating Executive HR & Recruitment Word Documents (.docx)...")
    generate_nda_doc()
    for role in ROLES:
        generate_offer_letter_doc(role)
    print("\nAll 7 documents successfully created in:", OUT_DIR)

if __name__ == "__main__":
    main()
