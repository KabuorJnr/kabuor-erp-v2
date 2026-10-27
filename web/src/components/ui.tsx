import { useEffect, type ReactNode } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '../lib/format';

/** The page title, and under it the action bar: the page's actions in one strip, always in the same place,
 * that stays in reach while the page scrolls (the pattern Dynamics 365 calls the action bar). */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <header className="mb-3 min-w-0">
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </header>
      {actions ? (
        <div role="toolbar" aria-label={`${title} actions`} className="sticky top-[61px] z-20 -mx-4 mb-5 border-y border-line bg-paper/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-14 lg:-mx-8 lg:px-8 print:hidden">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto [&_.btn]:py-2">{actions}</div>
        </div>
      ) : (
        <div className="mb-5" />
      )}
    </>
  );
}

/** Filter chips that show how many each one returns, before it's tapped. */
export function Chips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string, number?][]; label: string }) {
  return (
    // Phones swipe through one row; wider screens wrap, so no option is ever hidden past the edge.
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0" role="group" aria-label={label}>
      <div className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
        {options.map(([id, text, n]) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            className={cn('flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition', value === id ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-2 ring-line hover:ring-faint')}
          >
            {text}
            {n !== undefined && <span className={cn('num text-xs', value === id ? 'text-white/60' : 'text-faint')}>{n}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full sm:max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
      <input className="field pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

export function Status({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'info' | 'plain'; children: ReactNode }) {
  const tones = { good: 'bg-good-soft text-good', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', info: 'bg-brand-soft text-brand', plain: 'bg-paper text-muted ring-1 ring-line' };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', tones[tone])}>{children}</span>;
}

export function Loading({ className }: { className?: string }) {
  return (
    <div className={cn('grid place-items-center py-16 text-faint', className)}>
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-bad-soft px-3 py-2 text-sm font-medium text-bad" role="alert">{children}</p>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** A panel that slides in from the right (full screen on phones). */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', on);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={title} className={cn('absolute inset-y-0 right-0 flex w-full flex-col bg-paper shadow-2xl', wide ? 'sm:max-w-3xl lg:max-w-4xl' : 'sm:max-w-md')}>
        <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-4">
          <h2 className="font-display text-lg font-bold min-w-0 truncate">{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-paper" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

/** A number with what it means: big figure, label above, context below. */
export function Stat({ label, value, children, tone }: { label: string; value: ReactNode; children?: ReactNode; tone?: 'bad' | 'good' }) {
  return (
    <div className="card p-4 sm:p-5 min-w-0">
      <p className="text-sm font-medium text-muted truncate">{label}</p>
      <p className={cn('num mt-1.5 font-display text-xl sm:text-2xl font-bold tracking-tight break-words', tone === 'bad' && 'text-bad', tone === 'good' && 'text-good')}>{value}</p>
      {children && <div className="mt-1 text-xs text-muted break-words">{children}</div>}
    </div>
  );
}
