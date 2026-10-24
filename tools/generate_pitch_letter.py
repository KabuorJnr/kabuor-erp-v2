#!/usr/bin/env python3
"""
Generates an executive pitch letter to Dr. Kennedy Oyoo in Microsoft Word (.docx) format
using the official Kabuor Builds Limited letterhead.
"""

import os
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "recruitment"))
os.makedirs(OUT_DIR, exist_ok=True)

BRAND_NAVY = RGBColor(10, 37, 64)       # #0A2540
ACCENT_BLUE = RGBColor(0, 112, 240)     # #0070F0
SLATE_GRAY = RGBColor(74, 85, 104)      # #4A5568
CHARCOAL = RGBColor(26, 32, 44)         # #1A202C

def set_cell_background(cell, fill_hex):
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def generate_pitch_letter():
    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)
        section.page_width = Inches(8.27)  # A4
        section.page_height = Inches(11.69)

    # -------------------------------------------------------------
    # LETTERHEAD
    # -------------------------------------------------------------
    tbl_hdr = doc.add_table(rows=1, cols=2)
    tbl_hdr.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_hdr.autofit = False
    
    col_w = [Inches(4.3), Inches(2.27)]
    for i, col in enumerate(tbl_hdr.columns):
        col.width = col_w[i]
        
    c_left, c_right = tbl_hdr.rows[0].cells[0], tbl_hdr.rows[0].cells[1]
    
    # Left Brand
    p_logo = c_left.paragraphs[0]
    p_logo.paragraph_format.space_after = Pt(2)
    r_logo = p_logo.add_run("KABUOR BUILDS LIMITED")
    r_logo.font.name = "Georgia"
    r_logo.font.size = Pt(14)
    r_logo.font.bold = True
    r_logo.font.color.rgb = BRAND_NAVY
    
    p_sub = c_left.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(0)
    r_sub = p_sub.add_run("KABUOR ERP · FINANCIAL OPERATING SYSTEM")
    r_sub.font.name = "Calibri"
    r_sub.font.size = Pt(8.5)
    r_sub.font.bold = True
    r_sub.font.color.rgb = ACCENT_BLUE
    
    # Right Address
    p_addr = c_right.paragraphs[0]
    p_addr.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_addr.paragraph_format.space_after = Pt(1)
    addr_lines = [
        "The Mirage Tower, Mezzanine 2",
        "Chiromo Road, Westlands, Nairobi",
        "Republic of Kenya · P.O. Box 45210-00100",
        "rooney@kabuor.com · www.kabuor.com"
    ]
    for line in addr_lines:
        r = p_addr.add_run(line + "\n")
        r.font.name = "Calibri"
        r.font.size = Pt(8)
        r.font.color.rgb = SLATE_GRAY
        
    # Divider Rule
    p_rule = doc.add_paragraph()
    p_rule.paragraph_format.space_before = Pt(4)
    p_rule.paragraph_format.space_after = Pt(10)
    p_bdr = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="14" w:space="1" w:color="0A2540"/></w:pBdr>')
    p_rule._p.get_or_add_pPr().append(p_bdr)
    
    # Meta Block
    t_meta = doc.add_table(rows=1, cols=2)
    t_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, col in enumerate(t_meta.columns):
        col.width = col_w[i]
    r_meta = t_meta.rows[0]
    
    p_m_l = r_meta.cells[0].paragraphs[0]
    p_m_l.paragraph_format.space_after = Pt(0)
    p_m_l.add_run("REF: KAB-EXEC-PITCH-2026-01\n").font.bold = True
    p_m_l.runs[0].font.size = Pt(9)
    p_m_l.runs[0].font.color.rgb = BRAND_NAVY
    p_m_l.add_run("CLASSIFICATION: EXECUTIVE STRATEGIC BRIEF").font.size = Pt(8.5)
    
    p_m_r = r_meta.cells[1].paragraphs[0]
    p_m_r.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_m_r.paragraph_format.space_after = Pt(0)
    p_m_r.add_run("DATE: 25th October 2026\n").font.size = Pt(9)
    p_m_r.add_run("STATUS: CONFIDENTIAL").font.size = Pt(8.5)
    p_m_r.runs[1].font.color.rgb = ACCENT_BLUE
    
    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    
    # Recipient Info
    p_to = doc.add_paragraph()
    p_to.paragraph_format.space_after = Pt(8)
    p_to.add_run("TO: ").font.bold = True
    p_to.add_run("Dr. Kennedy Oyoo\n").font.bold = True
    p_to.add_run("Distinguished Scholar, Enterprise Systems & Technology Leader\n")
    p_to.add_run("Nairobi, Kenya / International\n\n")
    p_to.add_run("SUBJECT: STRATEGIC BRIEFING & INVITATION TO REVIEW KABUOR ERP — THE FINANCIAL OPERATING SYSTEM FOR AFRICAN COMMERCE").font.bold = True
    p_to.runs[4].font.name = "Georgia"
    p_to.runs[4].font.size = Pt(11)
    p_to.runs[4].font.color.rgb = BRAND_NAVY
    
    # Letter Body
    p_b1 = doc.add_paragraph()
    p_b1.paragraph_format.space_after = Pt(8)
    p_b1.paragraph_format.line_spacing = 1.15
    p_b1.add_run(
        "Dear Dr. Kennedy Oyoo,\n\n"
        "I hope this letter finds you well. I am reaching out to you with great respect for your distinguished career, deep scholarship, "
        "and proven leadership in enterprise systems, information architecture, and technological innovation.\n\n"
        "I am writing to formally introduce you to Kabuor ERP, a next-generation cloud business operating system and immutable financial ledger "
        "engineered natively for the unique commercial realities of East Africa. Given your profound expertise in enterprise data architecture "
        "and large-scale digital transformation, I would be deeply honored to present our technical architecture to you, discuss our market trajectory, "
        "and explore potential strategic advisory or collaborative engagement."
    )
    for r in p_b1.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(10)
        r.font.color.rgb = CHARCOAL

    # The Problem & The Thesis
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(8)
    h1.paragraph_format.space_after = Pt(4)
    r_h1 = h1.add_run("1. The Enterprise Dilemma in African Commerce")
    r_h1.font.name = "Georgia"
    r_h1.font.size = Pt(11.5)
    r_h1.font.bold = True
    r_h1.font.color.rgb = BRAND_NAVY
    
    p_b2 = doc.add_paragraph()
    p_b2.paragraph_format.space_after = Pt(6)
    p_b2.paragraph_format.line_spacing = 1.15
    p_b2.add_run(
        "For decades, African enterprises and SMEs have been forced to rely on imported ERP systems (SAP, NetSuite, Odoo, QuickBooks). "
        "While sophisticated in Western contexts, these systems fail catastrophically when deployed in our market due to three systemic mismatches:\n\n"
        "1. Disconnected Payment Rails: Commerce in Kenya settles on Safaricom M-Pesa (over 84% of B2B/retail transactions), yet imported systems "
        "treat mobile money as an afterthought requiring fragile third-party middleware and daily manual reconciliation.\n"
        "2. Regulatory & Fiscal Mandates: The Kenya Revenue Authority (KRA) now legally enforces eTIMS real-time cryptographic invoice signing, "
        "disqualifying any business deduction not authenticated via eTIMS. Foreign ERPs cannot natively fiscalize without expensive $1,000 ESD hardware.\n"
        "3. Intermittent Infrastructure: When fiber internet cuts or power drops in a retail kiosk or supermarket, cloud-only systems freeze, "
        "paralyzing physical checkouts and inventory ledgers."
    )
    for r in p_b2.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        r.font.color.rgb = CHARCOAL

    # What Makes Kabuor ERP Superior
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(8)
    h2.paragraph_format.space_after = Pt(4)
    r_h2 = h2.add_run("2. The Kabuor ERP Breakthrough: Architectural Innovation")
    r_h2.font.name = "Georgia"
    r_h2.font.size = Pt(11.5)
    r_h2.font.bold = True
    r_h2.font.color.rgb = BRAND_NAVY
    
    p_b3 = doc.add_paragraph()
    p_b3.paragraph_format.space_after = Pt(6)
    p_b3.paragraph_format.line_spacing = 1.15
    p_b3.add_run(
        "Rather than building a wrapper around legacy software, we architected a high-throughput modular monolith (.NET 10 Minimal APIs + React 19 PWA) "
        "designed from the metal up for emerging-market scale:\n\n"
        "• Native KRA eTIMS Cryptographic Signing: Serializes invoices into deterministic KRA OSCU/VSCU payloads, generating official QR codes and control numbers inside the core transaction loop in under 12 milliseconds.\n"
        "• Real-Time M-Pesa Ledger Orchestration: Safaricom C2B and STK Push webhooks are bound directly into an immutable double-entry general ledger, automatically clearing debtor receivables without human intervention.\n"
        "• SequenceGate Concurrency Arbiter: A patent-pending in-memory thread synchronization mechanism that guarantees gapless, monotonic sequential document numbering under heavy concurrent bursts across multiple tills, eliminating database deadlocks.\n"
        "• Offline-First POS Kiosk Resilience: Edge Progressive Web App caching allows cashiers to ring up sales and print receipts during complete internet blackouts, automatically syncing FIFO queues idempotently upon network recovery.\n"
        "• 3-Minute Self-Serve Onboarding: Non-technical shopkeepers go from registration to issuing their first legal eTIMS tax invoice in under 180 seconds."
    )
    for r in p_b3.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        r.font.color.rgb = CHARCOAL

    # Technical Benchmarks Table
    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(8)
    h3.paragraph_format.space_after = Pt(4)
    r_h3 = h3.add_run("3. System Verification & Scale Readiness")
    r_h3.font.name = "Georgia"
    r_h3.font.size = Pt(11.5)
    r_h3.font.bold = True
    r_h3.font.color.rgb = BRAND_NAVY

    benchmarks = [
        ["Daily Transaction Throughput", "500,000+ daily transactions across 20+ tenant companies stress-tested cleanly"],
        ["Automated Test Suite", "127 / 127 automated tests passing (100% pass rate) covering concurrency, security, and eTIMS"],
        ["Multi-Tenant Isolation", "Two-phase enforcement: EF Core global query filters + StampAndAudit write validator"],
        ["Availability & DR", "99.95% target SLA, RPO < 15 minutes via continuous WAL archiving, encrypted pg_dump backups"],
        ["Statutory Payroll Engine", "Automated 2026 Kenyan tax rules: PAYE, NSSF Tier I/II, SHIF (2.75%), Affordable Housing Levy (1.5%)"]
    ]
    
    t_bench = doc.add_table(rows=len(benchmarks) + 1, cols=2)
    t_bench.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_bench.autofit = False
    
    b_w = [Inches(2.3), Inches(4.27)]
    for i, col in enumerate(t_bench.columns):
        col.width = b_w[i]
        
    hdr_b = t_bench.rows[0]
    hdr_b.cells[0].paragraphs[0].add_run("Architectural Metric").font.bold = True
    hdr_b.cells[1].paragraphs[0].add_run("Demonstrated Performance & Capability").font.bold = True
    for c in hdr_b.cells:
        set_cell_background(c, "0A2540")
        set_cell_margins(c, 90, 90, 110, 110)
        c.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
        c.paragraphs[0].runs[0].font.size = Pt(8.5)
        
    for r_idx, (m, val) in enumerate(benchmarks):
        row = t_bench.rows[r_idx + 1]
        bg = "FFFFFF" if r_idx % 2 == 0 else "F7FAFC"
        for c_idx, text in enumerate([m, val]):
            cell = row.cells[c_idx]
            set_cell_background(cell, bg)
            set_cell_margins(cell, 70, 70, 110, 110)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            run = p.add_run(text)
            run.font.name = "Calibri"
            run.font.size = Pt(8.5)
            if c_idx == 0:
                run.font.bold = True
                run.font.color.rgb = BRAND_NAVY

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # The Strategic Ask & Conclusion
    h4 = doc.add_paragraph()
    h4.paragraph_format.space_before = Pt(8)
    h4.paragraph_format.space_after = Pt(4)
    r_h4 = h4.add_run("4. The Invitation & Next Steps")
    r_h4.font.name = "Georgia"
    r_h4.font.size = Pt(11.5)
    r_h4.font.bold = True
    r_h4.font.color.rgb = BRAND_NAVY

    p_close = doc.add_paragraph()
    p_close.paragraph_format.space_after = Pt(10)
    p_close.paragraph_format.line_spacing = 1.15
    p_close.add_run(
        "Dr. Oyoo, we are currently gearing up for our institutional Series A expansion ($12M–$15M valuation target) and nationwide merchant rollout. "
        "As someone with an exceptional grasp of information systems and technology leadership, your perspective on our enterprise architecture, "
        "data integrity safeguards, and institutional scaling strategy would be invaluable.\n\n"
        "I would welcome the opportunity to host you for a private 30-minute demonstration of the live Kabuor ERP platform—walking you through "
        "our offline PWA sync engine, our SequenceGate concurrency arbiter, and our automated KRA/M-Pesa integration rails.\n\n"
        "We are also actively curating our Strategic Advisory Board and would be thrilled to discuss a formal advisory relationship with equity participation.\n\n"
        "Thank you very much for your time and consideration. I look forward to the privilege of speaking with you."
    )
    for r in p_close.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        r.font.color.rgb = CHARCOAL

    # Sign-off
    p_sign = doc.add_paragraph()
    p_sign.paragraph_format.space_before = Pt(8)
    p_sign.paragraph_format.space_after = Pt(2)
    p_sign.add_run("Yours sincerely,\n\n\n").font.size = Pt(9.5)
    p_sign.add_run("_________________________________________\n")
    p_sign.add_run("Rooney Odhiambo Kabuor\n").font.bold = True
    p_sign.add_run("Founder & Chief Executive Officer\n")
    p_sign.add_run("Kabuor Builds Limited · Kabuor ERP\n")
    p_sign.add_run("Direct: +254 700 000 000 | rooney@kabuor.com | The Mirage Tower, Westlands, Nairobi")
    for r in p_sign.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(9)

    out_file = os.path.join(OUT_DIR, "PITCH_LETTER_DR_KENNEDY_OYOO.docx")
    doc.save(out_file)
    print(f"Generated: {out_file}")

if __name__ == "__main__":
    generate_pitch_letter()
