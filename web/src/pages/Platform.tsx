// The platform console for Kabuor Builds: oversight across every business, server health & auto-scaling
// telemetry, database capacity, data governance & KDPA/GDPR compliance data wipes, and platform growth.
import { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { api, useApi } from '../lib/api';
import { cn, dateTime, ksh } from '../lib/format';
import { Chips, ErrorNote, Loading, PageHeader, Status, Sheet } from '../components/ui';
import { ChartCard, Columns, SERIES, Table, compact } from '../components/DashboardCharts';

type Tone = 'good' | 'warn' | 'bad';
type Check = { key: string; name: string; status: Tone; summary: string };

type Health = {
  status: Tone;
  checkedAt: string;
  server: {
    environment: string;
    version: string;
    startedAt: string;
    uptimeHours: number;
    memoryMb: number;
    heapMb: number;
    threads: number;
    dotnet: string;
    os: string;
  };
  configured: Record<string, boolean>;
  checks: Check[];
  traffic: {
    series: { at: string; requests: number; errors: number; rejected: number; avgMs: number }[];
    requests: number;
    errors: number;
    rejected: number;
    errorRate: number;
    p50: number;
    p95: number;
    p99: number;
    slowest: { route: string; requests: number; avgMs: number; maxMs: number; errors: number }[];
    failing: { route: string; errors: number; requests: number }[];
  };
};

type Resources = {
  scaling: {
    status: 'optimal' | 'scale_up_recommended' | 'attention_needed';
    summary: string;
    recommendations: string[];
  };
  memory: {
    workingSetMb: number;
    heapMb: number;
    gen0: number;
    gen1: number;
    gen2: number;
  };
  cpu: {
    threads: number;
    busyWorkerThreads: number;
    maxWorkerThreads: number;
  };
  database: {
    sizeMb: number | null;
    connections: number | null;
  };
  uptime: {
    startedAt: string;
    uptimeHours: number;
  };
};

type BusinessItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  county: string | null;
  plan: string;
  createdAt: string;
  trialEndsAt: string | null;
  paidUntil: string | null;
  state: 'paying' | 'trial' | 'grace' | 'locked';
  usersCount: number;
  invoicesCount: number;
  invoiceValue: number;
  lastActive: string | null;
};

type Analytics = {
  days: number;
  businesses: {
    total: number;
    newInPeriod: number;
    newBefore: number;
    active7d: number;
    activeInPeriod: number;
    trial: number;
    paying: number;
    grace: number;
    locked: number;
    byPlan: { id: string; name: string; businesses: number; monthly: number; mrr: number }[];
  };
  revenue: { mrr: number; arr: number; collectedInPeriod: number };
  users: { total: number; signedIn7d: number; signedInPeriod: number };
  volume: {
    invoices: number;
    invoiceValue: number;
    invoiceValueChange: number | null;
    payments: number;
    paymentValue: number;
    paymentValueChange: number | null;
    inquiries: number;
    agentTasks: number;
    assets: number;
  };
  series: { day: string; signups: number; invoiceValue: number; paymentValue: number }[];
  top: {
    id: string;
    name: string;
    county: string;
    createdAt: string;
    state: string;
    plan: string;
    users: number;
    invoices: number;
    invoiceValue: number;
    lastInvoice: string | null;
    lastSignIn: string | null;
  }[];
};

const WORD: Record<Tone, string> = { good: 'OK', warn: 'Check', bad: 'Down' };
const STATE: Record<string, ['good' | 'info' | 'warn' | 'bad', string]> = {
  paying: ['good', 'Paying'],
  trial: ['info', 'Trial'],
  grace: ['warn', 'Grace'],
  locked: ['bad', 'Locked'],
};

const count = (n: number) => n.toLocaleString('en-KE');
const short = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n);
const CONFIG_NAMES: Record<string, string> = {
  sentry: 'Error reports (Sentry)',
  ai: 'AI (Msaidizi, agents)',
  sms: 'SMS',
  billing: 'M-Pesa billing',
  redis: 'Shared cache',
  legalEmail: 'Privacy contact',
};

function Tile({ label, value, note, tone, icon }: { label: string; value: string; note?: React.ReactNode; tone?: 'bad' | 'good' | 'warn' | 'brand'; icon?: React.ReactNode }) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted">{label}</p>
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <p
        className={cn(
          'num mt-1 text-2xl font-bold tracking-tight',
          tone === 'bad' && 'text-bad',
          tone === 'good' && 'text-good',
          tone === 'warn' && 'text-warn',
          tone === 'brand' && 'text-brand'
        )}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}

function Change({ pct }: { pct: number | null }) {
  if (pct == null) return <>no earlier figure</>;
  return (
    <span className={pct >= 0 ? 'text-good' : 'text-bad'}>
      {pct >= 0 ? '+' : '−'}
      {Math.abs(pct)}% vs previous period
    </span>
  );
}

export default function Platform() {
  const me = useApi<{ allowed: boolean; why: string }>('/platform/me');
  if (me.error) return <ErrorNote>{me.error}</ErrorNote>;
  if (!me.data) return <Loading />;
  if (!me.data.allowed) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-warn" />
        <h1 className="mt-4 text-xl font-bold">Platform Admin Console</h1>
        <p className="mt-2 text-sm text-muted">{me.data.why}</p>
        <div className="mt-6 rounded-lg border border-line bg-card p-4 text-left text-xs text-muted">
          <p className="font-semibold text-ink">Administrative Policy</p>
          <p className="mt-1">
            Access to cross-tenant administration, system resource telemetry, and permanent compliance data wipes is
            restricted to verified platform administrative keys configured in <code>Platform:Admins</code>.
          </p>
        </div>
      </div>
    );
  }
  return <Console />;
}

type Tab = 'resources' | 'businesses' | 'traffic' | 'growth';

function Console() {
  const [tab, setTab] = useState<Tab>('resources');
  const [actionMsg, setActionMsg] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const [acting, setActing] = useState(false);

  // APIs
  const health = useApi<Health>('/platform/health');
  const resources = useApi<Resources>('/platform/resources');
  const businesses = useApi<BusinessItem[]>('/platform/businesses');
  const [days, setDays] = useState<'7' | '30' | '90' | '365'>('30');
  const analytics = useApi<Analytics>(`/platform/analytics?days=${days}`);

  // Modals
  const [planModalBiz, setPlanModalBiz] = useState<BusinessItem | null>(null);
  const [wipeModalBiz, setWipeModalBiz] = useState<BusinessItem | null>(null);

  // Auto-refresh telemetry every 30s
  useEffect(() => {
    const t = window.setInterval(() => {
      health.reload();
      resources.reload();
    }, 30_000);
    return () => window.clearInterval(t);
  }, [health.reload, resources.reload]);

  const runAction = async (action: string) => {
    setActing(true);
    setActionMsg(null);
    try {
      const res = await api<{ message: string }>(`/platform/actions/${action}`, { method: 'POST' });
      setActionMsg({ text: res.message || 'Action executed successfully.', tone: 'good' });
      resources.reload();
      health.reload();
    } catch (err: any) {
      setActionMsg({ text: err.message || 'Action failed.', tone: 'bad' });
    } finally {
      setActing(false);
    }
  };

  const reloadAll = () => {
    health.reload();
    resources.reload();
    businesses.reload();
    analytics.reload();
  };

  const h = health.data;
  const r = resources.data;
  const problems = h?.checks.filter((c) => c.status !== 'good') ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Console"
        subtitle="Oversee server health, container auto-scaling, tenant governance, and compliance wipes"
        actions={
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost text-xs"
              onClick={reloadAll}
              title="Refresh all metrics"
            >
              <RefreshCw className="h-4 w-4" /> Refresh Telemetry
            </button>
            <button
              className="btn btn-secondary text-xs"
              disabled={acting}
              onClick={() => runAction('gc-collect')}
              title="Force full Garbage Collection & compact Large Object Heap"
            >
              <Zap className="h-4 w-4 text-brand" /> {acting ? 'Running...' : 'Run GC'}
            </button>
          </div>
        }
      />

      {actionMsg && (
        <div
          className={cn(
            'flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium transition',
            actionMsg.tone === 'good' ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'
          )}
        >
          <span>{actionMsg.text}</span>
          <button className="text-xs opacity-70 hover:opacity-100" onClick={() => setActionMsg(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Primary Tab Navigation */}
      <div className="border-b border-line">
        <nav className="flex space-x-2 overflow-x-auto pb-px" aria-label="Tabs">
          <button
            onClick={() => setTab('resources')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition',
              tab === 'resources'
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:border-line hover:text-ink'
            )}
          >
            <Server className="h-4 w-4" /> Resources & Scaling
          </button>
          <button
            onClick={() => setTab('businesses')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition',
              tab === 'businesses'
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:border-line hover:text-ink'
            )}
          >
            <Building2 className="h-4 w-4" /> Tenants & Compliance Wipe
            {businesses.data && (
              <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-bold text-muted ring-1 ring-line">
                {businesses.data.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('traffic')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition',
              tab === 'traffic'
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:border-line hover:text-ink'
            )}
          >
            <Activity className="h-4 w-4" /> Traffic & Health Checks
            {problems.length > 0 && (
              <span className="rounded-full bg-bad-soft px-2 py-0.5 text-xs font-bold text-bad">
                {problems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('growth')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition',
              tab === 'growth'
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:border-line hover:text-ink'
            )}
          >
            <BarChart3 className="h-4 w-4" /> Growth & Revenue
          </button>
        </nav>
      </div>

      {/* TAB 1: RESOURCES & SCALING */}
      {tab === 'resources' && (
        <div className="space-y-6">
          {resources.error ? (
            <ErrorNote>{resources.error}</ErrorNote>
          ) : !r ? (
            <Loading />
          ) : (
            <>
              {/* Scaling Recommendation Banner */}
              <div
                className={cn(
                  'rounded-xl border p-5 shadow-sm transition',
                  r.scaling.status === 'optimal'
                    ? 'border-good/30 bg-good-soft/30 text-ink'
                    : 'border-warn/40 bg-warn-soft/30 text-ink'
                )}
              >
                <div className="flex items-start gap-3.5">
                  {r.scaling.status === 'optimal' ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-good mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 shrink-0 text-warn mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-base font-bold tracking-tight">
                        Server Capacity: {r.scaling.summary}
                      </h2>
                      <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted ring-1 ring-line">
                        Status: {r.scaling.status}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {r.scaling.recommendations.map((rec, i) => (
                        <p key={i} className="text-sm text-ink-2">
                          • {rec}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Gauges & Stat Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Tile
                  label="Working Set Memory"
                  value={`${r.memory.workingSetMb} MB`}
                  note={`Heap: ${r.memory.heapMb} MB | GC Gen0: ${r.memory.gen0}`}
                  icon={<HardDrive className="h-4 w-4" />}
                  tone={r.memory.workingSetMb > 1200 ? 'bad' : r.memory.workingSetMb > 800 ? 'warn' : 'good'}
                />
                <Tile
                  label="Worker Threads"
                  value={`${r.cpu.busyWorkerThreads} busy`}
                  note={`Max: ${count(r.cpu.maxWorkerThreads)} | Total: ${r.cpu.threads}`}
                  icon={<Cpu className="h-4 w-4" />}
                  tone={r.cpu.busyWorkerThreads > 50 ? 'warn' : 'good'}
                />
                <Tile
                  label="PostgreSQL Database"
                  value={r.database.sizeMb ? `${r.database.sizeMb} MB` : 'Active'}
                  note={`Connections: ${r.database.connections ?? 'N/A'}`}
                  icon={<Database className="h-4 w-4" />}
                  tone="brand"
                />
                <Tile
                  label="System Uptime"
                  value={`${r.uptime.uptimeHours} hrs`}
                  note={`Started: ${dateTime(r.uptime.startedAt)}`}
                  icon={<Clock className="h-4 w-4" />}
                  tone="good"
                />
              </div>

              {/* Memory Saturation & Server Architecture Card */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-ink flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-brand" /> Memory Saturation & Container Limits
                    </h3>
                    <span className="text-xs text-muted">Vercel Container Runtime</span>
                  </div>

                  {/* Visual RAM Meter */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-muted mb-1.5">
                      <span>Working Set Usage</span>
                      <span>{r.memory.workingSetMb} MB / 1024 MB (Estimated Tier)</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-paper ring-1 ring-line">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          r.memory.workingSetMb > 900
                            ? 'bg-bad'
                            : r.memory.workingSetMb > 600
                            ? 'bg-warn'
                            : 'bg-brand'
                        )}
                        style={{ width: `${Math.min(100, Math.round((r.memory.workingSetMb / 1024) * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
                    <div className="rounded-lg border border-line bg-card p-3">
                      <p className="text-muted font-medium">GC Gen 0</p>
                      <p className="num text-lg font-bold text-ink mt-0.5">{r.memory.gen0}</p>
                    </div>
                    <div className="rounded-lg border border-line bg-card p-3">
                      <p className="text-muted font-medium">GC Gen 1</p>
                      <p className="num text-lg font-bold text-ink mt-0.5">{r.memory.gen1}</p>
                    </div>
                    <div className="rounded-lg border border-line bg-card p-3">
                      <p className="text-muted font-medium">GC Gen 2 (LOH)</p>
                      <p className="num text-lg font-bold text-ink mt-0.5">{r.memory.gen2}</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-relaxed">
                    Tip: Kabuor ERP runs on .NET 8 AOT/Server GC mode. If working set approaches 1GB, scale Vercel
                    Function/Container memory settings or run garbage collection to reclaim inactive tenant buffers.
                  </p>
                </div>

                {/* Server Scaling Actions & Cloud Guidance */}
                <div className="card p-5 space-y-4">
                  <h3 className="font-semibold text-ink flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand" /> Auto-Scaling Guidance & Quick Actions
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="rounded-lg border border-line bg-card p-3.5 space-y-2">
                      <p className="font-semibold text-xs uppercase tracking-wider text-muted">
                        When to Scale Up Server Specs
                      </p>
                      <ul className="text-xs text-ink-2 space-y-1 list-disc list-inside">
                        <li>Container RAM &gt; 1200 MB: Upgrade Vercel container to 2GB or 4GB RAM.</li>
                        <li>95th percentile latency &gt; 800 ms: Add CPU cores or horizontally replica pods.</li>
                        <li>Active DB connections &gt; 80: Increase PostgreSQL pool size or enable PgBouncer.</li>
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        className="btn btn-secondary text-xs"
                        disabled={acting}
                        onClick={() => runAction('gc-collect')}
                      >
                        <Zap className="h-3.5 w-3.5 text-brand" /> Reclaim Memory (GC & LOH Compact)
                      </button>
                      <button
                        className="btn btn-secondary text-xs"
                        disabled={acting}
                        onClick={() => runAction('clear-cache')}
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-muted" /> Flush Platform Cache
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: TENANT BUSINESSES & DATA WIPING */}
      {tab === 'businesses' && (
        <BusinessesView
          businesses={businesses.data ?? []}
          loading={businesses.loading}
          error={businesses.error}
          onReload={() => businesses.reload()}
          onEditPlan={(b) => setPlanModalBiz(b)}
          onWipeData={(b) => setWipeModalBiz(b)}
        />
      )}

      {/* TAB 3: TRAFFIC & COMPONENT HEALTH */}
      {tab === 'traffic' && (
        <TrafficView health={h} error={health.error} />
      )}

      {/* TAB 4: GROWTH & REVENUE */}
      {tab === 'growth' && (
        <GrowthView analytics={analytics.data} error={analytics.error} days={days} setDays={setDays} />
      )}

      {/* Modal: Update Plan & Access */}
      {planModalBiz && (
        <PlanModal
          business={planModalBiz}
          onClose={() => setPlanModalBiz(null)}
          onUpdated={() => {
            setPlanModalBiz(null);
            businesses.reload();
          }}
        />
      )}

      {/* Modal: Compliance Data Erasure / Permanent Wipe */}
      {wipeModalBiz && (
        <WipeDataModal
          business={wipeModalBiz}
          onClose={() => setWipeModalBiz(null)}
          onWiped={() => {
            setWipeModalBiz(null);
            businesses.reload();
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: Businesses & Governance View
// -----------------------------------------------------------------------------
function BusinessesView({
  businesses,
  loading,
  error,
  onReload,
  onEditPlan,
  onWipeData,
}: {
  businesses: BusinessItem[];
  loading: boolean;
  error?: string | null;
  onReload: () => void;
  onEditPlan: (b: BusinessItem) => void;
  onWipeData: (b: BusinessItem) => void;
}) {
  const [filterState, setFilterState] = useState<string>('all');
  const [search, setSearch] = useState('');

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (loading && businesses.length === 0) return <Loading />;

  const filtered = businesses.filter((b) => {
    if (filterState !== 'all' && b.state !== filterState) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        (b.email ?? '').toLowerCase().includes(q) ||
        (b.county ?? '').toLowerCase().includes(q) ||
        b.plan.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Search & Status Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              className="field pl-9"
              placeholder="Search business name, email, county..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost text-xs p-2"
            onClick={onReload}
            title="Refresh businesses directory"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        <Chips
          label="Status Filter"
          value={filterState}
          onChange={setFilterState}
          options={[
            ['all', 'All Businesses', businesses.length],
            ['paying', 'Paying', businesses.filter((b) => b.state === 'paying').length],
            ['trial', 'Trial', businesses.filter((b) => b.state === 'trial').length],
            ['grace', 'Grace', businesses.filter((b) => b.state === 'grace').length],
            ['locked', 'Locked', businesses.filter((b) => b.state === 'locked').length],
          ]}
        />
      </div>

      {/* Directory Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper/60 text-xs font-semibold text-muted uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">State & Plan</th>
                <th className="py-3 px-4 text-center">Users</th>
                <th className="py-3 px-4 text-right">Invoiced Volume</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4 text-right">Governance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No businesses match your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-paper/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-ink">{b.name}</div>
                      <div className="text-xs text-muted">
                        {b.email || b.phone || 'No direct contact'} {b.county ? `· ${b.county}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <Status tone={STATE[b.state]?.[0] ?? 'plain'}>{STATE[b.state]?.[1] ?? b.state}</Status>
                        <span className="text-xs font-medium uppercase text-muted tracking-wider">
                          {b.plan || 'Free'}
                        </span>
                      </div>
                      {b.paidUntil && (
                        <div className="text-xs text-muted mt-0.5">Paid until {dateTime(b.paidUntil)}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium num">{b.usersCount}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-semibold num">{ksh(b.invoiceValue)}</div>
                      <div className="text-xs text-muted num">{b.invoicesCount} invoices</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted">
                      {b.lastActive ? dateTime(b.lastActive) : 'Never'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="btn btn-secondary text-xs py-1 px-2.5"
                          onClick={() => onEditPlan(b)}
                          title="Change subscription plan or extend trial"
                        >
                          Plan & Access
                        </button>
                        {b.name !== 'Kabuor Builds' && (
                          <button
                            className="btn btn-ghost text-xs text-bad hover:bg-bad-soft py-1 px-2"
                            onClick={() => onWipeData(b)}
                            title="Compliance wipe of all records under Kenya Data Protection Act 2019 / GDPR"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Wipe
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: Traffic & Component Health View
// -----------------------------------------------------------------------------
function TrafficView({ health, error }: { health?: Health | null; error?: string | null }) {
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!health) return <Loading />;
  const problems = health.checks.filter((c) => c.status !== 'good');

  return (
    <div className="space-y-6">
      <div
        className={cn(
          'flex flex-wrap items-center gap-3 rounded-xl px-4 py-3.5 transition',
          health.status === 'good'
            ? 'bg-good-soft text-good'
            : health.status === 'warn'
            ? 'bg-warn-soft text-warn'
            : 'bg-bad-soft text-bad'
        )}
      >
        <Activity className="h-5 w-5 shrink-0" />
        <p className="flex-1 text-[15px] font-bold">
          {problems.length === 0
            ? 'All subsystem components operational'
            : `${problems.length} component${problems.length === 1 ? '' : 's'} require attention: ${problems
                .map((p) => p.name)
                .join(', ')}`}
        </p>
        <span className="text-xs">
          Checked {dateTime(health.checkedAt)} · v{health.server.version} · {health.server.environment}
        </span>
      </div>

      {/* Component Grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {health.checks.map((c) => (
          <div key={c.key} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-ink">{c.name}</p>
              <Status tone={c.status}>{WORD[c.status]}</Status>
            </div>
            <p className="mt-1 text-sm text-muted">{c.summary}</p>
          </div>
        ))}
      </div>

      {/* Traffic Graph & Specs */}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <ChartCard
          title="Requests per minute (last hour)"
          answer={
            <>
              {count(health.traffic.requests)} requests · {health.traffic.errorRate}% server errors · 95% under{' '}
              {health.traffic.p95} ms
            </>
          }
          table={
            <Table
              head={['Minute', 'Requests', 'Server errors', 'Refused', 'Average ms']}
              rows={health.traffic.series
                .filter((s) => s.requests > 0)
                .map((s) => [dateTime(s.at), s.requests, s.errors, s.rejected, s.avgMs])}
            />
          }
        >
          <Columns
            labels={health.traffic.series.map((s) =>
              new Date(s.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            )}
            series={[{ name: 'Requests', color: SERIES[0], values: health.traffic.series.map((s) => s.requests) }]}
            fmt={short}
            whole
            tip={(i: number) => {
              const s = health.traffic.series[i];
              return (
                <>
                  <b className="block text-ink">
                    {new Date(s.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </b>
                  <span className="flex justify-between">
                    <span className="text-muted">Requests</span>
                    <b className="num">{s.requests}</b>
                  </span>
                  <span className="flex justify-between">
                    <span className="text-muted">Errors</span>
                    <span className={cn('num', s.errors > 0 && 'text-bad')}>{s.errors}</span>
                  </span>
                  <span className="flex justify-between">
                    <span className="text-muted">Average</span>
                    <span className="num">{s.avgMs} ms</span>
                  </span>
                </>
              );
            }}
          />
        </ChartCard>

        <div className="card space-y-4 p-4 text-sm">
          <p className="font-semibold text-ink">Host Platform Configuration</p>
          <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1 text-xs">
            <dt className="text-muted">Host OS</dt>
            <dd className="font-medium text-ink truncate">{health.server.os}</dd>
            <dt className="text-muted">Framework</dt>
            <dd className="font-medium text-ink">.NET {health.server.dotnet}</dd>
            <dt className="text-muted">Uptime</dt>
            <dd className="font-medium text-ink">{health.server.uptimeHours} hours</dd>
            <dt className="text-muted">Total RAM</dt>
            <dd className="font-medium text-ink">{health.server.memoryMb} MB</dd>
            <dt className="text-muted">Heap in Use</dt>
            <dd className="font-medium text-ink">{health.server.heapMb} MB</dd>
            <dt className="text-muted">Threads</dt>
            <dd className="font-medium text-ink">{health.server.threads}</dd>
          </dl>

          <p className="font-semibold text-xs uppercase tracking-wider text-muted pt-2 border-t border-line">
            Integrated Features
          </p>
          <ul className="space-y-1.5 text-xs">
            {Object.entries(health.configured).map(([k, on]) => (
              <li key={k} className="flex justify-between items-center">
                <span>{CONFIG_NAMES[k] ?? k}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    on ? 'bg-good-soft text-good' : 'bg-paper text-faint ring-1 ring-line'
                  )}
                >
                  {on ? 'Enabled' : 'Disabled'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {(health.traffic.slowest.length > 0 || health.traffic.failing.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <p className="mb-2 font-semibold text-ink">Slowest Endpoints</p>
            <Table
              head={['Route', 'Requests', 'Average ms', 'Max ms']}
              rows={health.traffic.slowest.map((r) => [
                <code className="text-xs">{r.route}</code>,
                r.requests,
                r.avgMs,
                r.maxMs,
              ])}
            />
          </div>
          <div className="card p-4">
            <p className="mb-2 font-semibold text-ink">Endpoints with Server Errors</p>
            {health.traffic.failing.length === 0 ? (
              <p className="text-sm text-good">No server errors logged since server start.</p>
            ) : (
              <Table
                head={['Route', 'Errors', 'Requests']}
                rows={health.traffic.failing.map((r) => [
                  <code className="text-xs">{r.route}</code>,
                  <span className="text-bad font-semibold">{r.errors}</span>,
                  r.requests,
                ])}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: Growth & Analytics View
// -----------------------------------------------------------------------------
function GrowthView({
  analytics,
  error,
  days,
  setDays,
}: {
  analytics?: Analytics | null;
  error?: string | null;
  days: '7' | '30' | '90' | '365';
  setDays: (d: '7' | '30' | '90' | '365') => void;
}) {
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!analytics) return <Loading />;
  const b = analytics.businesses;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-ink">Platform Revenue & Business Metrics</h2>
        <Chips
          label="Period"
          value={days}
          onChange={setDays}
          options={[
            ['7', '7 days'],
            ['30', '30 days'],
            ['90', '90 days'],
            ['365', 'Year'],
          ]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Total Businesses"
          value={count(b.total)}
          note={
            <>
              {b.newInPeriod} new in {analytics.days} days
              {b.newBefore > 0 && <> (previous: {b.newBefore})</>}
            </>
          }
        />
        <Tile
          label="Active This Week"
          value={count(b.active7d)}
          note={<>of {count(b.total)} businesses active</>}
        />
        <Tile
          label="Monthly Recurring Revenue"
          value={ksh(analytics.revenue.mrr)}
          note={<>{b.paying} paying · {ksh(analytics.revenue.arr)} annual run rate</>}
          tone={analytics.revenue.mrr > 0 ? 'good' : undefined}
        />
        <Tile
          label="M-Pesa Subscriptions"
          value={ksh(analytics.revenue.collectedInPeriod)}
          note={`Collected in last ${analytics.days} days`}
          tone="brand"
        />
        <Tile
          label="Trial Accounts"
          value={count(b.trial)}
          note={
            <>
              {b.grace} in grace · <span className={b.locked > 0 ? 'text-bad' : ''}>{b.locked} locked</span>
            </>
          }
        />
        <Tile
          label="Active Platform Users"
          value={count(analytics.users.signedIn7d)}
          note={<>signed in this week of {count(analytics.users.total)} registered</>}
        />
        <Tile
          label="Tenant Invoice Volume"
          value={ksh(analytics.volume.invoiceValue)}
          note={
            <>
              {count(analytics.volume.invoices)} invoices · <Change pct={analytics.volume.invoiceValueChange} />
            </>
          }
        />
        <Tile
          label="Tenant Payments Processed"
          value={ksh(analytics.volume.paymentValue)}
          note={
            <>
              {count(analytics.volume.payments)} payments · <Change pct={analytics.volume.paymentValueChange} />
            </>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="New business registrations"
          answer={
            <>
              {b.newInPeriod} sign-up{b.newInPeriod === 1 ? '' : 's'} in {analytics.days} days
            </>
          }
          table={
            <Table
              head={['Day', 'Sign-ups']}
              rows={analytics.series.filter((s) => s.signups > 0).map((s) => [s.day, s.signups])}
            />
          }
        >
          <Columns
            labels={analytics.series.map((s) => s.day.slice(5))}
            series={[{ name: 'Sign-ups', color: SERIES[0], values: analytics.series.map((s) => s.signups) }]}
            fmt={short}
            whole
            tip={(i: number) => (
              <>
                <b className="block text-ink">{analytics.series[i].day}</b>
                <span className="flex justify-between">
                  <span className="text-muted">Sign-ups</span>
                  <b className="num">{analytics.series[i].signups}</b>
                </span>
              </>
            )}
          />
        </ChartCard>

        <ChartCard
          title="Invoiced per day across all businesses"
          answer={<>{ksh(analytics.volume.invoiceValue)} in period</>}
          table={
            <Table
              head={['Day', 'Invoiced', 'Payments']}
              rows={analytics.series
                .filter((s) => s.invoiceValue || s.paymentValue)
                .map((s) => [s.day, ksh(s.invoiceValue), ksh(s.paymentValue)])}
            />
          }
        >
          <Columns
            labels={analytics.series.map((s) => s.day.slice(5))}
            series={[{ name: 'Invoiced', color: SERIES[0], values: analytics.series.map((s) => s.invoiceValue) }]}
            fmt={compact}
            tip={(i: number) => (
              <>
                <b className="block text-ink">{analytics.series[i].day}</b>
                <span className="flex justify-between">
                  <span className="text-muted">Invoiced</span>
                  <b className="num">{ksh(analytics.series[i].invoiceValue)}</b>
                </span>
                <span className="flex justify-between">
                  <span className="text-muted">Payments</span>
                  <span className="num">{ksh(analytics.series[i].paymentValue)}</span>
                </span>
              </>
            )}
          />
        </ChartCard>
      </div>

      <div className="card p-4">
        <p className="mb-2 font-semibold text-ink">Paying businesses by tier</p>
        <Table
          head={['Plan Tier', 'Paying Businesses', 'Monthly Recurring Revenue']}
          rows={b.byPlan.map((p) => [p.name, p.businesses, ksh(p.mrr)])}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Modal: Plan & Access Controller
// -----------------------------------------------------------------------------
function PlanModal({
  business,
  onClose,
  onUpdated,
}: {
  business: BusinessItem;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [plan, setPlan] = useState(business.plan || 'starter');
  const [extendDays, setExtendDays] = useState(0);
  const [lockAccount, setLockAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await api(`/platform/businesses/${business.id}/plan`, {
        method: 'POST',
        body: {
          plan,
          extendDays: extendDays > 0 ? extendDays : undefined,
          lock: lockAccount ? true : undefined,
        },
      });
      onUpdated();
    } catch (error: any) {
      setErr(error.message || 'Failed to update plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={`Manage: ${business.name}`}>
      <form onSubmit={handleSave} className="space-y-5">
        {err && <ErrorNote>{err}</ErrorNote>}

        <div className="rounded-lg border border-line bg-card p-3 text-xs space-y-1 text-muted">
          <p>
            <strong className="text-ink">Current Plan:</strong> {business.plan.toUpperCase()}
          </p>
          <p>
            <strong className="text-ink">Current Status:</strong> {business.state.toUpperCase()}
          </p>
          {business.paidUntil && (
            <p>
              <strong className="text-ink">Paid Until:</strong> {dateTime(business.paidUntil)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Subscription Tier</label>
          <select className="field" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="starter">Starter (KSh 3,500/mo)</option>
            <option value="growth">Growth (KSh 8,500/mo)</option>
            <option value="scale">Scale (KSh 18,500/mo)</option>
            <option value="enterprise">Enterprise Custom</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">Extend Paid / Trial Access</label>
          <div className="flex gap-2">
            {[0, 7, 14, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setExtendDays(d)}
                className={cn(
                  'btn text-xs flex-1',
                  extendDays === d ? 'btn-primary' : 'btn-secondary'
                )}
              >
                {d === 0 ? 'None' : `+${d}d`}
              </button>
            ))}
          </div>
          {extendDays > 0 && (
            <p className="mt-1 text-xs text-brand font-medium">
              Adds {extendDays} days to business active subscription.
            </p>
          )}
        </div>

        <div className="border-t border-line pt-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={lockAccount}
              onChange={(e) => setLockAccount(e.target.checked)}
              className="mt-0.5 rounded border-line"
            />
            <div>
              <span className="text-sm font-semibold text-bad flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Suspend & Lock Business Access
              </span>
              <p className="text-xs text-muted mt-0.5">
                Immediately prevents users of this tenant from creating or editing documents.
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-line">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Apply Changes'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

// -----------------------------------------------------------------------------
// Modal: Compliance Data Erasure / Permanent Wipe
// -----------------------------------------------------------------------------
function WipeDataModal({
  business,
  onClose,
  onWiped,
}: {
  business: BusinessItem;
  onClose: () => void;
  onWiped: () => void;
}) {
  const [reason, setReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [wiping, setWiping] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit =
    confirmName.trim().toLowerCase() === business.name.trim().toLowerCase() ||
    confirmName.trim().toUpperCase() === 'WIPE';

  const handleWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setWiping(true);
    setErr(null);
    try {
      await api(`/platform/businesses/${business.id}/wipe`, {
        method: 'POST',
        body: {
          reason: reason.trim(),
          confirm: confirmName.trim(),
        },
      });
      onWiped();
    } catch (error: any) {
      setErr(error.message || 'Permanent erasure failed.');
      setWiping(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={`Compliance Wipe: ${business.name}`}>
      <form onSubmit={handleWipe} className="space-y-5">
        {err && <ErrorNote>{err}</ErrorNote>}

        <div className="rounded-xl border border-bad/40 bg-bad-soft/40 p-4 space-y-2 text-ink">
          <div className="flex items-center gap-2 text-bad font-bold text-sm">
            <AlertOctagon className="h-5 w-5" /> PERMANENT DATA ERASURE (KDPA / GDPR)
          </div>
          <p className="text-xs leading-relaxed text-ink-2">
            This action triggers a complete cascading purge across all 60+ domain tables (financial journals,
            invoices, payments, payroll, employees, inventory, customer records, and API credentials) owned by{' '}
            <strong>{business.name}</strong>.
          </p>
          <p className="text-xs font-semibold text-bad">This operation is irreversible.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">
            Compliance Reason (Required for Audit Logging)
          </label>
          <textarea
            className="field h-24 text-sm"
            placeholder="e.g. Contract termination per mutual agreement under Section 40 of Kenya Data Protection Act 2019..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1.5">
            Type <span className="font-mono text-bad select-all">{business.name}</span> or{' '}
            <span className="font-mono text-bad">WIPE</span> to confirm:
          </label>
          <input
            className="field"
            placeholder={business.name}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-line">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={wiping}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary bg-bad hover:bg-bad/90 text-white"
            disabled={wiping || !canSubmit || reason.trim().length < 3}
          >
            {wiping ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Purging Data...
              </>
            ) : (
              'Permanently Wipe Tenant Data'
            )}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
