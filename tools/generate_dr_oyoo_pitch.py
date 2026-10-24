#!/usr/bin/env python3
"""
Generates the executive pitch letter to Dr. Kennedy Oyoo (Director of Enterprise Systems, GTRI)
in Microsoft Word (.docx) format using the official Kabuor Builds Limited letterhead.
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
EMERALD_GREEN = RGBColor(16, 128, 67)   # #108043

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

def generate_dr_oyoo_letter():
    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)
        section.page_width = Inches(8.27)  # A4
        section.page_height = Inches(11.69)

    # -------------------------------------------------------------
    # CORPORATE LETTERHEAD
    # -------------------------------------------------------------
    tbl_hdr = doc.add_table(rows=1, cols=2)
    tbl_hdr.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_hdr.autofit = False
    
    col_w = [Inches(4.3), Inches(2.27)]
    for i, col in enumerate(tbl_hdr.columns):
        col.width = col_w[i]
        
    c_left, c_right = tbl_hdr.rows[0].cells[0], tbl_hdr.rows[0].cells[1]
    
    # Left Brand Name
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
    
    # Right Address Details
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
    
    # Meta Details
    t_meta = doc.add_table(rows=1, cols=2)
    t_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, col in enumerate(t_meta.columns):
        col.width = col_w[i]
    r_meta = t_meta.rows[0]
    
    p_m_l = r_meta.cells[0].paragraphs[0]
    p_m_l.paragraph_format.space_after = Pt(0)
    p_m_l.add_run("REF: KAB-EXEC-OYOO-2026\n").font.bold = True
    p_m_l.runs[0].font.size = Pt(9)
    p_m_l.runs[0].font.color.rgb = BRAND_NAVY
    p_m_l.add_run("CLASSIFICATION: EXECUTIVE STRATEGIC BRIEF").font.size = Pt(8.5)
    
    p_m_r = r_meta.cells[1].paragraphs[0]
    p_m_r.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_m_r.paragraph_format.space_after = Pt(0)
    p_m_r.add_run("DATE: 25th October 2026\n").font.size = Pt(9)
    p_m_r.add_run("STATUS: STRICTLY CONFIDENTIAL").font.size = Pt(8.5)
    p_m_r.runs[1].font.color.rgb = ACCENT_BLUE
    
    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    
    # -------------------------------------------------------------
    # RECIPIENT INFORMATION (TAILORED TO HIS PROFILE)
    # -------------------------------------------------------------
    p_to = doc.add_paragraph()
    p_to.paragraph_format.space_after = Pt(8)
    p_to.add_run("TO: ").font.bold = True
    p_to.add_run("Dr. Kennedy Oyoo, Ph.D.\n").font.bold = True
    p_to.add_run("Director, Enterprise Systems Department (ESD) & Principal Research Associate\n")
    p_to.add_run("Georgia Tech Research Institute (GTRI) | Faculty, Tulane University\n")
    p_to.add_run("Atlanta, Georgia, United States of America\n\n")
    
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(10)
    r_sub = p_sub.add_run("SUBJECT: STRATEGIC BRIEFING & INVITATION TO REVIEW KABUOR ERP — THE COMPOUND FINANCIAL OPERATING SYSTEM FOR AFRICAN COMMERCE")
    r_sub.font.name = "Georgia"
    r_sub.font.size = Pt(11)
    r_sub.font.bold = True
    r_sub.font.color.rgb = BRAND_NAVY
    
    # -------------------------------------------------------------
    # PERSONAL INTRODUCTION & RESPECT FOR HIS WORK
    # -------------------------------------------------------------
    p_intro = doc.add_paragraph()
    p_intro.paragraph_format.space_after = Pt(8)
    p_intro.paragraph_format.line_spacing = 1.15
    p_intro.add_run(
        "Dear Dr. Kennedy Oyoo,\n\n"
        "I hope this letter finds you well. I am reaching out to you with profound admiration for your distinguished career, deep scholarship in Information Science, "
        "and your leadership as Director of the Enterprise Systems Department at the Georgia Tech Research Institute (GTRI). Your extensive work spanning enterprise "
        "systems architecture, digital transformation, and scalable software engineering represents the highest standard of technical rigor in our field.\n\n"
        "I am writing to you from Nairobi to formally present Kabuor ERP—a next-generation compound business operating system and immutable financial ledger "
        "engineered from first principles for East African commerce. Given your preeminent stature in enterprise systems and your connection to the region, "
        "I would be deeply honored to share our architectural innovations with you, seek your critical counsel, and explore your potential involvement as a "
        "Senior Strategic Advisor and Advisory Board Member as we prepare for our institutional Series A scaling phase."
    )
    for r in p_intro.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        r.font.color.rgb = CHARCOAL
        
    # -------------------------------------------------------------
    # SECTION 1: THE ENTERPRISE PROBLEM
    # -------------------------------------------------------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(8)
    h1.paragraph_format.space_after = Pt(4)
    r_h1 = h1.add_run("1. The Enterprise Systems Impasse in African Commerce")
    r_h1.font.name = "Georgia"
    r_h1.font.size = Pt(11)
    r_h1.font.bold = True
    r_h1.font.color.rgb = BRAND_NAVY
    
    p_p1 = doc.add_paragraph()
    p_p1.paragraph_format.space_after = Pt(6)
    p_p1.paragraph_format.line_spacing = 1.15
    p_p1.add_run(
        "As someone who directs enterprise systems at the institutional level, you are acutely aware of the 'ERP impedance mismatch.' "
        "For the past two decades, African enterprises and SMEs have attempted to deploy Western platforms (SAP, NetSuite, Odoo, QuickBooks). "
        "In our market, these implementations suffer from an over 70% dissatisfaction rate because they are built on architectural assumptions "
        "that simply do not exist in emerging economies:\n\n"
        "• Mobile Money as the Sovereign Rail: Over 84% of B2B and retail transactions in Kenya settle via Safaricom M-Pesa. Imported ERPs treat mobile money "
        "as an external webhook requiring fragile middleware, batch uploads, and manual daily reconciliations.\n"
        "• Mandatory Real-Time Cryptographic Fiscalization: The Kenya Revenue Authority (KRA) has legally mandated that every commercial invoice must be "
        "cryptographically signed via eTIMS in real time to qualify as a deductible business expense. Foreign ERPs require expensive $1,000 ESD hardware bridge boxes.\n"
        "• The Intermittent Edge: When fiber or power drops in a busy supermarket or wholesale depot, cloud-only systems freeze, halting trade and corrupting transactions."
    )
    for r in p_p1.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(9)
        r.font.color.rgb = CHARCOAL
        
    # -------------------------------------------------------------
    # SECTION 2: HOW KABUOR ERP BREAKS THE IMPASSE
    # -------------------------------------------------------------
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(8)
    h2.paragraph_format.space_after = Pt(4)
    r_h2 = h2.add_run("2. The Kabuor ERP Breakthrough: Architectural Highlights")
    r_h2.font.name = "Georgia"
    r_h2.font.size = Pt(11)
    r_h2.font.bold = True
    r_h2.font.color.rgb = BRAND_NAVY
    
    p_p2 = doc.add_paragraph()
    p_p2.paragraph_format.space_after = Pt(6)
    p_p2.paragraph_format.line_spacing = 1.15
    p_p2.add_run(
        "We rejected the point-solution model and built a high-throughput modular monolith (.NET 10 Minimal APIs + React 19 PWA) "
        "engineered for extreme performance, fault tolerance, and statutory compliance:\n\n"
        "1. Real-Time Cryptographic eTIMS Engine: Invoices are serialized into deterministic KRA OSCU/VSCU payloads, signed cryptographically, "
        "and stamped with official QR codes and control numbers within the core transaction loop in under 12 milliseconds.\n"
        "2. Direct M-Pesa General Ledger Orchestration: Safaricom C2B and STK push callbacks are validated via constant-time HMAC and bound directly into balanced "
        "double-entry General Ledger journal entries without manual staging, achieving automated sub-800ms reconciliation.\n"
        "3. SequenceGate Concurrency Arbiter: A proprietary thread-safe concurrency engine that guarantees gapless, monotonic sequential document numbering "
        "under heavy concurrent rushes across multi-till supermarkets, eliminating database table locking and deadlocks.\n"
        "4. Offline-First PWA Edge Kiosk: Progressive Web App edge caching enables physical retail kiosks to ring up sales and print receipts during complete "
        "internet dropouts, preserving sequence integrity and draining sales idempotently via background FIFO sync upon reconnection.\n"
        "5. Sub-3-Minute Frictionless Onboarding: Non-technical merchants can register, import items, connect M-Pesa, and issue their first legal tax invoice "
        "in under 180 seconds."
    )
    for r in p_p2.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(9)
        r.font.color.rgb = CHARCOAL

    # -------------------------------------------------------------
    # SECTION 3: SYSTEM READINESS TABLE
    # -------------------------------------------------------------
    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(8)
    h3.paragraph_format.space_after = Pt(4)
    r_h3 = h3.add_run("3. Enterprise System Readiness & Verification Data")
    r_h3.font.name = "Georgia"
    r_h3.font.size = Pt(11)
    r_h3.font.bold = True
    r_h3.font.color.rgb = BRAND_NAVY

    data_points = [
        ["Throughput Benchmark", "Stress-tested for 500,000+ daily transactions across 20+ tenant companies cleanly"],
        ["Automated Test Suite", "127 / 127 automated regression tests passing (100% pass rate) with zero failures"],
        ["Multi-Tenant Isolation", "Two-phase enforcement: EF Core global query filters + StampAndAudit write validator"],
        ["Concurrency Integrity", "SequenceGate async semaphore locks + optimistic concurrency tokens on stock balances"],
        ["Statutory Payroll Engine", "Automated 2026 Kenyan tax rules: PAYE, NSSF Tier I/II, SHIF (2.75%), Housing Levy (1.5%)"]
    ]
    
    t_dp = doc.add_table(rows=len(data_points) + 1, cols=2)
    t_dp.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_dp.autofit = False
    
    for i, col in enumerate(t_dp.columns):
        col.width = [Inches(2.2), Inches(4.37)][i]
        
    hdr_dp = t_dp.rows[0]
    hdr_dp.cells[0].paragraphs[0].add_run("System Dimension").font.bold = True
    hdr_dp.cells[1].paragraphs[0].add_run("Demonstrated Performance & Capability").font.bold = True
    for c in hdr_dp.cells:
        set_cell_background(c, "0A2540")
        set_cell_margins(c, 80, 80, 100, 100)
        c.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
        c.paragraphs[0].runs[0].font.size = Pt(8.5)
        
    for r_idx, (dim, val) in enumerate(data_points):
        row = t_dp.rows[r_idx + 1]
        bg = "FFFFFF" if r_idx % 2 == 0 else "F7FAFC"
        for c_idx, text in enumerate([dim, val]):
            cell = row.cells[c_idx]
            set_cell_background(cell, bg)
            set_cell_margins(cell, 60, 60, 100, 100)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            run = p.add_run(text)
            run.font.name = "Calibri"
            run.font.size = Pt(8.5)
            if c_idx == 0:
                run.font.bold = True
                run.font.color.rgb = BRAND_NAVY

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # -------------------------------------------------------------
    # SECTION 4: THE INVITATION & NEXT STEPS
    # -------------------------------------------------------------
    h4 = doc.add_paragraph()
    h4.paragraph_format.space_before = Pt(8)
    h4.paragraph_format.space_after = Pt(4)
    r_h4 = h4.add_run("4. The Invitation: Advisory Board & Strategic Review")
    r_h4.font.name = "Georgia"
    r_h4.font.size = Pt(11)
    r_h4.font.bold = True
    r_h4.font.color.rgb = BRAND_NAVY

    p_close = doc.add_paragraph()
    p_close.paragraph_format.space_after = Pt(10)
    p_close.paragraph_format.line_spacing = 1.15
    p_close.add_run(
        "Dr. Oyoo, we are currently preparing for our institutional Series A financing round ($12M–$15M valuation target) and accelerating our nationwide merchant rollout. "
        "As an authority who directs enterprise systems at the highest level of academic and operational excellence, your critical review of our platform architecture, "
        "data governance framework, and institutional scaling strategy would be invaluable to us.\n\n"
        "I would welcome the privilege of hosting you for a confidential 30-minute virtual demonstration—walking you through our live offline PWA synchronization, "
        "our SequenceGate concurrency arbiter, and our automated KRA/M-Pesa integration rails.\n\n"
        "Furthermore, we are curating an elite Strategic Advisory Board of veteran technology leaders and would be thrilled to formally invite you to join us "
        "with an advisory equity allocation, helping guide Kabuor ERP into the undisputed financial operating system for African enterprise.\n\n"
        "Thank you immensely for your time and consideration. I look forward to the honor of connecting with you."
    )
    for r in p_close.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        r.font.color.rgb = CHARCOAL

    # Formal Sign-Off
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
    generate_dr_oyoo_letter()
