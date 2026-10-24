#!/usr/bin/env python3
"""
Generates the "Perfect Startup Job Offer Letter" in Word (.docx) format,
incorporating top-recruiter frameworks from Y Combinator, Carta, and Stripe:
- Founder "Why You" Opening
- Carta-Style Equity Value Modeler Table (Conservative, Target, Bull exits)
- Total Rewards Table (Base, Bonus, Tier-1 Health, Equipment Stipend)
- Plain-English IP & ESOP Mechanics
- Official Kabuor Builds Limited Corporate Letterhead
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

def build_perfect_offer_letter():
    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
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
        "founders@kabuor.com · www.kabuor.com"
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
    p_m_l.add_run("REF: KAB-OFF-PERFECT-2026\n").font.bold = True
    p_m_l.runs[0].font.size = Pt(9)
    p_m_l.runs[0].font.color.rgb = BRAND_NAVY
    p_m_l.add_run("CLASSIFICATION: CONFIDENTIAL EXECUTIVE OFFER").font.size = Pt(8.5)
    
    p_m_r = r_meta.cells[1].paragraphs[0]
    p_m_r.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_m_r.paragraph_format.space_after = Pt(0)
    p_m_r.add_run("DATE: [Insert Date]\n").font.size = Pt(9)
    p_m_r.add_run("EXPIRY: 5 Business Days From Delivery").font.size = Pt(8.5)
    p_m_r.runs[1].font.color.rgb = ACCENT_BLUE
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    
    # -------------------------------------------------------------
    # RECIPIENT & SUBJECT
    # -------------------------------------------------------------
    p_to = doc.add_paragraph()
    p_to.paragraph_format.space_after = Pt(8)
    p_to.add_run("TO: [Candidate Full Legal Name]\n").font.bold = True
    p_to.add_run("ADDRESS: [Candidate Address / Email / Phone]\n")
    p_to.add_run("RE: FORMAL APPOINTMENT OFFER — [INSERT POSITION TITLE]").font.bold = True
    p_to.runs[2].font.color.rgb = BRAND_NAVY
    p_to.runs[2].font.size = Pt(11)
    
    # -------------------------------------------------------------
    # THE "WHY YOU" PERSONAL OPENING (TOP RECRUITER FRAMEWORK)
    # -------------------------------------------------------------
    p_intro = doc.add_paragraph()
    p_intro.paragraph_format.space_after = Pt(8)
    p_intro.paragraph_format.line_spacing = 1.15
    p_intro.add_run(
        "Dear [Candidate First Name],\n\n"
        "On behalf of the founding team at Kabuor Builds Limited, I am beyond excited to formally offer you the position of "
        "[Insert Position Title].\n\n"
        "Throughout our interview rounds, our entire team was deeply energized by your vision, your technical/commercial mastery, "
        "and your track record in [mention specific candidate achievement, e.g., scaling fintech merchant rails / architecting high-availability cloud platforms]. "
        "We are not merely filling an open headcount; we are inviting you to become a foundational leader in building the compound financial operating system "
        "for commerce across East Africa. We believe that your leadership in this role will directly accelerate our trajectory toward market dominance.\n\n"
        "Below are the complete, transparent terms of your appointment and equity grant."
    )
    for r in p_intro.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(10)
        r.font.color.rgb = CHARCOAL
        
    # -------------------------------------------------------------
    # SECTION 1: ROLE & MISSION
    # -------------------------------------------------------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(10)
    h1.paragraph_format.space_after = Pt(4)
    r_h1 = h1.add_run("1. Position & Strategic Mission")
    r_h1.font.name = "Georgia"
    r_h1.font.size = Pt(11.5)
    r_h1.font.bold = True
    r_h1.font.color.rgb = BRAND_NAVY
    
    p_role = doc.add_paragraph()
    p_role.paragraph_format.space_after = Pt(6)
    p_role.paragraph_format.line_spacing = 1.12
    p_role.add_run("• Position Title: ").font.bold = True
    p_role.add_run("[Insert Position Title]\n")
    p_role.add_run("• Reporting Line: ").font.bold = True
    p_role.add_run("Founder & Chief Executive Officer (Rooney Odhiambo Kabuor)\n")
    p_role.add_run("• Operating Pod: ").font.bold = True
    p_role.add_run("[Insert Pod: Commercial Growth / Core Platform / Regulatory & Fiscal / Merchant Ops]\n")
    p_role.add_run("• Primary Location: ").font.bold = True
    p_role.add_run("Kabuor Builds HQ, The Mirage Tower, Westlands, Nairobi (Flexible Hybrid Work Model)\n")
    p_role.add_run("• Core Mission: ").font.bold = True
    p_role.add_run("[Insert 1-2 sentence high-level goal, e.g., Scale our merchant base from 250 to 5,000 businesses and own the nationwide wholesale distribution corridor].")
    for r in p_role.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        
    # -------------------------------------------------------------
    # SECTION 2: TOTAL REWARDS TABLE
    # -------------------------------------------------------------
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(8)
    h2.paragraph_format.space_after = Pt(4)
    r_h2 = h2.add_run("2. Comprehensive Total Rewards Structure")
    r_h2.font.name = "Georgia"
    r_h2.font.size = Pt(11.5)
    r_h2.font.bold = True
    r_h2.font.color.rgb = BRAND_NAVY
    
    rewards = [
        ["Monthly Base Salary", "KSh [Insert Amount, e.g., 300,000] per month (Gross, payable on the 28th of every month)"],
        ["Performance Incentive Bonus", "Up to [Insert %, e.g., 30%] annual bonus based on mutually agreed OKRs and platform growth targets"],
        ["Equity Ownership (ESOP)", "[Insert %, e.g., 2.0%] Common Stock Options under the Kabuor Builds ESOP Scheme (detailed below)"],
        ["Tier-1 Healthcare Coverage", "Comprehensive private inpatient and outpatient medical cover for you + direct family (Aga Khan, Nairobi Hospital)"],
        ["Equipment & Tech Stipend", "Latest Apple MacBook Pro or Lenovo ThinkPad workstation + KSh 10,000 monthly home fiber internet allowance"],
        ["Statutory Deductions", "Full compliance with 2026 Kenyan tax laws: PAYE, NSSF Tier I/II, SHIF (2.75%), Affordable Housing Levy (1.5%)"],
        ["Annual Leave & Rest", "24 paid working days annual leave per calendar year, plus all gazetted Kenyan public holidays"]
    ]
    
    t_rew = doc.add_table(rows=len(rewards) + 1, cols=2)
    t_rew.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_rew.autofit = False
    
    t_w = [Inches(2.3), Inches(4.27)]
    for i, col in enumerate(t_rew.columns):
        col.width = t_w[i]
        
    # Header
    hdr = t_rew.rows[0]
    hdr.cells[0].paragraphs[0].add_run("Total Rewards Component").font.bold = True
    hdr.cells[1].paragraphs[0].add_run("Contractual Terms & Provision").font.bold = True
    for c in hdr.cells:
        set_cell_background(c, "0A2540")
        set_cell_margins(c, 100, 100, 120, 120)
        c.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
        c.paragraphs[0].runs[0].font.size = Pt(9)
        
    for r_idx, (comp, detail) in enumerate(rewards):
        row = t_rew.rows[r_idx + 1]
        bg = "FFFFFF" if r_idx % 2 == 0 else "F7FAFC"
        for c_idx, val in enumerate([comp, detail]):
            cell = row.cells[c_idx]
            set_cell_background(cell, bg)
            set_cell_margins(cell, 80, 80, 120, 120)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            run = p.add_run(val)
            run.font.name = "Calibri"
            run.font.size = Pt(8.5)
            if c_idx == 0:
                run.font.bold = True
                run.font.color.rgb = BRAND_NAVY
                
    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    
    # -------------------------------------------------------------
    # SECTION 3: CARTA-STYLE EQUITY VALUE MODELER
    # -------------------------------------------------------------
    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(8)
    h3.paragraph_format.space_after = Pt(4)
    r_h3 = h3.add_run("3. The Equity Opportunity: How Your Ownership Creates Wealth")
    r_h3.font.name = "Georgia"
    r_h3.font.size = Pt(11.5)
    r_h3.font.bold = True
    r_h3.font.color.rgb = BRAND_NAVY
    
    p_eq_desc = doc.add_paragraph()
    p_eq_desc.paragraph_format.space_after = Pt(6)
    p_eq_desc.paragraph_format.line_spacing = 1.15
    p_eq_desc.add_run(
        "Top technology companies do not build wealth solely through monthly salaries; life-changing wealth is built through equity ownership. "
        "At Kabuor ERP, we believe in radical transparency. Below is an explicit model illustrating the projected financial value of your "
        "[Insert %, e.g., 2.0%] equity grant across three valuation milestones, based on our current Series A targets and regional growth projections:"
    )
    for r in p_eq_desc.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        r.font.color.rgb = CHARCOAL
        
    equity_models = [
        ["Current Round (Series A Target)", "$12,000,000", "[2.0%]", "$240,000 (~KSh 31,200,000)", "Baseline valuation supported by current core architecture & ARR"],
        ["Milestone 1 (Series B / 5,000 Merchants)", "$45,000,000", "[1.7% post-dilution]", "$765,000 (~KSh 99,450,000)", "Expansion into Kenya secondary cities & wholesale supply chain"],
        ["Milestone 2 (Series C / Strategic Exit)", "$120,000,000", "[1.4% post-dilution]", "$1,680,000 (~KSh 218,400,000)", "Regional East African dominance + Embedded Merchant Lending"]
    ]
    
    t_eq = doc.add_table(rows=len(equity_models) + 1, cols=5)
    t_eq.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_eq.autofit = False
    
    eq_w = [Inches(1.5), Inches(1.0), Inches(0.8), Inches(1.5), Inches(1.77)]
    for i, col in enumerate(t_eq.columns):
        col.width = eq_w[i]
        
    hdr_eq = t_eq.rows[0]
    headers_eq = ["Growth Milestone", "Company Valuation", "Ownership", "Estimated Equity Value", "Operational Milestone"]
    for i, h in enumerate(headers_eq):
        cell = hdr_eq.cells[i]
        set_cell_background(cell, "0A2540")
        set_cell_margins(cell, 100, 100, 80, 80)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)
        r.font.size = Pt(8)
        
    for r_idx, row_vals in enumerate(equity_models):
        row = t_eq.rows[r_idx + 1]
        bg = "FFFFFF" if r_idx % 2 == 0 else "F7FAFC"
        for c_idx, val in enumerate(row_vals):
            cell = row.cells[c_idx]
            set_cell_background(cell, bg)
            set_cell_margins(cell, 70, 70, 80, 80)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            run = p.add_run(val)
            run.font.name = "Calibri"
            run.font.size = Pt(8)
            if c_idx == 3:
                run.font.bold = True
                run.font.color.rgb = EMERALD_GREEN
            elif c_idx == 0:
                run.font.bold = True
                
    # Vesting note
    p_vest = doc.add_paragraph()
    p_vest.paragraph_format.space_before = Pt(6)
    p_vest.paragraph_format.space_after = Pt(6)
    r_v = p_vest.add_run("Vesting Mechanics: Standard 4-year vesting schedule with a 1-year cliff (25% vests on your first anniversary, with the remaining 75% vesting in equal monthly increments over the subsequent 36 months).")
    r_v.font.size = Pt(8.5)
    r_v.font.italic = True
    r_v.font.color.rgb = SLATE_GRAY
    
    # -------------------------------------------------------------
    # SECTION 4: INTELLECTUAL PROPERTY & TERMS
    # -------------------------------------------------------------
    h4 = doc.add_paragraph()
    h4.paragraph_format.space_before = Pt(8)
    h4.paragraph_format.space_after = Pt(4)
    r_h4 = h4.add_run("4. Intellectual Property & Protective Covenants")
    r_h4.font.name = "Georgia"
    r_h4.font.size = Pt(11.5)
    r_h4.font.bold = True
    r_h4.font.color.rgb = BRAND_NAVY
    
    p_ip = doc.add_paragraph()
    p_ip.paragraph_format.space_after = Pt(6)
    p_ip.paragraph_format.line_spacing = 1.12
    p_ip.add_run(
        "• Intellectual Property Assignment: All software code, database models, technical innovations, and customer relationships "
        "developed during your tenure remain the sole, absolute, and exclusive property of Kabuor Builds Limited.\n"
        "• Restrictive Covenants: To protect the company's enterprise value, you agree to a standard 12-month post-employment non-solicitation "
        "of company employees, contractors, and institutional commercial partners.\n"
        "• Governing Law: This contract is governed by the Employment Act, 2007 of the Laws of the Republic of Kenya."
    )
    for r in p_ip.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(9)
        r.font.color.rgb = CHARCOAL
        
    # -------------------------------------------------------------
    # SECTION 5: ACCEPTANCE & FOUNDER CLOSING
    # -------------------------------------------------------------
    p_close = doc.add_paragraph()
    p_close.paragraph_format.space_before = Pt(6)
    p_close.paragraph_format.space_after = Pt(8)
    p_close.paragraph_format.line_spacing = 1.15
    p_close.add_run(
        "[Candidate First Name], we are building something truly historic for African commerce, and we hope you will choose to build it with us. "
        "This offer is open for acceptance until [Insert Expiry Date, e.g., Friday, 31st October 2026 at 5:00 PM EAT].\n\n"
        "To accept this appointment, please sign and return the duplicate copy below."
    )
    for r in p_close.runs:
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        
    # Signature Table
    tbl_sig = doc.add_table(rows=1, cols=2)
    tbl_sig.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_sig.autofit = False
    for i, col in enumerate(tbl_sig.columns):
        col.width = [Inches(3.3), Inches(3.27)][i]
    c_s1, c_s2 = tbl_sig.rows[0].cells[0], tbl_sig.rows[0].cells[1]
    
    p_s1 = c_s1.paragraphs[0]
    p_s1.paragraph_format.space_after = Pt(2)
    p_s1.add_run("FOR: KABUOR BUILDS LIMITED\n\n\n").font.bold = True
    p_s1.add_run("_________________________________________\n")
    p_s1.add_run("Rooney Odhiambo Kabuor\n").font.bold = True
    p_s1.add_run("Founder & Chief Executive Officer\nDate: ___________________________________")
    for r in p_s1.runs:
        r.font.size = Pt(8.5)
        
    p_s2 = c_s2.paragraphs[0]
    p_s2.paragraph_format.space_after = Pt(2)
    p_s2.add_run("ACCEPTED & AGREED:\n\n\n").font.bold = True
    p_s2.add_run("_________________________________________\n")
    p_s2.add_run("[Candidate Full Legal Name]\n").font.bold = True
    p_s2.add_run("[Insert Position Title]\nDate: ___________________________________")
    for r in p_s2.runs:
        r.font.size = Pt(8.5)
        
    out_path = os.path.join(OUT_DIR, "THE_PERFECT_STARTUP_OFFER_LETTER.docx")
    doc.save(out_path)
    print(f"Generated: {out_path}")

if __name__ == "__main__":
    build_perfect_offer_letter()
