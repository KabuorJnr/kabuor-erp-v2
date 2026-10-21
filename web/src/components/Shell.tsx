// The frame: a grouped sidebar on a computer; on a phone, the four things people do most plus "More" (every
// section and Msaidizi). Each person only sees the sections their role can use.
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import {
  BarChart3, Bot, CalendarDays, ListChecks, ShieldCheck, Factory, FileText, Home, Kanban, LogOut, Megaphone, Menu, Package, Quote, Search, Settings as Cog, ShoppingBag, Sparkles, Store, Truck, UserRound, Users, Wallet, Banknote,
} from 'lucide-react';
import { can, setSession, type Session } from '../lib/api';
import { cn } from '../lib/format';
import { setLang, useLang } from '../lib/i18n';
import AssistantPanel from './AssistantPanel';
import TellMe from './TellMe';
import { TrialBanner } from './Plan';
import { Sheet } from './ui';

type Link = { to: string; label: string; icon: typeof Home; end?: boolean };

export default function Shell({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const [assistant, setAssistant] = useState(false);
  const [more, setMore] = useState(false);
  const [tellMe, setTellMe] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMore(false), [pathname]);
  // Ctrl/Cmd+K, or "/" when not typing, opens Tell me from anywhere.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable);
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setTellMe(true);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  const initials = session.user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const isEmployee = session.user.role === 'Employee';

  const groups: { title: string; links: (Link | false)[] }[] = isEmployee
    ? [
        {
          title: 'Self Service',
          links: [{ to: '/portal', label: 'My Portal', icon: UserRound, end: true }, { to: '/security', label: 'Sign-in security', icon: ShieldCheck }],
        },
      ]
    : [
        {
          title: '',
          links: [
            { to: '/', label: t('Today'), icon: Home, end: true },
            (can(session, 'sell') || can(session, 'finance') || can(session, 'buy') || can(session, 'admin')) && { to: '/agents', label: 'Agents', icon: Bot },
          ],
        },
        {
          title: 'Sell',
          links: [
            can(session, 'pos') && { to: '/pos', label: 'Point of sale', icon: Store },
            can(session, 'sales.view') && { to: '/invoices', label: t('Invoices'), icon: FileText },
            can(session, 'sales.view') && { to: '/quotes', label: t('Quotes'), icon: Quote },
            can(session, 'sales.view') && { to: '/customers', label: t('Customers'), icon: Users },
            can(session, 'crm') && { to: '/pipeline', label: 'Pipeline', icon: Kanban },
            can(session, 'crm') && { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
          ],
        },
        {
          title: 'Money',
          links: [
            can(session, 'sales.view') && { to: '/money-in', label: t('Money in'), icon: Wallet },
            can(session, 'buy.view') && { to: '/purchases', label: t('Purchases'), icon: ShoppingBag },
            can(session, 'finance') && { to: '/reconcile', label: 'Reconcile', icon: ListChecks },
            can(session, 'reports') && { to: '/reports', label: t('Reports'), icon: BarChart3 },
          ],
        },
        {
          title: 'Operations',
          links: [
            can(session, 'stock.view') && { to: '/stock', label: t('Stock'), icon: Package },
            can(session, 'make') && { to: '/production', label: 'Production', icon: Factory },
            can(session, 'buy.view') && { to: '/suppliers', label: t('Suppliers'), icon: Truck },
          ],
        },
        {
          title: 'People',
          links: [
            can(session, 'people') && { to: '/people', label: 'Employees', icon: UserRound },
            can(session, 'people') && { to: '/leave', label: 'Leave', icon: CalendarDays },
            can(session, 'people') && { to: '/payroll', label: 'Payroll', icon: Banknote },
          ],
        },
        { title: '', links: [{ to: '/security', label: 'Sign-in security', icon: ShieldCheck }, can(session, 'admin') && { to: '/settings', label: t('Settings'), icon: Cog }] },
      ];
  const visible = groups.map((g) => ({ ...g, links: g.links.filter(Boolean) as Link[] })).filter((g) => g.links.length);
  // Phone tabs: Today, then the first three sections this role uses most, in this order of preference.
  const phoneTabs: Link[] = isEmployee
    ? [{ to: '/portal', label: 'My Portal', icon: UserRound, end: true }]
    : [
        { to: '/', label: t('Today'), icon: Home, end: true },
        ...([
          can(session, 'pos') && { to: '/pos', label: 'POS', icon: Store },
          can(session, 'sales.view') && { to: '/invoices', label: t('Invoices'), icon: FileText },
          can(session, 'sales.view') && { to: '/money-in', label: t('Money in'), icon: Wallet },
          can(session, 'stock.view') && { to: '/stock', label: t('Stock'), icon: Package },
          can(session, 'buy.view') && { to: '/purchases', label: t('Purchases'), icon: ShoppingBag },
          can(session, 'people') && { to: '/people', label: 'Employees', icon: UserRound },
          can(session, 'people') && { to: '/leave', label: 'Leave', icon: CalendarDays },
          can(session, 'make') && { to: '/production', label: 'Production', icon: Factory },
          can(session, 'sales.view') && { to: '/customers', label: t('Customers'), icon: Users },
        ].filter(Boolean) as Link[]).slice(0, 3),
      ];

  const navList = (dense?: boolean) =>
    visible.map((g, i) => (
      <div key={g.title || i} className={cn(i > 0 && (dense ? 'mt-3' : 'mt-4'))}>
        {g.title && <p className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-faint uppercase">{g.title}</p>}
        {g.links.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex items-center gap-3 rounded-md px-3 py-2 text-[15px] font-medium transition', isActive ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-paper')}>
            <n.icon className="h-[18px] w-[18px]" />
            {n.label}
          </NavLink>
        ))}
      </div>
    ));

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[15rem_1fr] print:block">
      <aside className="sticky top-0 hidden h-svh flex-col border-r border-line bg-white px-3 py-4 lg:flex print:!hidden">
        <div className="flex items-center gap-2.5 px-2">
          <img src="/mark.svg" alt="" className="h-8 w-8" />
          <div className="min-w-0 leading-tight">
            <p className="font-display text-[15px] font-bold">Kabuor ERP</p>
            <p className="truncate text-xs text-muted">{session.company.name}</p>
          </div>
        </div>
        <nav className="mt-6 min-h-0 flex-1 overflow-y-auto pb-2" aria-label="Main">
          {navList()}
        </nav>
        <div className="space-y-3 border-t border-line px-2 pt-4 text-sm">
          <div className="inline-flex rounded-full bg-paper p-0.5 ring-1 ring-line" role="radiogroup" aria-label="Language">
            {(['en', 'sw'] as const).map((l) => (
              <button key={l} role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={cn('rounded-full px-3 py-1 text-xs font-semibold', lang === l ? 'bg-white shadow-sm ring-1 ring-line' : 'text-muted')}>
                {l === 'en' ? 'English' : 'Kiswahili'}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              <b className="block truncate">{session.user.name}</b>
              <span className="text-xs text-muted">{session.user.role}</span>
            </span>
            <button onClick={() => setSession(null)} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-paper" aria-label={t('Sign out')} title={t('Sign out')}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden print:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <img src="/mark.svg" alt="" className="h-7 w-7" />
          <span className="truncate font-display font-bold">{session.company.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setTellMe(true)} className="grid h-9 w-9 place-items-center rounded-full text-muted" aria-label="Search">
            <Search className="h-5 w-5" />
          </button>
          <button onClick={() => setAssistant(true)} className="grid h-9 w-9 place-items-center rounded-full text-indigo" aria-label={t('Ask Msaidizi')}>
            <Sparkles className="h-5 w-5" />
          </button>
          <button onClick={() => setLang(lang === 'en' ? 'sw' : 'en')} className="rounded-full px-2.5 py-1 text-xs font-semibold text-muted ring-1 ring-line">
            {lang === 'en' ? 'SW' : 'EN'}
          </button>
        </div>
      </header>

      <div className="min-w-0">
        {/* Desktop app bar: Tell me in the middle, the assistant and who's signed in on the right. */}
        <header className="sticky top-0 z-30 hidden h-14 items-center gap-4 border-b border-line bg-white/95 px-8 backdrop-blur lg:flex print:hidden">
          <button onClick={() => setTellMe(true)} className="flex h-9 w-full max-w-md items-center gap-2.5 rounded-md bg-paper px-3 text-sm text-faint ring-1 ring-line hover:ring-faint">
            <Search className="h-4 w-4" /> Tell me what you want to do
            <kbd className="ml-auto rounded border border-line bg-white px-1.5 text-[11px] text-muted">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setAssistant(true)} className="flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-indigo hover:bg-paper">
              <Sparkles className="h-4 w-4 text-gold" /> Msaidizi
            </button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-xs font-bold text-white" title={`${session.user.name} · ${session.user.role}`}>
              {initials}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-6 lg:pb-12">
          {can(session, 'admin') && <TrialBanner />}
          <Outlet />
        </main>
      </div>

      {/* Phone tab bar */}
      <nav style={{ gridTemplateColumns: `repeat(${phoneTabs.length + 1}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden" aria-label="Main">
        {phoneTabs.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', isActive ? 'text-brand' : 'text-muted')}>
            <n.icon className="h-5 w-5" />
            {n.label}
          </NavLink>
        ))}
        <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-muted" aria-label="More sections">
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title={session.company.name}>
        <button onClick={() => (setMore(false), setAssistant(true))} className="mb-4 flex w-full items-center gap-3 rounded-md bg-ink px-3 py-3 text-[15px] font-semibold text-white">
          <Sparkles className="h-[18px] w-[18px] text-gold" /> {t('Ask Msaidizi')}
        </button>
        {navList(true)}
        <button onClick={() => setSession(null)} className="mt-6 flex w-full items-center gap-3 rounded-md px-3 py-2 text-[15px] font-medium text-muted">
          <LogOut className="h-[18px] w-[18px]" /> {t('Sign out')} ({session.user.name})
        </button>
      </Sheet>

      <AssistantPanel open={assistant} onClose={() => setAssistant(false)} />
      <TellMe session={session} open={tellMe} onClose={() => setTellMe(false)} />
    </div>
  );
}
