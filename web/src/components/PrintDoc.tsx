// Printed documents. Invoices, quotes, waybills, purchase orders and reports go out on paper or as a saved PDF, so
// they all carry the same two-level letterhead: Kabuor Technologies on top, the same on every document of every
// business, and under it the business's own head (its logo, name, address, contacts and KRA PIN). Same layout and
// footer too. The document's number and title name the saved PDF ("Invoice INV-0012 · Amani Store.pdf").
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { getSession, useApi } from '../lib/api';
import { cn, prettyPhone } from '../lib/format';

export type LetterheadInfo = { name: string; kraPin: string; phone: string; email: string; county: string; address: string; logo: string; vatRegistered: boolean };

/** The business's letterhead. Start loading it on any page that prints, so it's there when Print is pressed. */
export function useLetterhead(): LetterheadInfo {
  const { data } = useApi<LetterheadInfo>('/company/letterhead');
  const c = getSession()?.company;
  return data ?? { name: c?.name ?? '', kraPin: c?.kraPin ?? '', phone: '', email: '', county: '', address: '', logo: '', vatRegistered: Boolean(c?.vatRegistered) };
}

const initials = (name: string) =>
  name.split(/\s+/).filter((w) => /\w/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'K';

/** Opens the print dialog with the document's own name, which becomes the PDF's file name when it's saved. */
export function printAs(name: string) {
  const before = document.title;
  document.title = name.replace(/[\\/:*?"<>|]+/g, '-');
  const restore = () => {
    document.title = before;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

/** The top level, constant on every document: Kabuor Technologies, whose system the business runs on. */
function KabuorBand() {
  return (
    <div className="flex items-center justify-between gap-4">
      <img src="/brand/kabuor-technologies-logo-blue.svg" alt="Kabuor Technologies" className="h-9 w-auto" />
      <p className="text-right text-2xs leading-snug text-muted">
        <b className="font-semibold text-ink-2">Kabuor ERP</b>
        <span className="block">Nairobi, Kenya</span>
      </p>
    </div>
  );
}

/** The top of every document: Kabuor Technologies and the brand rule, then the business's own head with who it's
 * from on the left and what it is on the right. */
export function Letterhead({ title, number, facts = [] }: { title: string; number?: string; facts?: [string, ReactNode][] }) {
  const b = useLetterhead();
  const place = [b.address, b.county].filter(Boolean).join(', ');
  const contact = [prettyPhone(b.phone), b.email].filter(Boolean).join('  ·  ');
  return (
    <header className="break-inside-avoid">
      <KabuorBand />
      <div aria-hidden className="mt-3 mb-5 flex h-1 overflow-hidden rounded-full">
        <span className="flex-1 bg-brand" />
        <span className="w-20 bg-gold" />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div className="flex min-w-0 items-start gap-4">
          {b.logo ? (
            <img src={b.logo} alt="" className="h-16 w-auto max-w-40 shrink-0 object-contain object-left" />
          ) : (
            <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-brand font-display text-xl font-bold text-white">
              {initials(b.name)}
            </span>
          )}
          <div className="min-w-0 text-xs leading-relaxed text-ink-2">
            <p className="font-display text-xl leading-tight font-bold text-ink">{b.name}</p>
            {place && <p className="mt-1">{place}</p>}
            {contact && <p>{contact}</p>}
            {b.kraPin && (
              <p>
                KRA PIN <b className="font-semibold text-ink">{b.kraPin}</b>
                {b.vatRegistered && ' · VAT registered'}
              </p>
            )}
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className="font-display text-2xl font-bold tracking-wide text-brand uppercase">{title}</p>
          {number && <p className="num mt-0.5 text-base font-semibold text-ink">{number}</p>}
          {facts.length > 0 && (
            <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-0.5 text-xs">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-right text-muted">{k}</dt>
                  <dd className="num text-right font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      <div aria-hidden className="mt-5 border-t border-line" />
    </header>
  );
}

/** A labelled box: who it's for, how to pay, the trip. */
export function DocBox({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('break-inside-avoid rounded-md bg-paper p-4 text-sm ring-1 ring-line', className)}>
      <p className="mb-1.5 text-2xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      {children}
    </section>
  );
}

/** The bottom of every document: a line for the reader. (Kabuor Technologies is already at the top.) */
export function DocFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="mt-10 flex break-inside-avoid flex-wrap items-end justify-between gap-3 border-t border-line pt-3 text-2xs text-muted">
      <div className="max-w-md">{children}</div>
      <p>Kabuor Technologies · Kabuor ERP</p>
    </footer>
  );
}

/** A faint word across the middle of the page (DRAFT, VOID, PAID), so a draft or a voided invoice can't be mistaken
 * for one to pay. Light enough to read through, so it never hides a name or a number. */
export function Stamp({ word, tone }: { word: string; tone: 'good' | 'bad' | 'plain' }) {
  const color = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink';
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-64 z-10 flex justify-center overflow-hidden py-16">
      <span className={cn('-rotate-[18deg] font-display text-[5.5rem] leading-none font-bold tracking-[0.15em] uppercase opacity-[0.08] select-none', color)}>{word}</span>
    </span>
  );
}

/** A QR code for a link (KRA's eTIMS check page), drawn in the browser. */
export function Qr({ value, size = 96, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { margin: 0, width: size * 2, errorCorrectionLevel: 'M' }).then((u) => live && setSrc(u)).catch(() => {});
    return () => {
      live = false;
    };
  }, [value, size]);
  return src ? <img src={src} alt={label} width={size} height={size} className="shrink-0" /> : <span style={{ width: size, height: size }} className="shrink-0" />;
}

/** Prints something that isn't on the screen (all the waybills of a trip, one per page): it's drawn outside the app,
 * the app is hidden while it prints, and it goes away afterwards. Waits for the logo and fonts so they print. */
export function PrintSheet({ name, onDone, children }: { name: string; onDone: () => void; children: ReactNode }) {
  const [host] = useState(() => document.createElement('div'));
  useEffect(() => {
    host.className = 'print-sheet';
    document.body.appendChild(host);
    let live = true;
    const done = () => live && onDone();
    window.addEventListener('afterprint', done, { once: true });
    const ready = Promise.all([document.fonts?.ready, ...[...host.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))]);
    const t = setTimeout(() => ready.then(() => live && printAs(name)), 30);
    return () => {
      live = false;
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
      host.remove();
    };
    // Printing happens once, when the sheet first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return createPortal(<div className="doc">{children}</div>, host);
}
