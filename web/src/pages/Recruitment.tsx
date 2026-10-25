// Recruitment & Talent Desk: Manage open and closed job positions, review candidate portfolios and intensive questions.
import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { Chips, Empty, PageHeader, SearchBox, Status } from '../components/ui';

export type JobOpening = {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  status: 'open' | 'closed';
  compensationNote: string;
  equity: string;
  tags: string[];
  summary: string;
};

const DEFAULT_JOBS: JobOpening[] = [
  {
    id: 'chief-of-staff',
    title: 'Chief of Staff / Head of Strategic Operations',
    department: 'Leadership',
    location: 'Ngong Road, Nairobi · Fully Remote',
    type: 'Full-Time',
    status: 'open',
    compensationNote: 'Pre-Funding: Founding Equity (Salaried Upon Funding)',
    equity: 'Generous Founding ESOP Equity Grant',
    tags: ['Executive', 'Operations', 'Strategy'],
    summary: 'Partner directly with the Founder & CEO to drive operational velocity, OKRs, and market expansion.',
  },
  {
    id: 'vp-engineering',
    title: 'VP of Engineering & Core Architecture',
    department: 'Leadership',
    location: 'Ngong Road, Nairobi · Fully Remote',
    type: 'Full-Time',
    status: 'open',
    compensationNote: 'Pre-Funding: Founding Equity (Salaried Upon Funding)',
    equity: 'Significant Executive ESOP Stake',
    tags: ['C# .NET 10', 'Distributed Systems', 'Architecture'],
    summary: 'Lead our engineering pods, maintain 99.99% availability for 500k+ daily transactions.',
  },
  {
    id: 'lead-platform-architect',
    title: 'Lead Platform Architect (.NET 10 / Cloud)',
    department: 'Engineering',
    location: 'Ngong Road, Nairobi · Fully Remote',
    type: 'Full-Time',
    status: 'open',
    compensationNote: 'Pre-Funding: Founding Equity (Salaried Upon Funding)',
    equity: '0.50% – 1.00% ESOP',
    tags: ['.NET 10', 'C#', 'SequenceGate', 'PostgreSQL'],
    summary: 'Scale our SequenceGate concurrency engine and real-time M-Pesa ledger pipelines.',
  },
  {
    id: 'senior-edge-frontend-engineer',
    title: 'Senior Edge & Frontend Systems Engineer (React 19 / Offline PWA)',
    department: 'Engineering',
    location: 'Ngong Road, Nairobi · Fully Remote',
    type: 'Full-Time',
    status: 'open',
    compensationNote: 'Pre-Funding: Founding Equity (Salaried Upon Funding)',
    equity: '0.35% – 0.75% ESOP',
    tags: ['React 19', 'TypeScript', 'Offline PWA', 'IndexedDB'],
    summary: 'Build the indestructible client runtime that keeps stores running during network blackouts.',
  },
  {
    id: 'head-of-tax-compliance-etims',
    title: 'Head of Tax Compliance & eTIMS Architecture',
    department: 'Engineering',
    location: 'Ngong Road, Nairobi · Fully Remote',
    type: 'Full-Time',
    status: 'open',
    compensationNote: 'Pre-Funding: Founding Equity (Salaried Upon Funding)',
    equity: '0.40% – 0.80% ESOP',
    tags: ['KRA eTIMS', 'VSCU/OSCU', 'Cryptography'],
    summary: 'Direct technical integration with KRA eTIMS VSCU/OSCU REST endpoints and cryptographic signing.',
  },
  {
    id: 'head-of-growth-marketing',
    title: 'Head of Growth & Performance Marketing',
    department: 'Marketing & Growth',
    location: 'Ngong Road, Nairobi · Fully Remote',
    type: 'Full-Time',
    status: 'open',
    compensationNote: 'Pre-Funding: Founding Equity (Salaried Upon Funding)',
    equity: 'Meaningful Founding ESOP Stake',
    tags: ['Performance Marketing', 'SEO/SEM', 'CAC/LTV'],
    summary: 'Scale profitable acquisition targeting 5,000+ paying businesses across Kenya.',
  },
  {
    id: 'field-trade-corridor-marketing-lead',
    title: 'Trade Corridor & Field Marketing Lead',
    department: 'Marketing & Growth',
    location: 'Nairobi (Trade Corridors / Field)',
    type: 'Full-Time',
    status: 'open',
    compensationNote: 'Pre-Funding: Founding Equity (Salaried Upon Funding)',
    equity: 'Meaningful Founding ESOP Stake',
    tags: ['Field Activation', 'Gikomba', 'Eastleigh'],
    summary: 'Ground activations in Gikomba, Eastleigh, and Industrial Area driving wholesale merchant adoption.',
  },
  {
    id: 'content-and-brand-lead',
    title: 'Content, Social & Brand Marketing Lead',
    department: 'Marketing & Growth',
    location: 'Ngong Road, Nairobi · Fully Remote',
    type: 'Full-Time',
    status: 'open',
    compensationNote: 'Pre-Funding: Founding Equity (Salaried Upon Funding)',
    equity: 'Meaningful Founding ESOP Stake',
    tags: ['Video Storytelling', 'Case Studies', 'TikTok/YouTube'],
    summary: 'Documentary-style SME case studies, founder thought leadership, and commerce education.',
  },
  {
    id: 'strategic-partner-accountant-lead',
    title: 'Strategic Partner & Accountant Affiliate Lead',
    department: 'Marketing & Growth',
    location: 'Ngong Road, Nairobi · Fully Remote',
    type: 'Full-Time',
    status: 'open',
    compensationNote: 'Pre-Funding: Founding Equity (Salaried Upon Funding)',
    equity: 'Meaningful Founding ESOP Stake',
    tags: ['ICPAK Network', 'Accountants', 'Audit Firms'],
    summary: 'Build our nationwide partner network of CPAs and audit consultancies managing clients on Kabuor.',
  },
  {
    id: 'head-of-enterprise-sales',
    title: 'Head of Direct Enterprise Sales',
    department: 'Sales & Commercial',
    location: 'Ngong Road, Nairobi · Fully Remote',
    type: 'Full-Time',
    status: 'open',
    compensationNote: 'Pre-Funding: Founding Equity (Salaried Upon Funding)',
    equity: 'Meaningful Founding ESOP Stake',
    tags: ['Enterprise Sales', 'Wholesalers', 'Distributors'],
    summary: 'Drive enterprise contracts with mid-market distributors and multi-branch retail chains.',
  },
  {
    id: 'head-of-merchant-success',
    title: 'Head of Merchant Success & Enterprise Onboarding',
    department: 'Operations & Success',
    location: 'Ngong Road, Nairobi · Fully Remote',
    type: 'Full-Time',
    status: 'open',
    compensationNote: 'Pre-Funding: Founding Equity (Salaried Upon Funding)',
    equity: '0.25% – 0.50% ESOP',
    tags: ['Customer Success', 'Data Migration', 'Zero Churn'],
    summary: 'Lead white-glove onboarding and historical data migration for supermarkets and distributors.',
  },
  {
    id: 'finance-director-controller',
    title: 'Finance Director / Controller (CPA-K)',
    department: 'Finance, Legal & People',
    location: 'Ngong Road, Nairobi · Fully Remote',
    type: 'Full-Time',
    status: 'open',
    compensationNote: 'Pre-Funding: Founding Equity (Salaried Upon Funding)',
    equity: 'Meaningful Executive ESOP Stake',
    tags: ['CPA-K', 'Compliance', 'Audit', 'Treasury'],
    summary: 'Own statutory compliance, balance sheet reconciliations, and tax planning with KRA.',
  },
  {
    id: 'young-builders-fellowship',
    title: 'Young African Builder Fellow (Engineering, Product & Design)',
    department: 'Young Builders & Volunteers',
    location: 'Ngong Road, Nairobi · Fully Remote',
    type: 'Fellowship / Early-Career',
    status: 'open',
    compensationNote: 'Pre-Funding: Volunteer / Fellow Track (Salaried post-funding)',
    equity: 'Fellowship Completion Grant & Full-Time Priority',
    tags: ['Young Builders', 'Students', 'Self-Taught', 'React', 'C#'],
    summary: 'Hands-on fellowship for hungry young African coders working on real production code.',
  },
  {
    id: 'open-source-volunteer-contributor',
    title: 'Open-Source & African Software Volunteer Contributor',
    department: 'Young Builders & Volunteers',
    location: 'Pan-Africa & Global · 100% Remote',
    type: 'Volunteer / Contributor',
    status: 'open',
    compensationNote: 'Volunteer Track (Flexible Hours & Contributor Equity)',
    equity: 'Public Contributor Attribution & Swag',
    tags: ['Open Source', 'Localization', 'APIs', 'Volunteer'],
    summary: 'Build open-source tools, developer documentation, and merchant helper libraries.',
  },
  {
    id: 'campus-builder-lead',
    title: 'Campus & Student Tech Community Lead',
    department: 'Young Builders & Volunteers',
    location: 'Kenyan Universities · Remote & Campus',
    type: 'Volunteer / Community',
    status: 'open',
    compensationNote: 'Volunteer Community Track · Event Support',
    equity: 'Builder Certificate & Priority Hiring',
    tags: ['Campus', 'Youth Community', 'Hackathons'],
    summary: 'Organize tech demo days and hackathons around eTIMS, M-Pesa APIs, and offline web tech.',
  },
];

const ROLES_KEY = 'kb_careers_roles_v2';
const APPS_KEY = 'kb_careers_applications_v2';

export default function Recruitment() {
  const [tab, setTab] = useState<'jobs' | 'candidates'>('jobs');
  const [jobs, setJobs] = useState<JobOpening[]>(() => {
    try {
      const raw = localStorage.getItem(ROLES_KEY);
      if (!raw) return DEFAULT_JOBS;
      const parsed = JSON.parse(raw);
      return DEFAULT_JOBS.map((d) => {
        const saved = parsed.find((p: any) => p.id === d.id);
        return saved ? { ...d, status: saved.status || 'open' } : d;
      });
    } catch {
      return DEFAULT_JOBS;
    }
  });

  const [candidates, setCandidates] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem(APPS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);

  // Sync with localStorage
  useEffect(() => {
    const handleRoles = () => {
      try {
        const raw = localStorage.getItem(ROLES_KEY);
        if (raw) setJobs(JSON.parse(raw));
      } catch {}
    };
    const handleApps = () => {
      try {
        const raw = localStorage.getItem(APPS_KEY);
        if (raw) setCandidates(JSON.parse(raw));
      } catch {}
    };

    window.addEventListener('kb-roles-changed', handleRoles);
    window.addEventListener('kb-apps-changed', handleApps);
    return () => {
      window.removeEventListener('kb-roles-changed', handleRoles);
      window.removeEventListener('kb-apps-changed', handleApps);
    };
  }, []);

  const toggleJobStatus = (id: string) => {
    const updated: JobOpening[] = jobs.map((j) => (j.id === id ? { ...j, status: (j.status === 'open' ? 'closed' : 'open') as 'open' | 'closed' } : j));
    setJobs(updated);
    try {
      localStorage.setItem(ROLES_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('kb-roles-changed', { detail: updated }));
    } catch {}
  };

  const updateCandidateStatus = (ref: string, reviewStatus: string) => {
    const updated = candidates.map((c) => (c.trackingRef === ref ? { ...c, reviewStatus } : c));
    setCandidates(updated);
    try {
      localStorage.setItem(APPS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('kb-apps-changed', { detail: updated }));
    } catch {}
  };

  const openCount = jobs.filter((j) => j.status === 'open').length;
  const closedCount = jobs.filter((j) => j.status === 'closed').length;

  const filteredJobs = jobs.filter((j) => {
    const matchesFilter = filter === 'all' || (filter === 'open' && j.status === 'open') || (filter === 'closed' && j.status === 'closed');
    const query = q.toLowerCase().trim();
    const matchesQuery = !query || j.title.toLowerCase().includes(query) || j.department.toLowerCase().includes(query);
    return matchesFilter && matchesQuery;
  });

  const filteredCandidates = candidates.filter((c) => {
    const query = q.toLowerCase().trim();
    return !query || c.fullName?.toLowerCase().includes(query) || c.roleTitle?.toLowerCase().includes(query) || c.trackingRef?.toLowerCase().includes(query);
  });

  const formatWa = (phone: string) => {
    const clean = String(phone).replace(/\D/g, '').replace(/^(254|0)/, '');
    return `https://wa.me/254${clean}`;
  };

  return (
    <div>
      <PageHeader
        title="Recruitment & Job Openings"
        subtitle="Manage public career openings, toggle role statuses from open to closed, and review applicant portfolios."
        actions={
          <div className="flex items-center gap-2">
            <Chips
              label="Sections"
              value={tab}
              onChange={(v) => setTab(v as 'jobs' | 'candidates')}
              options={[
                ['jobs', 'Job Openings', jobs.length],
                ['candidates', 'Candidate Submissions', candidates.length],
              ]}
            />
          </div>
        }
      />

      {/* Top Filter and Search Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {tab === 'jobs' && (
          <Chips
            label="Filter by status"
            value={filter}
            onChange={(v) => setFilter(v as 'all' | 'open' | 'closed')}
            options={[
              ['all', 'All Roles', jobs.length],
              ['open', 'Open', openCount],
              ['closed', 'Closed', closedCount],
            ]}
          />
        )}
        <div className="w-full sm:max-w-xs">
          <SearchBox value={q} onChange={setQ} placeholder={tab === 'jobs' ? 'Filter positions...' : 'Search applicants...'} />
        </div>
      </div>

      {tab === 'jobs' && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper/60 text-xs font-semibold text-muted uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Position Title</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Status Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredJobs.map((job) => {
                const isOpen = job.status === 'open';
                return (
                  <tr key={job.id} className="hover:bg-paper/40 transition">
                    <td className="py-3.5 px-4">
                      <b className="font-semibold text-ink block">{job.title}</b>
                      <span className="text-xs text-muted">{job.location}</span>
                    </td>
                    <td className="py-3.5 px-4 text-ink-2">
                      <span className="rounded bg-paper px-2 py-0.5 text-xs font-medium ring-1 ring-line">
                        {job.department}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-muted text-xs">{job.type}</td>
                    <td className="py-3.5 px-4">
                      {isOpen ? (
                        <Status tone="good">Open</Status>
                      ) : (
                        <Status tone="bad">Closed</Status>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isOpen ? (
                        <button
                          type="button"
                          onClick={() => toggleJobStatus(job.id)}
                          className="btn btn-outline text-bad border-bad/30 hover:bg-bad/10 text-xs py-1.5 px-3 font-semibold"
                        >
                          Mark as Closed
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleJobStatus(job.id)}
                          className="btn btn-outline text-good border-good/30 hover:bg-good/10 text-xs py-1.5 px-3 font-semibold"
                        >
                          Re-open Job
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredJobs.length && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted">
                    No positions match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'candidates' && (
        <div className="space-y-3">
          {filteredCandidates.map((c) => {
            const isExpanded = expandedCandidate === c.trackingRef;
            return (
              <div key={c.trackingRef} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <b className="text-base font-bold text-ink">{c.fullName}</b>
                      <span className="rounded bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                        {c.roleTitle}
                      </span>
                      <code className="text-xs text-muted font-mono">{c.trackingRef}</code>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span>{c.email}</span>
                      <span>·</span>
                      <span>{c.phone}</span>
                      <span>·</span>
                      <span>{c.location || 'Kenya'}</span>
                      <span>·</span>
                      <span>Level: <b>{c.experienceTrack}</b></span>
                      <span>·</span>
                      <span>Submitted: {new Date(c.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={c.reviewStatus || 'New'}
                      onChange={(e) => updateCandidateStatus(c.trackingRef, e.target.value)}
                      className="field py-1 text-xs font-semibold"
                    >
                      <option value="New">Status: New</option>
                      <option value="Shortlisted">Status: Shortlisted</option>
                      <option value="Interviewing">Status: Interviewing</option>
                      <option value="Rejected">Status: Rejected</option>
                    </select>

                    {c.phone && (
                      <a
                        href={formatWa(c.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline text-good py-1.5 px-2.5"
                        title="Chat on WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}

                    {c.email && (
                      <a
                        href={`mailto:${c.email}?subject=Kabuor%20Technologies%20Application%20-%20${encodeURIComponent(c.roleTitle)}`}
                        className="btn btn-outline py-1.5 px-2.5"
                        title="Send Email"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedCandidate(isExpanded ? null : c.trackingRef)}
                      className="btn btn-outline text-xs py-1.5 px-3 flex items-center gap-1"
                    >
                      {isExpanded ? (
                        <>Hide Details <ChevronUp className="h-3.5 w-3.5" /></>
                      ) : (
                        <>View Full Answers <ChevronDown className="h-3.5 w-3.5" /></>
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-line pt-4 space-y-3 text-xs">
                    <div className="rounded-lg bg-paper p-3 border border-line">
                      <p className="font-bold text-ink mb-1.5">Portfolio & Live Links</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {c.githubUrl && (
                          <a href={c.githubUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline flex items-center gap-1">
                            <span>GitHub: {c.githubUrl}</span> <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {c.liveProjectUrl1 && (
                          <a href={c.liveProjectUrl1} target="_blank" rel="noreferrer" className="text-brand hover:underline flex items-center gap-1">
                            <span>Live Project: {c.liveProjectUrl1}</span> <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {c.cleanestCodeUrl && (
                          <a href={c.cleanestCodeUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline flex items-center gap-1">
                            <span>Cleanest PR: {c.cleanestCodeUrl}</span> <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg bg-paper p-3 border border-line">
                      <p className="font-bold text-ink">1. Hardest Engineering Problem Solved:</p>
                      <p className="mt-1 text-ink-2 whitespace-pre-wrap leading-relaxed">{c.hardestProblem || '—'}</p>
                    </div>

                    <div className="rounded-lg bg-paper p-3 border border-line">
                      <p className="font-bold text-ink">2. Why Kabuor & African Commerce:</p>
                      <p className="mt-1 text-ink-2 whitespace-pre-wrap leading-relaxed">{c.whyAfricaKabuor || '—'}</p>
                    </div>

                    <div className="rounded-lg bg-paper p-3 border border-line">
                      <p className="font-bold text-ink">3. Offline Resilience & Fault Tolerance:</p>
                      <p className="mt-1 text-ink-2 whitespace-pre-wrap leading-relaxed">{c.offlineArchitecture || '—'}</p>
                    </div>

                    <div className="flex gap-4 text-muted text-[11px]">
                      <span>Weekly Availability: <b>{c.weeklyCommitment || 'Full focus'}</b></span>
                      <span>Earliest Start Date: <b>{c.earliestStartDate || 'Immediate'}</b></span>
                      <span>Pre-funding Equity Agreement: <b>Confirmed</b></span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!filteredCandidates.length && (
            <Empty title="No applications yet">When builders and volunteers apply on the public careers page, their submissions and portfolios will appear here.</Empty>
          )}
        </div>
      )}
    </div>
  );
}
