// The platform console (Kabuor Builds only). Two questions, in order: is the system healthy right now, and is Kabuor
// growing? Health leads with one line ("All systems healthy" or what needs attention), each check says why in words,
// and traffic shows the last hour. Analytics compares the chosen period with the one before it.
import { useEffect, useState } from 'react';
import { Activity, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useApi } from '../lib/api';
import { cn, dateTime, ksh } from '../lib/format';
import { Chips, ErrorNote, Loading, PageHeader, Status } from '../components/ui';
import { ChartCard, Columns, SERIES, Table, compact } from '../components/DashboardCharts';

type Tone = 'good' | 'warn' | 'bad';
type Check = { key: string; name: string; status: Tone; summary: string };
type Health = {
  status: Tone; checkedAt: string;
  server: { environment: string; version: string; startedAt: string; uptimeHours: number; memoryMb: number; heapMb: number; threads: number; dotnet: string; os: string };
  configured: Record<string, boolean>;
  checks: Check[];
  traffic: {
    series: { at: string; requests: number; errors: number; rejected: number; avgMs: number }[];
    requests: number; errors: number; rejected: number; errorRate: number; p50: number; p95: number; p99: number;
    slowest: { route: string; requests: number; avgMs: number; maxMs: number; errors: number }[];
    failing: { route: string; errors: number; requests: number }[];
  };
};
type Analytics = {
  days: number;
  businesses: { total: number; newInPeriod: number; newBefore: number; active7d: number; activeInPeriod: number; trial: number; paying: number; grace: number; locked: number; byPlan: { id: string; name: string; businesses: number; monthly: number; mrr: number }[] };
  revenue: { mrr: number; arr: number; collectedInPeriod: number };
  users: { total: number; signedIn7d: number; signedInPeriod: number };
  volume: { invoices: number; invoiceValue: number; invoiceValueChange: number | null; payments: number; paymentValue: number; paymentValueChange: number | null; inquiries: number; agentTasks: number; assets: number };
  series: { day: string; signups: number; invoiceValue: number; paymentValue: number }[];
  top: { id: string; name: string; county: string; createdAt: string; state: string; plan: string; users: number; invoices: number; invoiceValue: number; lastInvoice: string | null; lastSignIn: string | null }[];
};

const WORD: Record<Tone, string> = { good: 'OK', warn: 'Check', bad: 'Down' };
const STATE: Record<string, ['good' | 'info' | 'warn' | 'bad', string]> = { paying: ['good', 'Paying'], trial: ['info', 'Trial'], grace: ['warn', 'Grace'], locked: ['bad', 'Locked'] };
const count = (n: number) => n.toLocaleString('en-KE');
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n));
const CONFIG_NAMES: Record<string, string> = { sentry: 'Error reports (Sentry)', ai: 'AI (Msaidizi, agents)', sms: 'SMS', billing: 'M-Pesa billing', redis: 'Shared cache', legalEmail: 'Privacy contact' };

function Tile({ label, value, note, tone }: { label: string; value: string; note?: React.ReactNode; tone?: 'bad' | 'good' }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={cn('num mt-1 text-2xl font-bold', tone === 'bad' && 'text-bad', tone === 'good' && 'text-good')}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

function Change({ pct }: { pct: number | null }) {
  if (pct == null) return <>no earlier figure</>;
  return <span className={pct >= 0 ? 'text-good' : 'text-bad'}>{pct >= 0 ? '+' : '−'}{Math.abs(pct)}% vs previous period</span>;
}

export default function Platform() {
  const me = useApi<{ allowed: boolean; why: string }>('/platform/me');
  if (me.error) return <ErrorNote>{me.error}</ErrorNote>;
  if (!me.data) return <Loading />;
  if (!me.data.allowed)
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-warn" />
        <h1 className="mt-3 text-lg font-semibold">Platform console</h1>
        <p className="mt-1 text-sm text-muted">{me.data.why}</p>
      </div>
    );
  return <Console />;
}

function Console() {
  const health = useApi<Health>('/platform/health');
  const [days, setDays] = useState<'7' | '30' | '90' | '365'>('30');
  const analytics = useApi<Analytics>(`/platform/analytics?days=${days}`);
  // Health refreshes itself every minute while the page is open.
  useEffect(() => {
    const t = window.setInterval(() => health.reload(), 60_000);
    return () => window.clearInterval(t);
  }, [health.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const h = health.data;
  const problems = h?.checks.filter((c) => c.status !== 'good') ?? [];
  return (
    <div>
      <PageHeader title="Platform" subtitle="Kabuor ERP across every business: health and growth" actions={
        <button className="btn btn-ghost" onClick={() => (health.reload(), analytics.reload())}><RefreshCw className="h-4 w-4" /> Refresh</button>
      } />
      <div className="space-y-8">
        {/* ---------------- health */}
        <section className="space-y-3" aria-label="Health">
          {health.error ? <ErrorNote>{health.error}</ErrorNote> : !h ? <Loader2 className="h-5 w-5 animate-spin text-faint" /> : (
            <>
              <div className={cn('flex flex-wrap items-center gap-3 rounded-md px-4 py-3', h.status === 'good' ? 'bg-good-soft text-good' : h.status === 'warn' ? 'bg-warn-soft text-warn' : 'bg-bad-soft text-bad')}>
                <Activity className="h-5 w-5 shrink-0" />
                <p className="flex-1 text-[15px] font-semibold">
                  {problems.length === 0 ? 'All systems healthy' : `${problems.length} need${problems.length === 1 ? 's' : ''} attention: ${problems.map((p) => p.name).join(', ')}`}
                </p>
                <span className="text-xs">Checked {dateTime(h.checkedAt)} · version {h.server.version} · {h.server.environment}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {h.checks.map((c) => (
                  <div key={c.key} className="card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{c.name}</p>
                      <Status tone={c.status}>{WORD[c.status]}</Status>
                    </div>
                    <p className="mt-1 text-sm text-muted">{c.summary}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                <ChartCard
                  title="Requests per minute (last hour)"
                  answer={<>{count(h.traffic.requests)} requests · {h.traffic.errorRate}% server errors · 95% under {h.traffic.p95} ms</>}
                  table={<Table head={['Minute', 'Requests', 'Server errors', 'Refused', 'Average ms']} rows={h.traffic.series.filter((s) => s.requests > 0).map((s) => [dateTime(s.at), s.requests, s.errors, s.rejected, s.avgMs])} />}
                >
                  <Columns
                    labels={h.traffic.series.map((s) => new Date(s.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}
                    series={[{ name: 'Requests', color: SERIES[0], values: h.traffic.series.map((s) => s.requests) }]}
                    fmt={short}
                    whole
                    tip={(i: number) => {
                      const s = h.traffic.series[i];
                      return (
                        <>
                          <b className="block text-ink">{new Date(s.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</b>
                          <span className="flex justify-between"><span className="text-muted">Requests</span><b className="num">{s.requests}</b></span>
                          <span className="flex justify-between"><span className="text-muted">Server errors</span><span className={cn('num', s.errors > 0 && 'text-bad')}>{s.errors}</span></span>
                          <span className="flex justify-between"><span className="text-muted">Average</span><span className="num">{s.avgMs} ms</span></span>
                        </>
                      );
                    }}
                  />
                </ChartCard>
                <div className="card space-y-3 p-4 text-sm">
                  <p className="font-semibold">Server</p>
                  <dl className="grid grid-cols-[7rem_1fr] gap-y-1">
                    <dt className="text-muted">Up for</dt><dd>{h.server.uptimeHours} h (since {dateTime(h.server.startedAt)})</dd>
                    <dt className="text-muted">Memory</dt><dd>{h.server.memoryMb} MB ({h.server.heapMb} MB in use by the app)</dd>
                    <dt className="text-muted">Threads</dt><dd>{h.server.threads}</dd>
                    <dt className="text-muted">Runtime</dt><dd>.NET {h.server.dotnet}</dd>
                  </dl>
                  <p className="font-semibold">Switched on</p>
                  <ul className="space-y-1">
                    {Object.entries(h.configured).map(([k, on]) => (
                      <li key={k} className="flex justify-between gap-2"><span>{CONFIG_NAMES[k] ?? k}</span><span className={on ? 'text-good' : 'text-faint'}>{on ? 'On' : 'Off'}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
              {(h.traffic.slowest.length > 0 || h.traffic.failing.length > 0) && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="card p-4">
                    <p className="mb-2 font-semibold">Slowest routes since start</p>
                    <Table head={['Route', 'Requests', 'Average ms', 'Slowest ms']} rows={h.traffic.slowest.map((r) => [<code className="text-xs">{r.route}</code>, r.requests, r.avgMs, r.maxMs])} />
                  </div>
                  <div className="card p-4">
                    <p className="mb-2 font-semibold">Routes with server errors</p>
                    {h.traffic.failing.length === 0 ? <p className="text-sm text-good">None since the server started.</p> : (
                      <Table head={['Route', 'Errors', 'Requests']} rows={h.traffic.failing.map((r) => [<code className="text-xs">{r.route}</code>, <span className="text-bad">{r.errors}</span>, r.requests])} />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* ---------------- analytics */}
        <section className="space-y-4" aria-label="Analytics">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="flex-1 font-semibold">Growth</h2>
            <Chips label="Period" value={days} onChange={setDays} options={[['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['365', 'Year']]} />
          </div>
          {analytics.error ? <ErrorNote>{analytics.error}</ErrorNote> : !analytics.data ? <Loader2 className="h-5 w-5 animate-spin text-faint" /> : (() => {
            const a = analytics.data;
            const b = a.businesses;
            return (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Tile label="Businesses" value={count(b.total)} note={<>{b.newInPeriod} new in {a.days} days{b.newBefore > 0 && <> (previous period {b.newBefore})</>}</>} />
                  <Tile label="Active this week" value={count(b.active7d)} note={<>of {count(b.total)} · invoiced, paid or signed in</>} />
                  <Tile label="Monthly recurring revenue" value={ksh(a.revenue.mrr)} note={<>{b.paying} paying · {ksh(a.revenue.arr)} a year</>} tone={a.revenue.mrr > 0 ? 'good' : undefined} />
                  <Tile label="Subscriptions collected" value={ksh(a.revenue.collectedInPeriod)} note={`in ${a.days} days, by M-Pesa`} />
                  <Tile label="On trial" value={count(b.trial)} note={<>{b.grace} in grace · <span className={b.locked > 0 ? 'text-bad' : ''}>{b.locked} locked</span></>} />
                  <Tile label="People signing in" value={count(a.users.signedIn7d)} note={<>this week, of {count(a.users.total)} users</>} />
                  <Tile label="Invoiced through Kabuor" value={ksh(a.volume.invoiceValue)} note={<>{count(a.volume.invoices)} invoices · <Change pct={a.volume.invoiceValueChange} /></>} />
                  <Tile label="Payments recorded" value={ksh(a.volume.paymentValue)} note={<>{count(a.volume.payments)} payments · <Change pct={a.volume.paymentValueChange} /></>} />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ChartCard
                    title="New businesses per day"
                    answer={<>{b.newInPeriod} sign-up{b.newInPeriod === 1 ? '' : 's'} in {a.days} days</>}
                    table={<Table head={['Day', 'Sign-ups']} rows={a.series.filter((s) => s.signups > 0).map((s) => [s.day, s.signups])} />}
                  >
                    <Columns labels={a.series.map((s) => s.day.slice(5))} series={[{ name: 'Sign-ups', color: SERIES[0], values: a.series.map((s) => s.signups) }]} fmt={short} whole
                      tip={(i: number) => <><b className="block text-ink">{a.series[i].day}</b><span className="flex justify-between"><span className="text-muted">Sign-ups</span><b className="num">{a.series[i].signups}</b></span></>} />
                  </ChartCard>
                  <ChartCard
                    title="Invoiced per day, all businesses"
                    answer={<>{ksh(a.volume.invoiceValue)} in {a.days} days</>}
                    table={<Table head={['Day', 'Invoiced', 'Payments']} rows={a.series.filter((s) => s.invoiceValue || s.paymentValue).map((s) => [s.day, ksh(s.invoiceValue), ksh(s.paymentValue)])} />}
                  >
                    <Columns labels={a.series.map((s) => s.day.slice(5))} series={[{ name: 'Invoiced', color: SERIES[0], values: a.series.map((s) => s.invoiceValue) }]} fmt={compact}
                      tip={(i: number) => <><b className="block text-ink">{a.series[i].day}</b><span className="flex justify-between"><span className="text-muted">Invoiced</span><b className="num">{ksh(a.series[i].invoiceValue)}</b></span><span className="flex justify-between"><span className="text-muted">Payments</span><span className="num">{ksh(a.series[i].paymentValue)}</span></span></>} />
                  </ChartCard>
                </div>
                <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
                  <div className="card p-4">
                    <p className="mb-2 font-semibold">Paying businesses by plan</p>
                    <Table head={['Plan', 'Businesses', 'MRR']} rows={b.byPlan.map((p) => [p.name, p.businesses, ksh(p.mrr)])} />
                    <p className="mt-3 text-xs text-muted">Also this period: {count(a.volume.inquiries)} customer inquiries, {count(a.volume.agentTasks)} agent suggestions; {count(a.volume.assets)} assets registered.</p>
                  </div>
                  <div className="card p-4">
                    <p className="mb-2 font-semibold">Most active businesses ({a.days} days)</p>
                    <Table head={['Business', 'Status', 'Users', 'Invoices', 'Invoiced', 'Last sign-in']} rows={a.top.slice(0, 15).map((c) => [
                      <span><b>{c.name}</b>{c.county && <span className="block text-xs text-muted">{c.county}</span>}</span>,
                      <Status tone={STATE[c.state]?.[0] ?? 'plain'}>{STATE[c.state]?.[1] ?? c.state}{c.plan ? ` · ${c.plan}` : ''}</Status>,
                      c.users, c.invoices, ksh(c.invoiceValue), c.lastSignIn ? dateTime(c.lastSignIn) : 'never',
                    ])} />
                    <p className="mt-2 text-xs text-muted">Counts and totals only: the console never shows a business’s customers.</p>
                  </div>
                </div>
              </>
            );
          })()}
        </section>
      </div>
    </div>
  );
}
