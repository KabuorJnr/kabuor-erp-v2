# Shared layout for Kabuor's formal documents: A4, Times New Roman, black and white, numbered sections,
# contents page, ruled tables, running header and page numbers.
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, Table, TableStyle,
                                KeepTogether, CondPageBreak, NextPageTemplate)
from reportlab.platypus.tableofcontents import TableOfContents

F = r'C:\Windows\Fonts'
pdfmetrics.registerFont(TTFont('TNR', F + r'\times.ttf'))
pdfmetrics.registerFont(TTFont('TNR-B', F + r'\timesbd.ttf'))
pdfmetrics.registerFont(TTFont('TNR-I', F + r'\timesi.ttf'))
pdfmetrics.registerFont(TTFont('TNR-BI', F + r'\timesbi.ttf'))
addMapping('TNR', 0, 0, 'TNR'); addMapping('TNR', 1, 0, 'TNR-B'); addMapping('TNR', 0, 1, 'TNR-I'); addMapping('TNR', 1, 1, 'TNR-BI')

K = colors.black
GREY = colors.Color(0.45, 0.45, 0.45)
SHADE = colors.Color(0.93, 0.93, 0.93)
body = ParagraphStyle('body', fontName='TNR', fontSize=11, leading=15, alignment=TA_JUSTIFY, spaceAfter=7, textColor=K)
plain = ParagraphStyle('plain', parent=body, alignment=TA_LEFT)
small = ParagraphStyle('small', parent=plain, fontSize=9.5, leading=12.5, spaceAfter=4)
h1 = ParagraphStyle('h1', fontName='TNR-B', fontSize=15, leading=19, spaceBefore=6, spaceAfter=10, textColor=K)
h2 = ParagraphStyle('h2', fontName='TNR-B', fontSize=12.5, leading=16, spaceBefore=10, spaceAfter=6, textColor=K)
h3 = ParagraphStyle('h3', fontName='TNR-BI', fontSize=11, leading=15, spaceBefore=6, spaceAfter=4, textColor=K)
cell = ParagraphStyle('cell', fontName='TNR', fontSize=9.5, leading=12, textColor=K)
cellb = ParagraphStyle('cellb', parent=cell, fontName='TNR-B')
bullet = ParagraphStyle('bullet', parent=plain, leftIndent=16, bulletIndent=4, spaceAfter=3)
ref = ParagraphStyle('ref', parent=plain, leftIndent=0.45 * inch, firstLineIndent=-0.45 * inch, spaceAfter=5)
caption = ParagraphStyle('caption', parent=plain, fontName='TNR-B', fontSize=10, leading=13, spaceBefore=4, spaceAfter=3)
boxed = ParagraphStyle('boxed', parent=plain, fontSize=10.5, leading=14)


class Builder:
    def __init__(self, path, title, subject, running, author='David Kiragu'):
        self.story, self.n1, self.n2, self.tables = [], 0, 0, 0
        self.running = running
        doc = self.doc = BaseDocTemplate(path, pagesize=A4, leftMargin=2.4 * cm, rightMargin=2.4 * cm, topMargin=2.5 * cm, bottomMargin=2.3 * cm,
                                         title=title, author=author, subject=subject, creator='Kabuor Builds')
        frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        doc.addPageTemplates([PageTemplate(id='cover', frames=[frame]), PageTemplate(id='page', frames=[frame], onPage=self.header)])
        doc.afterFlowable = self.after
        self.width = doc.width

    def header(self, canv, doc):
        canv.saveState()
        canv.setFont('TNR', 9)
        canv.setFillColor(GREY)
        canv.drawString(self.doc.leftMargin, A4[1] - 1.5 * cm, self.running)
        canv.drawRightString(A4[0] - self.doc.rightMargin, A4[1] - 1.5 * cm, 'Confidential')
        canv.setStrokeColor(GREY); canv.setLineWidth(0.4)
        canv.line(self.doc.leftMargin, A4[1] - 1.65 * cm, A4[0] - self.doc.rightMargin, A4[1] - 1.65 * cm)
        canv.drawCentredString(A4[0] / 2, 1.3 * cm, f'Page {doc.page}')
        canv.restoreState()

    def after(self, f):
        lvl = getattr(f, 'toc_level', None)
        if lvl is not None:
            key = f'h{id(f)}'
            self.doc.canv.bookmarkPage(key)
            self.doc.canv.addOutlineEntry(f.getPlainText(), key, level=lvl)
            self.doc.notify('TOCEntry', (lvl, f.getPlainText(), self.doc.page, key))

    # ---- content helpers
    def P(self, t, s=None): self.story.append(Paragraph(t, s or body))
    def Ps(self, *ts):
        for t in ts: self.P(t)
    def H1(self, t, numbered=True, new_page=True):
        if numbered: self.n1 += 1; self.n2 = 0; t = f'{self.n1}. {t}'
        if new_page: self.story.append(PageBreak())
        else: self.story.append(CondPageBreak(4 * cm))
        p = Paragraph(t, h1); p.toc_level = 0; self.story.append(p)
    def H2(self, t):
        self.n2 += 1
        p = Paragraph(f'{self.n1}.{self.n2} {t}', h2); p.toc_level = 1
        self.story.append(CondPageBreak(3 * cm)); self.story.append(p)
    def H3(self, t): self.story.append(CondPageBreak(2.2 * cm)); self.story.append(Paragraph(t, h3))
    def B(self, items, style=None):
        for i in items: self.story.append(Paragraph(i, style or bullet, bulletText='•'))
    def N(self, items):
        for n, i in enumerate(items, 1): self.story.append(Paragraph(i, bullet, bulletText=f'{n}.'))
    def SP(self, h=6): self.story.append(Spacer(1, h))
    def BOX(self, title, text):
        inner = [Paragraph(f'<b>{title}</b>', boxed), Spacer(1, 3)] + [Paragraph(t, boxed) for t in (text if isinstance(text, list) else [text])]
        t = Table([[inner]], colWidths=[self.width])
        t.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 0.8, K), ('BACKGROUND', (0, 0), (-1, -1), SHADE), ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]))
        self.story.append(Spacer(1, 4)); self.story.append(t); self.story.append(Spacer(1, 8))
    def T(self, title, rows, widths, note=None):
        self.tables += 1
        total = sum(widths)
        cols = [w / total * self.width for w in widths]
        data = [[Paragraph(str(c), cellb if r == 0 else cell) for c in row] for r, row in enumerate(rows)]
        t = Table(data, colWidths=cols, repeatRows=1)
        t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BACKGROUND', (0, 0), (-1, 0), SHADE),
                               ('LINEABOVE', (0, 0), (-1, 0), 0.9, K), ('LINEBELOW', (0, 0), (-1, 0), 0.6, K), ('LINEBELOW', (0, -1), (-1, -1), 0.9, K),
                               ('LINEBELOW', (0, 1), (-1, -2), 0.25, GREY),
                               ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
        block = [Paragraph(f'Table {self.tables}. {title}', caption), t]
        if note: block.append(Paragraph(note, small))
        self.story.append(Spacer(1, 3))
        if len(rows) <= 14: self.story.append(KeepTogether(block))
        else: self.story.extend(block)
        self.story.append(Spacer(1, 8))

    def cover(self, kicker, title, subtitle, lines, control_rows):
        s = self.story
        s.append(Spacer(1, 3.2 * cm))
        s.append(Paragraph(kicker.upper(), ParagraphStyle('k', parent=plain, fontName='TNR-B', fontSize=10, leading=13, textColor=GREY)))
        s.append(Spacer(1, 6))
        s.append(Paragraph(title, ParagraphStyle('t', parent=plain, fontName='TNR-B', fontSize=26, leading=31)))
        s.append(Spacer(1, 8))
        s.append(Paragraph(subtitle, ParagraphStyle('st', parent=plain, fontName='TNR-I', fontSize=14, leading=18)))
        s.append(Spacer(1, 0.9 * cm))
        line = Table([['']], colWidths=[self.width], rowHeights=[2]); line.setStyle(TableStyle([('LINEABOVE', (0, 0), (-1, -1), 1.2, K)]))
        s.append(line)
        s.append(Spacer(1, 0.5 * cm))
        for l in lines: s.append(Paragraph(l, ParagraphStyle('cl', parent=plain, fontSize=11.5, leading=16)))
        s.append(Spacer(1, 1.6 * cm))
        s.append(Paragraph('Document control', caption))
        data = [[Paragraph(a, cellb), Paragraph(b, cell)] for a, b in control_rows]
        t = Table(data, colWidths=[0.3 * self.width, 0.7 * self.width])
        t.setStyle(TableStyle([('LINEABOVE', (0, 0), (-1, 0), 0.9, K), ('LINEBELOW', (0, -1), (-1, -1), 0.9, K), ('LINEBELOW', (0, 0), (-1, -2), 0.25, GREY), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 4), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
        s.append(t)
        s.append(NextPageTemplate('page'))

    def contents(self):
        self.story.append(PageBreak())
        self.story.append(Paragraph('Contents', h1))
        toc = TableOfContents()
        toc.levelStyles = [ParagraphStyle('t0', parent=plain, fontName='TNR-B', fontSize=11, leading=16, leftIndent=0),
                           ParagraphStyle('t1', parent=plain, fontSize=10.5, leading=14, leftIndent=16)]
        toc.dotsMinLevel = 0
        self.story.append(toc)

    def build(self):
        self.doc.multiBuild(self.story)
