// The platform console for Kabuor Builds: oversight across every business, server health & auto-scaling
// telemetry, database capacity, data governance & KDPA/GDPR compliance data wipes, cross-tenant support desk, and platform growth.
import { useEffect, useId, useState } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  Clock,
  Cpu,
  Database,
  Eye,
  FileText,
  HardDrive,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Server,
  ShieldAlert,
  Trash2,
  Zap,
} from 'lucide-react';
import { api, useApi } from '../lib/api';
import { cn, dateTime, ksh } from '../lib/format';
import { Chips, ErrorNote, Loading, PageHeader, Sheet } from '../components/ui';

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

type BusinessDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  county: string | null;
  kraPin: string | null;
  vatRegistered: boolean;
  plan: string;
  industry: string | null;
  mpesaShortcode: string | null;
  createdAt: string;
  trialEndsAt: string | null;
  paidUntil: string | null;
  state: 'paying' | 'trial' | 'grace' | 'locked';
  users: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    active: boolean;
    createdAt: string;
    lastSignInAt: string | null;
  }[];
  invoices: {
    id: string;
    number: string;
    customerName: string;
    total: number;
    balance: number;
    status: string;
    issueDate: string;
    dueDate: string | null;
  }[];
  invoicedTotal: number;
  footprint: {
    users: number;
    customers: number;
    items: number;
    invoices: number;
    payments: number;
    assets: number;
    inquiries: number;
    employees: number;
    journals: number;
  };
  canWipe: boolean;
};

type IssueMessage = {
  id: string;
  from: string;
  author: string | null;
  body: string;
  at: string;
};

type IssueItem = {
  id: string;
  companyId: string;
  companyName: string;
  number: string;
  name: string;
  phone: string | null;
  email: string | null;
  subject: string;
  channel: string;
  status: string;
  createdAt: string;
  firstResponseAt: string | null;
  messages: IssueMessage[];
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

const count = (n: number) => n.toLocaleString('en-KE');
const short = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n);

// -----------------------------------------------------------------------------
// Sleek Minimalist Executive Components
// -----------------------------------------------------------------------------
function StatusDot({ status }: { status: 'good' | 'warn' | 'bad' | 'info' | 'neutral' }) {
  const bg =
    status === 'good'
      ? 'bg-emerald-500'
      : status === 'warn'
      ? 'bg-amber-500'
      : status === 'bad'
      ? 'bg-rose-500'
      : status === 'info'
      ? 'bg-sky-500'
      : 'bg-slate-400';
  return <span className={cn('inline-block h-2 w-2 rounded-full ring-2 ring-white/20', bg)} />;
}

function StatusBadge({ state }: { state: string }) {
  const map: Record<string, { dot: 'good' | 'warn' | 'bad' | 'info' | 'neutral'; label: string }> = {
    paying: { dot: 'good', label: 'Paying' },
    trial: { dot: 'info', label: 'Trial' },
    grace: { dot: 'warn', label: 'Grace' },
    locked: { dot: 'bad', label: 'Locked' },
    Open: { dot: 'warn', label: 'Open' },
    InProgress: { dot: 'info', label: 'In Progress' },
    Resolved: { dot: 'good', label: 'Resolved' },
    Closed: { dot: 'neutral', label: 'Closed' },
  };
  const item = map[state] ?? { dot: 'neutral', label: state };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300">
      <StatusDot status={item.dot} />
      <span>{item.label}</span>
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-zinc-400">
          {title}
        </span>
        {icon && <span className="text-slate-400 dark:text-zinc-500">{icon}</span>}
      </div>
      <div className="num mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
        {value}
      </div>
      {subtitle && <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{subtitle}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// High-Precision SVG Line Chart Component
// -----------------------------------------------------------------------------
function SvgLineChart({
  data,
  height = 200,
  strokeColor = '#0f172a',
  fillGradient = true,
  fmt = (v: number) => String(v),
  emptyMsg = 'No telemetry data recorded for this window',
}: {
  data: { label: string; value: number; secondary?: number }[];
  height?: number;
  strokeColor?: string;
  fillGradient?: boolean;
  fmt?: (v: number) => string;
  emptyMsg?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradId = useId();

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 dark:border-zinc-800"
        style={{ height }}
      >
        {emptyMsg}
      </div>
    );
  }

  const padding = { top: 16, right: 16, bottom: 28, left: 44 };
  const width = 600;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const minVal = 0;

  const getX = (i: number) =>
    data.length === 1 ? padding.left + innerW / 2 : padding.left + (i / (data.length - 1)) * innerW;
  const getY = (v: number) => padding.top + innerH - ((v - minVal) / (maxVal - minVal)) * innerH;

  // Build smooth cubic bezier curve
  const points = data.map((d, i) => ({ x: getX(i), y: getY(d.value) }));
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${
    points[0].x
  } ${padding.top + innerH} Z`;

  // Y-axis ticks (4 ticks)
  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];

  // X-axis label sample indices (up to 6)
  const step = Math.max(1, Math.floor(data.length / 5));
  const xIndices = data.map((_, i) => i).filter((i) => i % step === 0 || i === data.length - 1);

  return (
    <div className="relative w-full select-none" onMouseLeave={() => setHoverIndex(null)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        style={{ maxHeight: height }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines & Y labels */}
        {yTicks.map((tick, idx) => {
          const y = getY(tick);
          return (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#94a3b8"
                strokeOpacity="0.15"
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-medium num"
              >
                {short(Math.round(tick))}
              </text>
            </g>
          );
        })}

        {/* Gradient Area Fill */}
        {fillGradient && <path d={areaPath} fill={`url(#${gradId})`} />}

        {/* Main Line Stroke */}
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />

        {/* X-axis tick labels */}
        {xIndices.map((idx) => {
          const x = getX(idx);
          return (
            <text
              key={idx}
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-400 text-[10px] font-medium"
            >
              {data[idx].label}
            </text>
          );
        })}

        {/* Hover vertical crosshair & point indicator */}
        {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < points.length && (
          <g>
            <line
              x1={points[hoverIndex].x}
              y1={padding.top}
              x2={points[hoverIndex].x}
              y2={padding.top + innerH}
              stroke="#64748b"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle
              cx={points[hoverIndex].x}
              cy={points[hoverIndex].y}
              r="4.5"
              fill={strokeColor}
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        )}

        {/* Invisible mouse hover overlay columns */}
        {data.map((_, i) => {
          const x = getX(i);
          const colW = innerW / data.length;
          return (
            <rect
              key={i}
              x={x - colW / 2}
              y={padding.top}
              width={colW}
              height={innerH}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoverIndex(i)}
            />
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-md border border-slate-200 bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-md transition-all dark:border-zinc-700"
          style={{
            left: `${Math.min(85, Math.max(15, (points[hoverIndex].x / width) * 100))}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-medium text-slate-300">{data[hoverIndex].label}</div>
          <div className="num font-bold text-white">{fmt(data[hoverIndex].value)}</div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Entrypoint
// -----------------------------------------------------------------------------
export default function Platform() {
  const me = useApi<{ allowed: boolean; why: string }>('/platform/me');
  if (me.error) return <ErrorNote>{me.error}</ErrorNote>;
  if (!me.data) return <Loading />;
  if (!me.data.allowed) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-slate-400" />
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-zinc-100">Platform Admin Console</h1>
        <p className="mt-2 text-sm text-slate-500">{me.data.why}</p>
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
          <p className="font-semibold text-slate-800 dark:text-zinc-200">Administrative Policy</p>
          <p className="mt-1">
            Access to cross-tenant administration, system resource telemetry, KDPA/GDPR data wipes, and cross-company
            issues is restricted to verified platform administrators.
          </p>
        </div>
      </div>
    );
  }
  return <Console />;
}

type Tab = 'resources' | 'businesses' | 'traffic' | 'growth' | 'issues' | 'purge';

function Console() {
  const [tab, setTab] = useState<Tab>('resources');
  const [actionMsg, setActionMsg] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const [acting, setActing] = useState(false);

  // APIs
  const health = useApi<Health>('/platform/health');
  const resources = useApi<Resources>('/platform/resources');
  const businesses = useApi<BusinessItem[]>('/platform/businesses');
  const issues = useApi<IssueItem[]>('/platform/issues');
  const [days, setDays] = useState<'7' | '30' | '90' | '365'>('30');
  const analytics = useApi<Analytics>(`/platform/analytics?days=${days}`);

  // Modals & Drawers
  const [selectedBizId, setSelectedBizId] = useState<string | null>(null);
  const [planModalBiz, setPlanModalBiz] = useState<BusinessItem | null>(null);
  const [wipeTargetBiz, setWipeTargetBiz] = useState<BusinessItem | null>(null);

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
    issues.reload();
  };

  const h = health.data;
  const r = resources.data;
  const problems = h?.checks.filter((c) => c.status !== 'good') ?? [];
  const openIssuesCount = issues.data?.filter((i) => i.status === 'Open' || i.status === 'InProgress').length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Admin Console"
        subtitle="Oversee server telemetry, cross-tenant businesses, support inquiries, and KDPA compliance erasures"
        actions={
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost text-xs border border-slate-200 dark:border-zinc-800"
              onClick={reloadAll}
              title="Refresh all metrics"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button
              className="btn btn-secondary text-xs"
              disabled={acting}
              onClick={() => runAction('gc-collect')}
              title="Force Garbage Collection & compact memory"
            >
              <Zap className="h-3.5 w-3.5 text-slate-700 dark:text-zinc-300" /> {acting ? 'Running...' : 'Run GC'}
            </button>
          </div>
        }
      />

      {actionMsg && (
        <div
          className={cn(
            'flex items-center justify-between rounded-lg px-4 py-2.5 text-xs font-medium border transition',
            actionMsg.tone === 'good'
              ? 'border-slate-200 bg-slate-50 text-slate-800 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300'
          )}
        >
          <span>{actionMsg.text}</span>
          <button className="opacity-70 hover:opacity-100" onClick={() => setActionMsg(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Primary Tab Navigation */}
      <div className="border-b border-slate-200 dark:border-zinc-800">
        <nav className="flex space-x-1 overflow-x-auto pb-px" aria-label="Tabs">
          <button
            onClick={() => setTab('resources')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition',
              tab === 'resources'
                ? 'border-slate-900 text-slate-900 dark:border-zinc-100 dark:text-zinc-100'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            <Server className="h-4 w-4" /> Resources & Scaling
          </button>

          <button
            onClick={() => setTab('businesses')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition',
              tab === 'businesses'
                ? 'border-slate-900 text-slate-900 dark:border-zinc-100 dark:text-zinc-100'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            <Building2 className="h-4 w-4" /> Businesses & Demo
            {businesses.data && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                {businesses.data.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setTab('traffic')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition',
              tab === 'traffic'
                ? 'border-slate-900 text-slate-900 dark:border-zinc-100 dark:text-zinc-100'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            <Activity className="h-4 w-4" /> Traffic & Health
            {problems.length > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                {problems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setTab('growth')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition',
              tab === 'growth'
                ? 'border-slate-900 text-slate-900 dark:border-zinc-100 dark:text-zinc-100'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            <BarChart3 className="h-4 w-4" /> Growth & Revenue
          </button>

          <button
            onClick={() => setTab('issues')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition',
              tab === 'issues'
                ? 'border-slate-900 text-slate-900 dark:border-zinc-100 dark:text-zinc-100'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            <MessageSquare className="h-4 w-4" /> Support & Issues
            {openIssuesCount > 0 && (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {openIssuesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setTab('purge')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition',
              tab === 'purge'
                ? 'border-slate-900 text-slate-900 dark:border-zinc-100 dark:text-zinc-100'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            <Trash2 className="h-4 w-4" /> Delete Account / Purge
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
              {/* Scaling Diagnosis Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 rounded-lg border border-slate-200 p-2 dark:border-zinc-800">
                    <Server className="h-5 w-5 text-slate-700 dark:text-zinc-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                        Capacity Telemetry: {r.scaling.summary}
                      </h2>
                      <StatusBadge state={r.scaling.status === 'optimal' ? 'Resolved' : 'Open'} />
                    </div>
                    <div className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-zinc-400">
                      {r.scaling.recommendations.map((rec, i) => (
                        <p key={i} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          <span>{rec}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Working Set Memory"
                  value={`${r.memory.workingSetMb} MB`}
                  subtitle={`Managed Heap: ${r.memory.heapMb} MB`}
                  icon={<HardDrive className="h-4 w-4" />}
                />
                <StatCard
                  title="ThreadPool Workers"
                  value={`${r.cpu.busyWorkerThreads} busy`}
                  subtitle={`Max Capacity: ${count(r.cpu.maxWorkerThreads)}`}
                  icon={<Cpu className="h-4 w-4" />}
                />
                <StatCard
                  title="PostgreSQL Database"
                  value={r.database.sizeMb ? `${r.database.sizeMb} MB` : 'Operational'}
                  subtitle={`Active Connections: ${r.database.connections ?? 'N/A'}`}
                  icon={<Database className="h-4 w-4" />}
                />
                <StatCard
                  title="Server Uptime"
                  value={`${r.uptime.uptimeHours} hrs`}
                  subtitle={`Online since ${dateTime(r.uptime.startedAt)}`}
                  icon={<Clock className="h-4 w-4" />}
                />
              </div>

              {/* Memory Saturation & Server Specs */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-zinc-100">
                      Memory Allocation & GC Pressure
                    </h3>
                    <span className="text-xs text-slate-400">Vercel Container Engine</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-500 mb-1.5">
                      <span>RAM Utilization</span>
                      <span>{r.memory.workingSetMb} MB / 1024 MB</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-slate-800 transition-all duration-500 dark:bg-zinc-200"
                        style={{ width: `${Math.min(100, Math.round((r.memory.workingSetMb / 1024) * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <p className="text-slate-500">GC Gen 0</p>
                      <p className="num text-lg font-bold text-slate-900 mt-0.5 dark:text-zinc-100">{r.memory.gen0}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <p className="text-slate-500">GC Gen 1</p>
                      <p className="num text-lg font-bold text-slate-900 mt-0.5 dark:text-zinc-100">{r.memory.gen1}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <p className="text-slate-500">GC Gen 2</p>
                      <p className="num text-lg font-bold text-slate-900 mt-0.5 dark:text-zinc-100">{r.memory.gen2}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="font-semibold text-slate-900 dark:text-zinc-100">
                    Host Architecture & Quick Operations
                  </h3>
                  <div className="space-y-3 text-xs text-slate-600 dark:text-zinc-400">
                    <p>
                      Kabuor ERP runs on .NET 8 Server Garbage Collector. When hosting multi-tenant workloads, use
                      these controls to reclaim cache pools or compact memory.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        className="btn btn-secondary text-xs"
                        disabled={acting}
                        onClick={() => runAction('gc-collect')}
                      >
                        <Zap className="h-3.5 w-3.5 text-slate-700 dark:text-zinc-300" /> Compact Large Object Heap
                      </button>
                      <button
                        className="btn btn-secondary text-xs"
                        disabled={acting}
                        onClick={() => runAction('clear-cache')}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Flush Query Cache
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: BUSINESSES & DEMO EXPLORER */}
      {tab === 'businesses' && (
        <BusinessesView
          businesses={businesses.data ?? []}
          loading={businesses.loading}
          error={businesses.error}
          onReload={() => businesses.reload()}
          onSelect={(id) => setSelectedBizId(id)}
          onEditPlan={(b) => setPlanModalBiz(b)}
          onWipe={(b) => {
            setWipeTargetBiz(b);
            setTab('purge');
          }}
        />
      )}

      {/* TAB 3: TRAFFIC & PERFORMANCE */}
      {tab === 'traffic' && <TrafficView health={h} error={health.error} />}

      {/* TAB 4: GROWTH & REVENUE */}
      {tab === 'growth' && (
        <GrowthView analytics={analytics.data} error={analytics.error} days={days} setDays={setDays} />
      )}

      {/* TAB 5: SUPPORT & ISSUES */}
      {tab === 'issues' && (
        <IssuesView
          issues={issues.data ?? []}
          loading={issues.loading}
          error={issues.error}
          onReload={() => issues.reload()}
        />
      )}

      {/* TAB 6: DEDICATED DELETE ACCOUNT / DATA PURGE */}
      {tab === 'purge' && (
        <PurgeAccountView
          businesses={businesses.data ?? []}
          preselectedBiz={wipeTargetBiz}
          onPurged={() => {
            businesses.reload();
            setWipeTargetBiz(null);
          }}
        />
      )}

      {/* Business Details Slide-over Sheet */}
      {selectedBizId && (
        <BusinessDetailSheet
          businessId={selectedBizId}
          onClose={() => setSelectedBizId(null)}
          onEditPlan={(b) => {
            setSelectedBizId(null);
            setPlanModalBiz(b);
          }}
          onWipe={(b) => {
            setSelectedBizId(null);
            setWipeTargetBiz(b);
            setTab('purge');
          }}
        />
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
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: Businesses & Demo Explorer
// -----------------------------------------------------------------------------
function BusinessesView({
  businesses,
  loading,
  error,
  onReload,
  onSelect,
  onEditPlan,
  onWipe,
}: {
  businesses: BusinessItem[];
  loading: boolean;
  error?: string | null;
  onReload: () => void;
  onSelect: (id: string) => void;
  onEditPlan: (b: BusinessItem) => void;
  onWipe: (b: BusinessItem) => void;
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="field pl-9 text-xs"
              placeholder="Search companies, demo businesses, emails, counties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost text-xs p-2 border border-slate-200 dark:border-zinc-800"
            onClick={onReload}
            title="Refresh businesses directory"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        <Chips
          label="Status Filter"
          value={filterState}
          onChange={setFilterState}
          options={[
            ['all', 'All Companies', businesses.length],
            ['paying', 'Paying', businesses.filter((b) => b.state === 'paying').length],
            ['trial', 'Trial', businesses.filter((b) => b.state === 'trial').length],
            ['grace', 'Grace', businesses.filter((b) => b.state === 'grace').length],
            ['locked', 'Locked', businesses.filter((b) => b.state === 'locked').length],
          ]}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase tracking-wider dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <tr>
                <th className="py-3 px-4">Business & Identity</th>
                <th className="py-3 px-4">Status & Plan</th>
                <th className="py-3 px-4 text-center">Team Size</th>
                <th className="py-3 px-4 text-right">Invoiced Volume</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    No businesses match your filter query.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-50/60 transition cursor-pointer dark:hover:bg-zinc-800/40"
                    onClick={() => onSelect(b.id)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 hover:underline dark:text-zinc-100">
                          {b.name}
                        </span>
                        {b.name.includes('Amani') && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                            Demo
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {b.email || b.phone || 'No direct email'} {b.county ? `· ${b.county}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge state={b.state} />
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          {b.plan || 'Free'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium num text-slate-700 dark:text-zinc-300">
                      {b.usersCount} users
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-semibold num text-slate-900 dark:text-zinc-100">{ksh(b.invoiceValue)}</div>
                      <div className="text-xs text-slate-400 num">{b.invoicesCount} invoices</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {b.lastActive ? dateTime(b.lastActive) : 'Never'}
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="btn btn-ghost text-xs py-1 px-2 border border-slate-200 dark:border-zinc-800"
                          onClick={() => onSelect(b.id)}
                          title="View complete business profile, team members, and footprint"
                        >
                          <Eye className="h-3.5 w-3.5" /> Details
                        </button>
                        <button
                          className="btn btn-secondary text-xs py-1 px-2.5"
                          onClick={() => onEditPlan(b)}
                          title="Adjust plan tier or extend trial days"
                        >
                          Plan
                        </button>
                        {b.name !== 'Kabuor Builds' && (
                          <button
                            className="btn btn-ghost text-xs text-slate-400 hover:text-rose-600 py-1 px-2"
                            onClick={() => onWipe(b)}
                            title="Open compliance data wipe"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
// Component: Business Detail Slide-over Sheet
// -----------------------------------------------------------------------------
function BusinessDetailSheet({
  businessId,
  onClose,
  onEditPlan,
  onWipe,
}: {
  businessId: string;
  onClose: () => void;
  onEditPlan: (b: BusinessItem) => void;
  onWipe: (b: BusinessItem) => void;
}) {
  const detail = useApi<BusinessDetail>(`/platform/businesses/${businessId}`);
  const b = detail.data;

  return (
    <Sheet open onClose={onClose} title={b ? b.name : 'Loading business...'}>
      {detail.error ? (
        <ErrorNote>{detail.error}</ErrorNote>
      ) : !b ? (
        <Loading />
      ) : (
        <div className="space-y-6 text-sm">
          {/* Header Summary */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-base dark:text-zinc-100">{b.name}</h3>
                <p className="text-xs text-slate-500">ID: {b.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge state={b.state} />
                <span className="rounded bg-slate-200/80 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-zinc-700 dark:text-zinc-200">
                  {b.plan} Plan
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-zinc-400 sm:grid-cols-3">
              <div>
                <span className="block text-slate-400">Email Contact</span>
                <span className="font-medium text-slate-800 dark:text-zinc-200">{b.email || 'None'}</span>
              </div>
              <div>
                <span className="block text-slate-400">Phone Number</span>
                <span className="font-medium text-slate-800 dark:text-zinc-200">{b.phone || 'None'}</span>
              </div>
              <div>
                <span className="block text-slate-400">County</span>
                <span className="font-medium text-slate-800 dark:text-zinc-200">{b.county || 'Nairobi'}</span>
              </div>
              <div>
                <span className="block text-slate-400">KRA PIN</span>
                <span className="font-medium font-mono text-slate-800 dark:text-zinc-200">{b.kraPin || 'Unset'}</span>
              </div>
              <div>
                <span className="block text-slate-400">VAT Registered</span>
                <span className="font-medium text-slate-800 dark:text-zinc-200">{b.vatRegistered ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <span className="block text-slate-400">Onboarded</span>
                <span className="font-medium text-slate-800 dark:text-zinc-200">{dateTime(b.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Footprint Grid */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Data Storage Footprint
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-5">
              <div className="rounded-lg border border-slate-200 p-2 dark:border-zinc-800">
                <span className="text-slate-400 block">Users</span>
                <span className="font-bold num text-sm text-slate-800 dark:text-zinc-200">{b.footprint.users}</span>
              </div>
              <div className="rounded-lg border border-slate-200 p-2 dark:border-zinc-800">
                <span className="text-slate-400 block">Customers</span>
                <span className="font-bold num text-sm text-slate-800 dark:text-zinc-200">{b.footprint.customers}</span>
              </div>
              <div className="rounded-lg border border-slate-200 p-2 dark:border-zinc-800">
                <span className="text-slate-400 block">Products</span>
                <span className="font-bold num text-sm text-slate-800 dark:text-zinc-200">{b.footprint.items}</span>
              </div>
              <div className="rounded-lg border border-slate-200 p-2 dark:border-zinc-800">
                <span className="text-slate-400 block">Invoices</span>
                <span className="font-bold num text-sm text-slate-800 dark:text-zinc-200">{b.footprint.invoices}</span>
              </div>
              <div className="rounded-lg border border-slate-200 p-2 dark:border-zinc-800">
                <span className="text-slate-400 block">Journals</span>
                <span className="font-bold num text-sm text-slate-800 dark:text-zinc-200">{b.footprint.journals}</span>
              </div>
            </div>
          </div>

          {/* Team Members List */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Authorized Team Members ({b.users.length})
            </h4>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden dark:border-zinc-800 dark:divide-zinc-800">
              {b.users.length === 0 ? (
                <div className="p-3 text-xs text-slate-400">No users found.</div>
              ) : (
                b.users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 text-xs">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-zinc-100">{u.name}</div>
                      <div className="text-slate-400">{u.email} {u.phone ? `· ${u.phone}` : ''}</div>
                    </div>
                    <div className="text-right">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {u.role}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {u.lastSignInAt ? `Last active ${dateTime(u.lastSignInAt)}` : 'Never signed in'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Invoices Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Recent Billing Documents
              </h4>
              <span className="text-xs font-bold num text-slate-700 dark:text-zinc-300">
                Total Invoiced: {ksh(b.invoicedTotal)}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 overflow-hidden text-xs dark:border-zinc-800">
              {b.invoices.length === 0 ? (
                <div className="p-3 text-slate-400">No invoices created yet.</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 dark:bg-zinc-800 dark:border-zinc-700">
                    <tr>
                      <th className="py-2 px-3">Number</th>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {b.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-2 px-3 font-mono font-medium">{inv.number}</td>
                        <td className="py-2 px-3">{inv.customerName}</td>
                        <td className="py-2 px-3 text-right font-medium num">{ksh(inv.total)}</td>
                        <td className="py-2 px-3">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-zinc-800">
            {b.canWipe ? (
              <button
                className="btn btn-ghost text-xs text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  onClose();
                  onWipe(b as any);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Purge Account Data
              </button>
            ) : (
              <span className="text-xs text-slate-400">Protected Platform Tenant</span>
            )}

            <div className="flex gap-2">
              <button className="btn btn-secondary text-xs" onClick={onClose}>
                Close
              </button>
              <button
                className="btn btn-primary text-xs"
                onClick={() => {
                  onClose();
                  onEditPlan(b as any);
                }}
              >
                Change Plan Tier
              </button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// -----------------------------------------------------------------------------
// Component: Traffic & Performance View with SVG Line Graphs
// -----------------------------------------------------------------------------
function TrafficView({ health, error }: { health?: Health | null; error?: string | null }) {
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!health) return <Loading />;
  const problems = health.checks.filter((c) => c.status !== 'good');

  const trafficSeries = (health.traffic.series ?? []).map((s) => ({
    label: new Date(s.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    value: s.requests,
  }));

  const latencySeries = (health.traffic.series ?? []).map((s) => ({
    label: new Date(s.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    value: s.avgMs,
  }));

  return (
    <div className="space-y-6">
      {/* Subsystem Health Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <StatusDot status={health.status} />
          <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">
            {problems.length === 0
              ? 'All subsystems functioning normally'
              : `${problems.length} subsystem${problems.length === 1 ? '' : 's'} require verification`}
          </span>
        </div>
        <span className="text-xs text-slate-400">
          Checked {dateTime(health.checkedAt)} · .NET {health.server.dotnet}
        </span>
      </div>

      {/* Subsystem Checks Grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {health.checks.map((c) => (
          <div
            key={c.key}
            className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">{c.name}</span>
              <StatusBadge state={c.status === 'good' ? 'Resolved' : c.status === 'warn' ? 'InProgress' : 'Open'} />
            </div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">{c.summary}</p>
          </div>
        ))}
      </div>

      {/* SVG Line Graph: Requests / Minute */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm dark:text-zinc-100">
              System Traffic (Requests / Minute)
            </h3>
            <p className="text-xs text-slate-500">
              {count(health.traffic.requests)} requests recorded in this telemetry window
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-zinc-400">
            <span>Error rate: <b className="num text-slate-900 dark:text-zinc-100">{health.traffic.errorRate}%</b></span>
            <span>95th percentile: <b className="num text-slate-900 dark:text-zinc-100">{health.traffic.p95} ms</b></span>
          </div>
        </div>

        <SvgLineChart
          data={trafficSeries}
          height={190}
          strokeColor="#0f172a"
          fmt={(v) => `${count(v)} requests`}
        />
      </div>

      {/* SVG Line Graph: Latency Trend */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm dark:text-zinc-100">
              API Response Latency Trend (Average Milliseconds)
            </h3>
            <p className="text-xs text-slate-500">P50: {health.traffic.p50}ms · P95: {health.traffic.p95}ms · P99: {health.traffic.p99}ms</p>
          </div>
        </div>

        <SvgLineChart
          data={latencySeries}
          height={170}
          strokeColor="#475569"
          fmt={(v) => `${v} ms`}
        />
      </div>

      {/* Slowest and Error Endpoints */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-xs font-semibold text-slate-800 uppercase tracking-wider dark:text-zinc-200">
            Slowest API Endpoints
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-slate-400 dark:border-zinc-800">
                <tr>
                  <th className="py-2">Route</th>
                  <th className="py-2 text-right">Calls</th>
                  <th className="py-2 text-right">Avg ms</th>
                  <th className="py-2 text-right">Max ms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {health.traffic.slowest.map((r, i) => (
                  <tr key={i}>
                    <td className="py-2 font-mono text-slate-700 dark:text-zinc-300 truncate max-w-[12rem]">
                      {r.route}
                    </td>
                    <td className="py-2 text-right num">{r.requests}</td>
                    <td className="py-2 text-right num font-semibold">{r.avgMs}</td>
                    <td className="py-2 text-right num text-slate-500">{r.maxMs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-xs font-semibold text-slate-800 uppercase tracking-wider dark:text-zinc-200">
            Server Error Log
          </p>
          {health.traffic.failing.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-xs text-slate-400">
              Zero 5xx server exceptions in active window.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 text-slate-400 dark:border-zinc-800">
                  <tr>
                    <th className="py-2">Endpoint</th>
                    <th className="py-2 text-right">Errors</th>
                    <th className="py-2 text-right">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {health.traffic.failing.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 font-mono text-slate-700 dark:text-zinc-300 truncate max-w-[12rem]">
                        {r.route}
                      </td>
                      <td className="py-2 text-right font-bold text-rose-600 num">{r.errors}</td>
                      <td className="py-2 text-right num text-slate-500">{r.requests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: Growth & Analytics View with SVG Line Graph
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

  const invoiceSeries = (analytics.series ?? []).map((s) => ({
    label: s.day.slice(5),
    value: s.invoiceValue,
  }));

  const signupSeries = (analytics.series ?? []).map((s) => ({
    label: s.day.slice(5),
    value: s.signups,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900 text-sm dark:text-zinc-100">
          Financial Growth & Platform Invoiced Volume
        </h2>
        <Chips
          label="Period"
          value={days}
          onChange={setDays}
          options={[
            ['7', '7 Days'],
            ['30', '30 Days'],
            ['90', '90 Days'],
            ['365', '1 Year'],
          ]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Businesses"
          value={count(b.total)}
          subtitle={`${b.newInPeriod} joined in last ${days} days`}
          icon={<Building2 className="h-4 w-4" />}
        />
        <StatCard
          title="Active This Week"
          value={count(b.active7d)}
          subtitle={`${Math.round((b.active7d / Math.max(1, b.total)) * 100)}% weekly activity`}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          title="Monthly Recurring Revenue"
          value={ksh(analytics.revenue.mrr)}
          subtitle={`${b.paying} paying · ${ksh(analytics.revenue.arr)} annual run rate`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <StatCard
          title="Tenant Invoiced Volume"
          value={ksh(analytics.volume.invoiceValue)}
          subtitle={`${count(analytics.volume.invoices)} invoices across all tenants`}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      {/* SVG Line Graph: Daily Invoiced Volume */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm dark:text-zinc-100">
              Daily Invoiced Volume Across All Businesses (KES)
            </h3>
            <p className="text-xs text-slate-500">
              Total period volume: {ksh(analytics.volume.invoiceValue)}
            </p>
          </div>
        </div>

        <SvgLineChart
          data={invoiceSeries}
          height={190}
          strokeColor="#0f172a"
          fmt={(v) => ksh(v)}
        />
      </div>

      {/* SVG Line Graph: Business Signups */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm dark:text-zinc-100">
              New Business Signups Trend
            </h3>
            <p className="text-xs text-slate-500">
              {b.newInPeriod} new companies registered in this window
            </p>
          </div>
        </div>

        <SvgLineChart
          data={signupSeries}
          height={160}
          strokeColor="#475569"
          fmt={(v) => `${v} businesses`}
        />
      </div>

      {/* Subscription Breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-2 text-xs font-semibold text-slate-800 uppercase tracking-wider dark:text-zinc-200">
          Paying Tenants by Subscription Tier
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 text-slate-400 dark:border-zinc-800">
              <tr>
                <th className="py-2">Tier Name</th>
                <th className="py-2 text-center">Active Tenants</th>
                <th className="py-2 text-right">Monthly Plan Price</th>
                <th className="py-2 text-right">MRR Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {b.byPlan.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 font-medium text-slate-800 dark:text-zinc-200">{p.name}</td>
                  <td className="py-2.5 text-center num">{p.businesses}</td>
                  <td className="py-2.5 text-right num text-slate-500">{ksh(p.monthly)}</td>
                  <td className="py-2.5 text-right font-semibold num text-slate-900 dark:text-zinc-100">
                    {ksh(p.mrr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: Support & Team Issues Desk
// -----------------------------------------------------------------------------
function IssuesView({
  issues,
  loading,
  error,
  onReload,
}: {
  issues: IssueItem[];
  loading: boolean;
  error?: string | null;
  onReload: () => void;
}) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyErr, setReplyErr] = useState<string | null>(null);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (loading && issues.length === 0) return <Loading />;

  const activeIssue = issues.find((i) => i.id === selectedIssueId) ?? issues[0] ?? null;

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIssue || !replyText.trim()) return;
    setSending(true);
    setReplyErr(null);
    try {
      await api(`/platform/issues/${activeIssue.id}/reply`, {
        method: 'POST',
        body: { message: replyText.trim() },
      });
      setReplyText('');
      onReload();
    } catch (err: any) {
      setReplyErr(err.message || 'Failed to send reply to tenant.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Cross-Tenant Customer & Team Inquiries
          </h2>
          <p className="text-xs text-slate-500">
            Receive and respond directly to support requests raised by tenant teams across all companies.
          </p>
        </div>
        <button
          className="btn btn-ghost text-xs border border-slate-200 dark:border-zinc-800"
          onClick={onReload}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh Tickets
        </button>
      </div>

      {issues.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 dark:border-zinc-800 dark:bg-zinc-900">
          <MessageSquare className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          No open support inquiries across tenants.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          {/* Issue Selector List */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:divide-zinc-800 max-h-[600px] overflow-y-auto">
            {issues.map((i) => {
              const selected = activeIssue?.id === i.id;
              return (
                <div
                  key={i.id}
                  onClick={() => setSelectedIssueId(i.id)}
                  className={cn(
                    'p-3.5 cursor-pointer transition text-xs',
                    selected
                      ? 'bg-slate-100/80 dark:bg-zinc-800'
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-zinc-100">{i.companyName}</span>
                    <StatusBadge state={i.status} />
                  </div>
                  <div className="font-medium text-slate-700 mt-1 truncate dark:text-zinc-300">
                    {i.subject}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                    <span>{i.name}</span>
                    <span>{dateTime(i.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Issue Conversation & Direct Reply Box */}
          {activeIssue && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between dark:border-zinc-800 dark:bg-zinc-900">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-zinc-800">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm dark:text-zinc-100">
                      #{activeIssue.number}: {activeIssue.subject}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Company: <strong>{activeIssue.companyName}</strong> · Contact: {activeIssue.name} ({activeIssue.email || activeIssue.phone})
                    </p>
                  </div>
                  <StatusBadge state={activeIssue.status} />
                </div>

                {/* Conversation History */}
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {activeIssue.messages.map((m) => {
                    const isStaff = m.from === 'Staff' || m.from === 'Admin';
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'p-3 rounded-lg text-xs leading-relaxed max-w-[85%]',
                          isStaff
                            ? 'ml-auto bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] opacity-75 mb-1">
                          <span>{m.author || (isStaff ? 'Platform Admin' : 'Customer Team')}</span>
                          <span>{dateTime(m.at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Direct Reply Composer */}
              <form onSubmit={handleSendReply} className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                {replyErr && <ErrorNote>{replyErr}</ErrorNote>}
                <textarea
                  className="field text-xs h-20"
                  placeholder={`Reply to ${activeIssue.name} at ${activeIssue.companyName}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={sending}
                  required
                />
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-400">
                    Replies are logged in the tenant's inquiry ledger and dispatched via their channel.
                  </span>
                  <button
                    type="submit"
                    className="btn btn-primary text-xs"
                    disabled={sending || !replyText.trim()}
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" /> Send Reply
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: Dedicated Delete Account / Data Purge View
// -----------------------------------------------------------------------------
function PurgeAccountView({
  businesses,
  preselectedBiz,
  onPurged,
}: {
  businesses: BusinessItem[];
  preselectedBiz?: BusinessItem | null;
  onPurged: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(preselectedBiz?.id ?? '');
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [wiping, setWiping] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const targetBiz = businesses.find((b) => b.id === selectedId);
  const detail = useApi<BusinessDetail>(selectedId ? `/platform/businesses/${selectedId}` : null);
  const canWipe = targetBiz && targetBiz.name !== 'Kabuor Builds';
  const isConfirmed = targetBiz && confirmText.trim().toLowerCase() === targetBiz.name.trim().toLowerCase();

  const handleWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBiz || !canWipe || !isConfirmed || reason.trim().length < 4) return;
    setWiping(true);
    setErr(null);
    setSuccessMsg(null);
    try {
      const res = await api<{ message: string }>(`/platform/businesses/${targetBiz.id}/wipe`, {
        method: 'POST',
        body: {
          reason: reason.trim(),
          confirm: confirmText.trim(),
        },
      });
      setSuccessMsg(res.message || `Successfully purged all records for ${targetBiz.name}.`);
      setSelectedId('');
      setConfirmText('');
      setReason('');
      onPurged();
    } catch (error: any) {
      setErr(error.message || 'Permanent erasure failed.');
    } finally {
      setWiping(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
          Permanent Tenant Deletion & KDPA / GDPR Compliance Purge
        </h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Executes Section 40 Kenya Data Protection Act 2019 and GDPR Article 17 "Right to Erasure". Cascades across
          all 60+ domain tables (financial journals, invoices, payroll, stock, customer records, and user logins).
        </p>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-medium text-slate-800 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
          ✓ {successMsg}
        </div>
      )}

      {err && <ErrorNote>{err}</ErrorNote>}

      <form onSubmit={handleWipe} className="rounded-xl border border-slate-200 bg-white p-6 space-y-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 dark:text-zinc-300">
            Select Company / Tenant Account to Purge
          </label>
          <select
            className="field text-xs"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setConfirmText('');
            }}
            required
          >
            <option value="">-- Choose business to delete --</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id} disabled={b.name === 'Kabuor Builds'}>
                {b.name} ({b.plan} plan · {b.usersCount} users) {b.name === 'Kabuor Builds' ? '[Protected]' : ''}
              </option>
            ))}
          </select>
        </div>

        {targetBiz && targetBiz.name === 'Kabuor Builds' && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-zinc-800 dark:bg-zinc-800">
            🛡️ <strong>Kabuor Builds</strong> is the root platform tenant and cannot be wiped.
          </div>
        )}

        {targetBiz && canWipe && detail.data && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-xs dark:border-zinc-800 dark:bg-zinc-800/40">
            <span className="font-semibold text-slate-800 dark:text-zinc-200">
              Impact Analysis: Records Scheduled for Destruction
            </span>
            <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-zinc-400 sm:grid-cols-4 pt-1">
              <div>Users: <b className="num text-slate-900 dark:text-zinc-100">{detail.data.footprint.users}</b></div>
              <div>Invoices: <b className="num text-slate-900 dark:text-zinc-100">{detail.data.footprint.invoices}</b></div>
              <div>Customers: <b className="num text-slate-900 dark:text-zinc-100">{detail.data.footprint.customers}</b></div>
              <div>Journals: <b className="num text-slate-900 dark:text-zinc-100">{detail.data.footprint.journals}</b></div>
            </div>
          </div>
        )}

        {canWipe && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 dark:text-zinc-300">
                Compliance & Audit Reason (Stored in Platform Audit Log)
              </label>
              <textarea
                className="field text-xs h-20"
                placeholder="e.g. Contract termination per customer request under Kenya Data Protection Act 2019 Section 40..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 dark:text-zinc-300">
                Confirmation: Type <span className="font-mono text-slate-900 dark:text-zinc-100">{targetBiz?.name}</span> to authorize:
              </label>
              <input
                className="field text-xs"
                placeholder={targetBiz?.name}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="btn btn-primary text-xs w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
                disabled={wiping || !isConfirmed || reason.trim().length < 4}
              >
                {wiping ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Executing Irreversible Data Wipe...
                  </>
                ) : (
                  `Execute Permanent Deletion of ${targetBiz?.name}`
                )}
              </button>
            </div>
          </>
        )}
      </form>
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
  const [extendDays, setExtendDays] = useState('0');
  const [lockTenant, setLockTenant] = useState(business.state === 'locked');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await api(`/platform/businesses/${business.id}/plan`, {
        method: 'POST',
        body: {
          plan,
          extendDays: parseInt(extendDays, 10) || 0,
          lock: lockTenant,
        },
      });
      onUpdated();
    } catch (error: any) {
      setErr(error.message || 'Failed to update subscription.');
      setSaving(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={`Subscription & Access: ${business.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {err && <ErrorNote>{err}</ErrorNote>}

        <div>
          <label className="block font-semibold mb-1">Plan Tier</label>
          <select className="field text-xs" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="starter">Starter — KSh 3,500/mo (up to 3 users)</option>
            <option value="growth">Growth — KSh 8,500/mo (up to 15 users, payroll, WhatsApp)</option>
            <option value="scale">Scale — KSh 18,500/mo (unlimited users, multi-branch, API)</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1">Extend Trial / Grace (Days)</label>
          <input
            type="number"
            className="field text-xs"
            value={extendDays}
            onChange={(e) => setExtendDays(e.target.value)}
            min="0"
            max="365"
          />
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lockTenant}
              onChange={(e) => setLockTenant(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="font-semibold text-slate-800 dark:text-zinc-200">
              Lock Tenant Workspace (Prevent Editing)
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-zinc-800">
          <button type="button" className="btn btn-secondary text-xs" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary text-xs" disabled={saving}>
            {saving ? 'Saving...' : 'Apply Subscription'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
