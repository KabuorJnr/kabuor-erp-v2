// The platform console for Kabuor Builds: oversight across every business, server health & auto-scaling
// telemetry, database capacity, data governance & KDPA/GDPR compliance data wipes, cross-tenant support desk, and platform growth.
// DESIGN: 100% PURE WHITE BACKGROUND, CRISP BLACK TYPOGRAPHY, REFINED BORDERS, PREMIUM EXECUTIVE UI/UX.
import { useEffect, useId, useState } from 'react';
import {
  Activity,
  ArrowUpDown,
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
  Users,
  Zap,
} from 'lucide-react';
import { api, useApi } from '../lib/api';
import { cn, dateTime, ksh } from '../lib/format';
import { Chips, ErrorNote, Loading, Sheet } from '../components/ui';

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
// Executive Status Badge & KPI Card (All White Background, Crisp Black Text)
// -----------------------------------------------------------------------------
function StatusBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; dot: string }> = {
    paying: { label: 'Paying', dot: 'bg-emerald-600' },
    trial: { label: 'Trial', dot: 'bg-blue-600' },
    grace: { label: 'Grace', dot: 'bg-amber-600' },
    locked: { label: 'Locked', dot: 'bg-rose-600' },
    Open: { label: 'Open', dot: 'bg-amber-600' },
    InProgress: { label: 'In Progress', dot: 'bg-blue-600' },
    Resolved: { label: 'Resolved', dot: 'bg-emerald-600' },
    Closed: { label: 'Closed', dot: 'bg-slate-400' },
  };
  const item = map[state] ?? { label: state, dot: 'bg-black' };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-bold text-black shadow-xs">
      <span className={cn('h-1.5 w-1.5 rounded-full', item.dot)} />
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
    <div className="group rounded-xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-400 hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-wider text-slate-600 uppercase group-hover:text-black transition-colors">
          {title}
        </span>
        {icon && (
          <div className="rounded-lg border border-slate-200 bg-white p-1.5 text-black shadow-xs">
            {icon}
          </div>
        )}
      </div>
      <div className="num mt-3 text-2xl font-black tracking-tight text-black sm:text-3xl">
        {value}
      </div>
      {subtitle && <div className="mt-1.5 text-xs font-semibold text-slate-600">{subtitle}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Interactive SVG Line Chart (All White Background, Pure Black Stroke)
// -----------------------------------------------------------------------------
function SvgLineChart({
  data,
  height = 210,
  strokeColor = '#000000',
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
        className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs font-semibold text-slate-500"
        style={{ height }}
      >
        {emptyMsg}
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 32, left: 52 };
  const width = 640;
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

  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];
  const step = Math.max(1, Math.floor(data.length / 5));
  const xIndices = data.map((_, i) => i).filter((i) => i % step === 0 || i === data.length - 1);

  return (
    <div className="relative w-full select-none bg-white" onMouseLeave={() => setHoverIndex(null)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible bg-white"
        style={{ maxHeight: height }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
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
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 10}
                y={y + 3.5}
                textAnchor="end"
                className="fill-black text-[11px] font-bold num"
              >
                {short(Math.round(tick))}
              </text>
            </g>
          );
        })}

        {/* Gradient Area Fill */}
        {fillGradient && <path d={areaPath} fill={`url(#${gradId})`} />}

        {/* Main Line Stroke */}
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />

        {/* X-axis tick labels */}
        {xIndices.map((idx) => {
          const x = getX(idx);
          return (
            <text
              key={idx}
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="fill-black text-[11px] font-bold"
            >
              {data[idx].label}
            </text>
          );
        })}

        {/* Hover crosshair & point indicator */}
        {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < points.length && (
          <g>
            <line
              x1={points[hoverIndex].x}
              y1={padding.top}
              x2={points[hoverIndex].x}
              y2={padding.top + innerH}
              stroke="#000000"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <circle
              cx={points[hoverIndex].x}
              cy={points[hoverIndex].y}
              r="5"
              fill="#000000"
              stroke="#ffffff"
              strokeWidth="2.5"
            />
          </g>
        )}

        {/* Mouse hover capture columns */}
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

      {/* Floating Tooltip in Pure White with Crisp Black Text */}
      {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length && (
        <div
          className="pointer-events-none absolute top-3 z-10 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-black shadow-xl transition-all"
          style={{
            left: `${Math.min(85, Math.max(15, (points[hoverIndex].x / width) * 100))}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold text-slate-600">{data[hoverIndex].label}</div>
          <div className="num font-black text-black text-sm">{fmt(data[hoverIndex].value)}</div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Platform Entrypoint
// -----------------------------------------------------------------------------
export default function Platform() {
  const me = useApi<{ allowed: boolean; why: string }>('/platform/me');
  if (me.error) return <ErrorNote>{me.error}</ErrorNote>;
  if (!me.data) return <Loading />;
  if (!me.data.allowed) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center bg-white">
        <ShieldAlert className="mx-auto h-12 w-12 text-black" />
        <h1 className="mt-4 text-xl font-bold text-black">Platform Admin Console</h1>
        <p className="mt-2 text-sm text-slate-700">{me.data.why}</p>
        <div className="mt-6 rounded-xl border border-slate-300 bg-white p-4 text-left text-xs text-slate-800 shadow-sm">
          <p className="font-bold text-black">Administrative Policy</p>
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

type Tab = 'businesses' | 'growth' | 'issues' | 'traffic' | 'resources' | 'purge';

function Console() {
  const [tab, setTab] = useState<Tab>('businesses');
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

  // Real-time founder startup metrics
  const bList = businesses.data ?? [];
  const totalBusinesses = bList.length;
  const payingBusinesses = bList.filter((b) => b.state === 'paying').length;
  const trialBusinesses = bList.filter((b) => b.state === 'trial').length;
  const totalUsers = bList.reduce((sum, b) => sum + b.usersCount, 0);
  const totalInvoiced = bList.reduce((sum, b) => sum + b.invoiceValue, 0);
  const mrrAmount = analytics.data?.revenue.mrr || (payingBusinesses * 12_500_00);

  return (
    <div className="space-y-6 bg-white min-h-screen text-black pb-12">
      {/* Executive Founder Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-black tracking-tight text-black sm:text-3xl">
              Founder Command Center
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-black">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Platform
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            Real-time client monitoring, business analytics & platform traction across Kenya · Kabuor ERP Founder
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-ghost text-xs border border-slate-300 bg-white text-black hover:bg-slate-50 font-bold shadow-xs"
            onClick={reloadAll}
            title="Reload all platform metrics"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Telemetry
          </button>
          <button
            className="btn btn-secondary text-xs border border-slate-300 bg-white text-black hover:bg-slate-50 font-bold shadow-xs"
            disabled={acting}
            onClick={() => runAction('gc-collect')}
            title="Trigger Garbage Collection & compact Large Object Heap"
          >
            <Zap className="h-3.5 w-3.5 text-black" /> {acting ? 'Running...' : 'Run GC'}
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="flex items-center justify-between rounded-xl px-4 py-3 text-xs font-bold border border-slate-300 bg-white text-black shadow-sm">
          <span>{actionMsg.text}</span>
          <button className="underline hover:opacity-75" onClick={() => setActionMsg(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Founder Executive Startup Overview Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Onboarded Clients"
          value={count(totalBusinesses)}
          subtitle={`${payingBusinesses} paying · ${trialBusinesses} on trial`}
          icon={<Building2 className="h-4 w-4" />}
        />
        <StatCard
          title="Monthly Recurring Revenue (MRR)"
          value={ksh(mrrAmount)}
          subtitle={`${ksh(mrrAmount * 12)} projected annual run rate`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <StatCard
          title="Active Client Headcount"
          value={count(totalUsers)}
          subtitle="Registered employees & users across clients"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          title="Platform Commerce Volume"
          value={ksh(totalInvoiced)}
          subtitle="Gross transaction value invoiced via Kabuor"
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      {/* Segmented Tab Pill Navigation in Pure White */}
      <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs overflow-x-auto">
        <nav className="flex space-x-1 min-w-max" aria-label="Tabs">
          <button
            onClick={() => setTab('businesses')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all',
              tab === 'businesses'
                ? 'bg-black text-white shadow-xs'
                : 'bg-white text-slate-700 hover:text-black hover:bg-slate-100/80'
            )}
          >
            <Building2 className="h-3.5 w-3.5" /> Client Directory
            {businesses.data && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-black',
                  tab === 'businesses' ? 'bg-white text-black' : 'bg-slate-200 text-slate-800'
                )}
              >
                {businesses.data.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setTab('growth')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all',
              tab === 'growth'
                ? 'bg-black text-white shadow-xs'
                : 'bg-white text-slate-700 hover:text-black hover:bg-slate-100/80'
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" /> Startup Analytics & MRR
          </button>

          <button
            onClick={() => setTab('issues')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all',
              tab === 'issues'
                ? 'bg-black text-white shadow-xs'
                : 'bg-white text-slate-700 hover:text-black hover:bg-slate-100/80'
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Support & Client Inquiries
            {openIssuesCount > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-black',
                  tab === 'issues' ? 'bg-white text-black' : 'bg-black text-white'
                )}
              >
                {openIssuesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setTab('traffic')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all',
              tab === 'traffic'
                ? 'bg-black text-white shadow-xs'
                : 'bg-white text-slate-700 hover:text-black hover:bg-slate-100/80'
            )}
          >
            <Activity className="h-3.5 w-3.5" /> Platform Traffic & Health
            {problems.length > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-black',
                  tab === 'traffic' ? 'bg-white text-black' : 'bg-rose-100 text-rose-800'
                )}
              >
                {problems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setTab('resources')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all',
              tab === 'resources'
                ? 'bg-black text-white shadow-xs'
                : 'bg-white text-slate-700 hover:text-black hover:bg-slate-100/80'
            )}
          >
            <Server className="h-3.5 w-3.5" /> Server Infrastructure
          </button>

          <button
            onClick={() => setTab('purge')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all',
              tab === 'purge'
                ? 'bg-black text-white shadow-xs'
                : 'bg-white text-slate-700 hover:text-black hover:bg-slate-100/80'
            )}
          >
            <Trash2 className="h-3.5 w-3.5" /> Account Purge & Wipes
          </button>
        </nav>
      </div>

      {/* TAB 1: RESOURCES & SCALING */}
      {tab === 'resources' && (
        <div className="space-y-6 bg-white">
          {resources.error ? (
            <ErrorNote>{resources.error}</ErrorNote>
          ) : !r ? (
            <Loading />
          ) : (
            <>
              {/* Capacity Status Card */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3.5">
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-black shadow-xs">
                    <Server className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-base font-bold text-black">
                        Auto-Scaling Telemetry: {r.scaling.summary}
                      </h2>
                      <StatusBadge state={r.scaling.status === 'optimal' ? 'Resolved' : 'Open'} />
                    </div>
                    <div className="mt-2 space-y-1.5 text-xs font-semibold text-slate-700">
                      {r.scaling.recommendations.map((rec, i) => (
                        <p key={i} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-black" />
                          <span>{rec}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Stat Cards */}
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
                  subtitle={`Max Capacity: ${count(r.cpu.maxWorkerThreads)} threads`}
                  icon={<Cpu className="h-4 w-4" />}
                />
                <StatCard
                  title="PostgreSQL Database"
                  value={r.database.sizeMb ? `${r.database.sizeMb} MB` : 'Active'}
                  subtitle={`Live Pool Connections: ${r.database.connections ?? 'N/A'}`}
                  icon={<Database className="h-4 w-4" />}
                />
                <StatCard
                  title="System Uptime"
                  value={`${r.uptime.uptimeHours} hrs`}
                  subtitle={`Continuous since ${dateTime(r.uptime.startedAt)}`}
                  icon={<Clock className="h-4 w-4" />}
                />
              </div>

              {/* Memory Saturation & Server Specs */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-black text-sm">
                      Memory Allocation & GC Pressure
                    </h3>
                    <span className="text-xs font-bold text-slate-600">Container Target: 1024 MB</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-black mb-1.5">
                      <span>RAM Utilization</span>
                      <span>{r.memory.workingSetMb} MB / 1024 MB ({Math.round((r.memory.workingSetMb / 1024) * 100)}%)</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-300">
                      <div
                        className="h-full rounded-full bg-black transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.round((r.memory.workingSetMb / 1024) * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                      <p className="font-bold text-slate-600">GC Gen 0</p>
                      <p className="num text-xl font-black text-black mt-0.5">{r.memory.gen0}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                      <p className="font-bold text-slate-600">GC Gen 1</p>
                      <p className="num text-xl font-black text-black mt-0.5">{r.memory.gen1}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                      <p className="font-bold text-slate-600">GC Gen 2</p>
                      <p className="num text-xl font-black text-black mt-0.5">{r.memory.gen2}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-sm">
                  <h3 className="font-bold text-black text-sm">
                    Runtime Architecture & Health Actions
                  </h3>
                  <div className="space-y-3 text-xs font-medium text-slate-700">
                    <p className="leading-relaxed">
                      Kabuor ERP operates on .NET 8 Server Garbage Collector. When hosting multi-tenant workloads, use
                      these controls to reclaim cache pools or compact large object allocations without restarting.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        className="btn btn-secondary text-xs border border-slate-300 bg-white text-black hover:bg-slate-50 font-bold shadow-xs"
                        disabled={acting}
                        onClick={() => runAction('gc-collect')}
                      >
                        <Zap className="h-3.5 w-3.5 text-black" /> Compact Large Object Heap
                      </button>
                      <button
                        className="btn btn-secondary text-xs border border-slate-300 bg-white text-black hover:bg-slate-50 font-bold shadow-xs"
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

      {/* Modal: Update Plan & Access in Pure White */}
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
// Component: Businesses & Demo Explorer (All White Background, Black Text)
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
  const [sortBy, setSortBy] = useState<'invoices' | 'users' | 'name'>('invoices');

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (loading && businesses.length === 0) return <Loading />;

  let filtered = businesses.filter((b) => {
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

  if (sortBy === 'invoices') {
    filtered = [...filtered].sort((a, b) => b.invoiceValue - a.invoiceValue);
  } else if (sortBy === 'users') {
    filtered = [...filtered].sort((a, b) => b.usersCount - a.usersCount);
  } else {
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="space-y-4 bg-white text-black">
      {/* Search, Filter, and Sort Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-black" />
            <input
              className="field pl-9 text-xs bg-white text-black border border-slate-300 font-semibold"
              placeholder="Search companies, demo accounts, emails, counties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost text-xs p-2 border border-slate-300 bg-white text-black hover:bg-slate-50 font-bold"
            onClick={onReload}
            title="Refresh businesses directory"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-black shadow-xs">
            <ArrowUpDown className="h-3 w-3 text-black" />
            <span className="text-slate-600">Sort:</span>
            <select
              className="bg-transparent font-bold text-black outline-none cursor-pointer"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="invoices">Invoiced Volume</option>
              <option value="users">Team Size</option>
              <option value="name">Company Name</option>
            </select>
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
      </div>

      {/* Directory Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm bg-white">
            <thead className="border-b border-slate-200 bg-white text-xs font-black text-black uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Business & Identity</th>
                <th className="py-3 px-4">Status & Plan</th>
                <th className="py-3 px-4 text-center">Team Size</th>
                <th className="py-3 px-4 text-right">Invoiced Volume</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs font-bold text-slate-500 bg-white">
                    No businesses match your filter query.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const initials = b.name
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-50 transition cursor-pointer bg-white"
                      onClick={() => onSelect(b.id)}
                    >
                      <td className="py-3.5 px-4 bg-white">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg border border-slate-300 bg-white flex items-center justify-center font-black text-xs text-black shadow-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-black hover:underline text-sm">
                                {b.name}
                              </span>
                              {b.name.includes('Amani') && (
                                <span className="rounded border border-slate-300 bg-white px-1.5 py-0.2 text-[10px] font-black uppercase tracking-wider text-black">
                                  Demo
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600 font-medium">
                              {b.email || b.phone || 'No direct contact'} {b.county ? `· ${b.county}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 bg-white">
                        <div className="flex items-center gap-2">
                          <StatusBadge state={b.state} />
                          <span className="text-xs font-bold uppercase tracking-wider text-black">
                            {b.plan || 'Free'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold num text-black bg-white">
                        {b.usersCount} users
                      </td>
                      <td className="py-3.5 px-4 text-right bg-white">
                        <div className="font-black num text-black">{ksh(b.invoiceValue)}</div>
                        <div className="text-xs text-slate-600 font-semibold num">{b.invoicesCount} invoices</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 bg-white">
                        {b.lastActive ? dateTime(b.lastActive) : 'Never'}
                      </td>
                      <td className="py-3.5 px-4 text-right bg-white" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="btn btn-ghost text-xs py-1 px-3 border border-slate-300 bg-white text-black hover:bg-slate-50 font-bold shadow-xs"
                            onClick={() => onSelect(b.id)}
                            title="Inspect complete business profile, team members, and footprint"
                          >
                            <Eye className="h-3.5 w-3.5 text-black" /> Details
                          </button>
                          <button
                            className="btn btn-secondary text-xs py-1 px-2.5 border border-slate-300 bg-white text-black hover:bg-slate-50 font-bold shadow-xs"
                            onClick={() => onEditPlan(b)}
                            title="Adjust plan tier or extend trial days"
                          >
                            Plan
                          </button>
                          {b.name !== 'Kabuor Builds' && (
                            <button
                              className="btn btn-ghost text-xs text-black border border-slate-300 hover:bg-slate-100 py-1 px-2 shadow-xs"
                              onClick={() => onWipe(b)}
                              title="Open compliance data wipe"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-black" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component: Business Detail Slide-over Sheet (All White Background, Black Text)
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
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'invoices'>('profile');

  return (
    <Sheet open onClose={onClose} wide title={b ? b.name : 'Loading business...'}>
      {detail.error ? (
        <ErrorNote>{detail.error}</ErrorNote>
      ) : !b ? (
        <Loading />
      ) : (
        <div className="space-y-6 text-sm bg-white text-black">
          {/* Header Summary Card */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-black text-xl">{b.name}</h3>
                <p className="text-xs text-slate-500 font-mono break-all mt-0.5">Company ID: {b.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge state={b.state} />
                <span className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-black">
                  {b.plan} Plan
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 text-xs font-medium text-slate-800 sm:grid-cols-3 border-t border-slate-100 pt-3.5">
              <div className="min-w-0">
                <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">Email</span>
                <span className="text-black font-semibold block truncate" title={b.email || 'None'}>
                  {b.email || 'None'}
                </span>
              </div>
              <div className="min-w-0">
                <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">Phone</span>
                <span className="text-black font-semibold block truncate">{b.phone || 'None'}</span>
              </div>
              <div className="min-w-0">
                <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">County</span>
                <span className="text-black font-semibold block truncate">{b.county || 'Nairobi'}</span>
              </div>
              <div className="min-w-0">
                <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">KRA PIN</span>
                <span className="font-mono font-bold text-black block truncate">{b.kraPin || 'Unset'}</span>
              </div>
              <div className="min-w-0">
                <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">VAT Registered</span>
                <span className="text-black font-semibold block truncate">{b.vatRegistered ? 'Yes' : 'No'}</span>
              </div>
              <div className="min-w-0">
                <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">Joined</span>
                <span className="text-black font-semibold block truncate">{dateTime(b.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Footprint Grid */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-black mb-2">
              Storage Footprint
            </h4>
            <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs min-w-0">
                <span className="text-slate-500 block font-semibold text-[11px] truncate">Users</span>
                <span className="font-black num text-base text-black">{b.footprint.users}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs min-w-0">
                <span className="text-slate-500 block font-semibold text-[11px] truncate">Customers</span>
                <span className="font-black num text-base text-black">{b.footprint.customers}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs min-w-0">
                <span className="text-slate-500 block font-semibold text-[11px] truncate">Products</span>
                <span className="font-black num text-base text-black">{b.footprint.items}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs min-w-0">
                <span className="text-slate-500 block font-semibold text-[11px] truncate">Invoices</span>
                <span className="font-black num text-base text-black">{b.footprint.invoices}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs min-w-0 col-span-2 sm:col-span-1">
                <span className="text-slate-500 block font-semibold text-[11px] truncate">Journals</span>
                <span className="font-black num text-base text-black">{b.footprint.journals}</span>
              </div>
            </div>
          </div>

          {/* Sub-Navigation Tabs inside Drawer */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('profile')}
              className={cn(
                'py-2 px-3 text-xs font-bold border-b-2 transition-all',
                activeTab === 'profile'
                  ? 'border-black text-black'
                  : 'border-transparent text-slate-500 hover:text-black'
              )}
            >
              Overview & Metadata
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={cn(
                'py-2 px-3 text-xs font-bold border-b-2 transition-all',
                activeTab === 'team'
                  ? 'border-black text-black'
                  : 'border-transparent text-slate-500 hover:text-black'
              )}
            >
              Staff Members ({b.users.length})
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={cn(
                'py-2 px-3 text-xs font-bold border-b-2 transition-all',
                activeTab === 'invoices'
                  ? 'border-black text-black'
                  : 'border-transparent text-slate-500 hover:text-black'
              )}
            >
              Billing ({b.invoices.length})
            </button>
          </div>

          {/* Drawer Tab 1: Profile & Metadata */}
          {activeTab === 'profile' && (
            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Industry Classification:</span>
                  <span className="font-bold text-black uppercase">{b.industry || 'General Trade'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">M-Pesa Shortcode:</span>
                  <span className="font-mono font-bold text-black">{b.mpesaShortcode || 'None'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Paid Until Date:</span>
                  <span className="font-bold text-black">{b.paidUntil ? dateTime(b.paidUntil) : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-600 font-medium">Trial End Date:</span>
                  <span className="font-bold text-black">{b.trialEndsAt ? dateTime(b.trialEndsAt) : 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Drawer Tab 2: Team Members */}
          {activeTab === 'team' && (
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden bg-white shadow-xs">
              {b.users.length === 0 ? (
                <div className="p-4 text-xs text-slate-600 font-medium text-center">No users registered.</div>
              ) : (
                b.users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 text-xs bg-white">
                    <div>
                      <div className="font-bold text-black">{u.name}</div>
                      <div className="text-slate-600 font-medium">{u.email} {u.phone ? `· ${u.phone}` : ''}</div>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-bold text-black">
                        {u.role}
                      </span>
                      <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        {u.lastSignInAt ? `Active ${dateTime(u.lastSignInAt)}` : 'Never signed in'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Drawer Tab 3: Recent Invoices */}
          {activeTab === 'invoices' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600">Total Billed:</span>
                <span className="font-black text-black num text-sm">{ksh(b.invoicedTotal)}</span>
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden text-xs bg-white shadow-xs">
                {b.invoices.length === 0 ? (
                  <div className="p-4 text-slate-600 font-medium text-center">No invoices created yet.</div>
                ) : (
                  <table className="w-full text-left bg-white">
                    <thead className="bg-white border-b border-slate-200 text-black font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Number</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {b.invoices.map((inv) => (
                        <tr key={inv.id} className="bg-white">
                          <td className="py-2.5 px-3 font-mono font-bold text-black">{inv.number}</td>
                          <td className="py-2.5 px-3 font-medium text-black">{inv.customerName}</td>
                          <td className="py-2.5 px-3 text-right font-black num text-black">{ksh(inv.total)}</td>
                          <td className="py-2.5 px-3">
                            <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold text-black">
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
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            {b.canWipe ? (
              <button
                className="btn btn-ghost text-xs border border-slate-300 bg-white text-black hover:bg-slate-100 font-bold"
                onClick={() => {
                  onClose();
                  onWipe(b as any);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-black" /> Purge Account Data
              </button>
            ) : (
              <span className="text-xs font-bold text-slate-500">Root Platform Tenant</span>
            )}

            <div className="flex gap-2">
              <button className="btn btn-secondary text-xs border border-slate-300 bg-white text-black hover:bg-slate-50 font-bold" onClick={onClose}>
                Close
              </button>
              <button
                className="btn btn-primary text-xs border border-black bg-black text-white hover:bg-slate-800 font-bold"
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
// Component: Traffic & Performance View (White Background, Black Text)
// -----------------------------------------------------------------------------
function TrafficView({ health, error }: { health?: Health | null; error?: string | null }) {
  const [metricMode, setMetricMode] = useState<'traffic' | 'latency'>('traffic');

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
    <div className="space-y-6 bg-white text-black">
      {/* Subsystem Health Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-bold text-black">
            {problems.length === 0
              ? 'All subsystems functioning normally'
              : `${problems.length} subsystem${problems.length === 1 ? '' : 's'} require verification`}
          </span>
        </div>
        <span className="text-xs font-semibold text-slate-600">
          Sampled {dateTime(health.checkedAt)} · .NET {health.server.dotnet}
        </span>
      </div>

      {/* Subsystem Checks Grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {health.checks.map((c) => (
          <div
            key={c.key}
            className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-black">{c.name}</span>
              <StatusBadge state={c.status === 'good' ? 'Resolved' : c.status === 'warn' ? 'InProgress' : 'Open'} />
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-600 leading-relaxed">{c.summary}</p>
          </div>
        ))}
      </div>

      {/* Interactive SVG Line Graph with Metric Mode Switcher */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-black text-sm">
              {metricMode === 'traffic'
                ? 'System Traffic: Requests per Minute'
                : 'API Latency Trend: Average Milliseconds'}
            </h3>
            <p className="text-xs font-medium text-slate-600">
              {count(health.traffic.requests)} requests recorded · P50: {health.traffic.p50}ms · P95: {health.traffic.p95}ms
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMetricMode('traffic')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                metricMode === 'traffic'
                  ? 'bg-black text-white'
                  : 'bg-white border border-slate-300 text-black hover:bg-slate-50'
              )}
            >
              Requests / Min
            </button>
            <button
              onClick={() => setMetricMode('latency')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                metricMode === 'latency'
                  ? 'bg-black text-white'
                  : 'bg-white border border-slate-300 text-black hover:bg-slate-50'
              )}
            >
              Latency (ms)
            </button>
          </div>
        </div>

        <SvgLineChart
          data={metricMode === 'traffic' ? trafficSeries : latencySeries}
          height={200}
          strokeColor="#000000"
          fmt={(v) => (metricMode === 'traffic' ? `${count(v)} requests` : `${v} ms`)}
        />
      </div>

      {/* Slowest and Error Endpoints */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-black text-black uppercase tracking-wider">
            Slowest API Endpoints
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs bg-white">
              <thead className="border-b border-slate-200 text-black font-bold">
                <tr>
                  <th className="py-2">Route</th>
                  <th className="py-2 text-right">Calls</th>
                  <th className="py-2 text-right">Avg ms</th>
                  <th className="py-2 text-right">Max ms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {health.traffic.slowest.map((r, i) => (
                  <tr key={i}>
                    <td className="py-2 font-mono font-bold text-black truncate max-w-[12rem]">
                      {r.route}
                    </td>
                    <td className="py-2 text-right num font-semibold">{r.requests}</td>
                    <td className="py-2 text-right num font-black text-black">{r.avgMs}</td>
                    <td className="py-2 text-right num text-slate-700">{r.maxMs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-black text-black uppercase tracking-wider">
            Server Error Log
          </p>
          {health.traffic.failing.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-xs font-bold text-black">
              Zero 5xx server exceptions recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs bg-white">
                <thead className="border-b border-slate-200 text-black font-bold">
                  <tr>
                    <th className="py-2">Endpoint</th>
                    <th className="py-2 text-right">Errors</th>
                    <th className="py-2 text-right">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {health.traffic.failing.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 font-mono font-bold text-black truncate max-w-[12rem]">
                        {r.route}
                      </td>
                      <td className="py-2 text-right font-black text-black num">{r.errors}</td>
                      <td className="py-2 text-right num font-semibold">{r.requests}</td>
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
// Component: Growth & Analytics View (White Background, Black Text)
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
  const [chartMode, setChartMode] = useState<'revenue' | 'signups'>('revenue');

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
    <div className="space-y-6 bg-white text-black">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-black text-sm">
            Financial Growth & Platform Invoiced Volume
          </h2>
          <p className="text-xs font-semibold text-slate-600">
            Real-time aggregate transaction analytics across all tenant workspaces
          </p>
        </div>
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

      {/* SVG Line Graph with Metric Toggle */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-black text-sm">
              {chartMode === 'revenue'
                ? 'Daily Invoiced Volume Across All Businesses (KES)'
                : 'New Business Registrations Trend'}
            </h3>
            <p className="text-xs font-semibold text-slate-600">
              {chartMode === 'revenue'
                ? `Total window invoice volume: ${ksh(analytics.volume.invoiceValue)}`
                : `${b.newInPeriod} new companies onboarded`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChartMode('revenue')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                chartMode === 'revenue'
                  ? 'bg-black text-white'
                  : 'bg-white border border-slate-300 text-black hover:bg-slate-50'
              )}
            >
              Invoiced Volume
            </button>
            <button
              onClick={() => setChartMode('signups')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                chartMode === 'signups'
                  ? 'bg-black text-white'
                  : 'bg-white border border-slate-300 text-black hover:bg-slate-50'
              )}
            >
              Signups
            </button>
          </div>
        </div>

        <SvgLineChart
          data={chartMode === 'revenue' ? invoiceSeries : signupSeries}
          height={200}
          strokeColor="#000000"
          fmt={(v) => (chartMode === 'revenue' ? ksh(v) : `${v} businesses`)}
        />
      </div>

      {/* Subscription Breakdown */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-black text-black uppercase tracking-wider">
          Paying Tenants by Subscription Tier
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs bg-white">
            <thead className="border-b border-slate-200 text-black font-bold">
              <tr>
                <th className="py-2.5">Tier Name</th>
                <th className="py-2.5 text-center">Active Tenants</th>
                <th className="py-2.5 text-right">Monthly Plan Price</th>
                <th className="py-2.5 text-right">MRR Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {b.byPlan.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 font-bold text-black">{p.name}</td>
                  <td className="py-3 text-center num font-bold">{p.businesses}</td>
                  <td className="py-3 text-right num font-semibold text-slate-700">{ksh(p.monthly)}</td>
                  <td className="py-3 text-right font-black num text-black">
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
// Component: Support & Team Issues Desk (White Background, Black Text)
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
    <div className="space-y-4 bg-white text-black">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-black">
            Cross-Tenant Customer & Team Inquiries
          </h2>
          <p className="text-xs font-semibold text-slate-600">
            Receive and respond directly to support requests raised by tenant teams across all companies.
          </p>
        </div>
        <button
          className="btn btn-ghost text-xs border border-slate-300 bg-white text-black hover:bg-slate-50 font-bold shadow-xs"
          onClick={onReload}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh Tickets
        </button>
      </div>

      {issues.length === 0 ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-12 text-center text-xs font-bold text-slate-600 shadow-sm">
          <MessageSquare className="mx-auto h-8 w-8 text-black mb-2" />
          No open support inquiries across tenants.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          {/* Issue Selector List */}
          <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden divide-y divide-slate-100 shadow-sm max-h-[600px] overflow-y-auto">
            {issues.map((i) => {
              const selected = activeIssue?.id === i.id;
              return (
                <div
                  key={i.id}
                  onClick={() => setSelectedIssueId(i.id)}
                  className={cn(
                    'p-3.5 cursor-pointer transition text-xs bg-white',
                    selected
                      ? 'border-l-4 border-l-black bg-slate-50'
                      : 'hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-black">{i.companyName}</span>
                    <StatusBadge state={i.status} />
                  </div>
                  <div className="font-semibold text-slate-800 mt-1 truncate">
                    {i.subject}
                  </div>
                  <div className="text-[11px] text-slate-600 font-semibold mt-1 flex justify-between">
                    <span>{i.name}</span>
                    <span>{dateTime(i.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Issue Conversation & Direct Reply Box */}
          {activeIssue && (
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-bold text-black text-sm">
                      #{activeIssue.number}: {activeIssue.subject}
                    </h3>
                    <p className="text-xs font-semibold text-slate-600">
                      Company: <strong>{activeIssue.companyName}</strong> · Contact: {activeIssue.name} ({activeIssue.email || activeIssue.phone})
                    </p>
                  </div>
                  <StatusBadge state={activeIssue.status} />
                </div>

                {/* Conversation History in White Cards */}
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {activeIssue.messages.map((m) => {
                    const isStaff = m.from === 'Staff' || m.from === 'Admin';
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'p-3.5 rounded-xl text-xs leading-relaxed max-w-[85%] border shadow-xs',
                          isStaff
                            ? 'ml-auto border-black bg-white text-black'
                            : 'border-slate-300 bg-white text-black'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-600 mb-1 border-b border-slate-100 pb-1">
                          <span>{m.author || (isStaff ? 'Platform Admin (Rooney Kabuor)' : 'Customer Team')}</span>
                          <span>{dateTime(m.at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap font-medium text-black">{m.body}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Direct Reply Composer */}
              <form onSubmit={handleSendReply} className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                {replyErr && <ErrorNote>{replyErr}</ErrorNote>}
                <textarea
                  className="field text-xs h-24 bg-white text-black border border-slate-300 font-semibold"
                  placeholder={`Reply directly to ${activeIssue.name} at ${activeIssue.companyName}... (Press Ctrl + Enter to send)`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.ctrlKey && e.key === 'Enter') {
                      e.preventDefault();
                      handleSendReply(e);
                    }
                  }}
                  disabled={sending}
                  required
                />
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-600 font-semibold">
                    Dispatched straight to the customer's portal and email notification ledger.
                  </span>
                  <button
                    type="submit"
                    className="btn btn-primary text-xs border border-black bg-black text-white hover:bg-slate-800 font-bold"
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
// Component: Dedicated Delete Account / Data Purge View (All White, Black Text)
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
    <div className="max-w-2xl space-y-6 bg-white text-black">
      <div>
        <h2 className="text-sm font-bold text-black">
          Permanent Tenant Deletion & KDPA / GDPR Compliance Purge
        </h2>
        <p className="text-xs font-semibold text-slate-700 mt-1 leading-relaxed">
          Executes Section 40 Kenya Data Protection Act 2019 and GDPR Article 17 "Right to Erasure". Cascades across
          all 60+ domain tables (financial journals, invoices, payroll, stock, customer records, and user logins).
        </p>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-slate-300 bg-white p-4 text-xs font-bold text-black shadow-sm">
          ✓ {successMsg}
        </div>
      )}

      {err && <ErrorNote>{err}</ErrorNote>}

      <form onSubmit={handleWipe} className="rounded-xl border border-slate-200/90 bg-white p-6 space-y-5 shadow-sm">
        <div>
          <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
            Select Company / Tenant Account to Purge
          </label>
          <select
            className="field text-xs bg-white text-black border border-slate-300 font-bold"
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
          <div className="rounded-xl border border-slate-300 bg-white p-3 text-xs font-bold text-black shadow-xs">
            🛡️ <strong>Kabuor Builds</strong> is the root platform tenant and cannot be wiped.
          </div>
        )}

        {targetBiz && canWipe && detail.data && (
          <div className="rounded-xl border border-slate-300 bg-white p-4 space-y-2 text-xs shadow-xs">
            <span className="font-bold text-black">
              Impact Analysis: Records Scheduled for Destruction
            </span>
            <div className="grid grid-cols-2 gap-2 text-slate-800 font-semibold sm:grid-cols-4 pt-1">
              <div>Users: <b className="num font-black text-black">{detail.data.footprint.users}</b></div>
              <div>Invoices: <b className="num font-black text-black">{detail.data.footprint.invoices}</b></div>
              <div>Customers: <b className="num font-black text-black">{detail.data.footprint.customers}</b></div>
              <div>Journals: <b className="num font-black text-black">{detail.data.footprint.journals}</b></div>
            </div>
          </div>
        )}

        {canWipe && (
          <>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-black uppercase tracking-wider">
                  Compliance & Audit Reason
                </label>
                <div className="flex gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setReason('Customer requested contract termination under KDPA 2019 Section 40')}
                    className="underline text-slate-600 hover:text-black font-semibold"
                  >
                    Template 1
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setReason('Right to Erasure GDPR Article 17 request by data controller')}
                    className="underline text-slate-600 hover:text-black font-semibold"
                  >
                    Template 2
                  </button>
                </div>
              </div>
              <textarea
                className="field text-xs h-20 bg-white text-black border border-slate-300 font-semibold"
                placeholder="e.g. Contract termination per customer request under Kenya Data Protection Act 2019 Section 40..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                Confirmation: Type <span className="font-mono text-black font-black underline">{targetBiz?.name}</span> to authorize:
              </label>
              <input
                className="field text-xs bg-white text-black border border-slate-300 font-bold"
                placeholder={targetBiz?.name}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="btn btn-primary text-xs w-full border border-black bg-black text-white hover:bg-slate-800 font-black"
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
// Modal: Plan & Access Controller (All White Background, Black Text)
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
      <form onSubmit={handleSubmit} className="space-y-4 text-xs bg-white text-black">
        {err && <ErrorNote>{err}</ErrorNote>}

        <div>
          <label className="block font-bold mb-1 text-black">Plan Tier</label>
          <select className="field text-xs bg-white text-black border border-slate-300 font-bold" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="starter">Starter — KSh 3,500/mo (up to 3 users)</option>
            <option value="growth">Growth — KSh 8,500/mo (up to 15 users, payroll, WhatsApp)</option>
            <option value="scale">Scale — KSh 18,500/mo (unlimited users, multi-branch, API)</option>
          </select>
        </div>

        <div>
          <label className="block font-bold mb-1 text-black">Extend Trial / Grace (Days)</label>
          <input
            type="number"
            className="field text-xs bg-white text-black border border-slate-300 font-bold"
            value={extendDays}
            onChange={(e) => setExtendDays(e.target.value)}
            min="0"
            max="365"
          />
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-black">
            <input
              type="checkbox"
              checked={lockTenant}
              onChange={(e) => setLockTenant(e.target.checked)}
              className="rounded border-slate-300 text-black"
            />
            <span>Lock Tenant Workspace (Prevent Editing)</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-300">
          <button type="button" className="btn btn-secondary text-xs border border-slate-300 bg-white text-black hover:bg-slate-50 font-bold" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary text-xs border border-black bg-black text-white hover:bg-slate-800 font-bold" disabled={saving}>
            {saving ? 'Saving...' : 'Apply Subscription'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
