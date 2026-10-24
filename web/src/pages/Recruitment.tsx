import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  Star,
  Video,
} from 'lucide-react';
import { api, useApi } from '../lib/api';
import { Chips, Empty, ErrorNote, Loading, PageHeader, SearchBox, Sheet, Status } from '../components/ui';
import { cn, dateTime } from '../lib/format';

interface JobApplication {
  id: string;
  refCode: string;
  fullName: string;
  email: string;
  phone: string;
  roleTitle: string;
  department: string;
  linkedIn: string;
  portfolio: string;
  experienceYears: string;
  coverNote: string;
  status: 'New' | 'Shortlisted' | 'InterviewScheduled' | 'OfferExtended' | 'Rejected';
  vettingNotes: string;
  rating: number;
  interviewType?: 'GoogleMeet' | 'Phone' | 'InPerson';
  interviewScheduledAt?: string;
  meetUrl?: string;
  interviewNotes?: string;
  interviewer?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApplicationsResponse {
  counts: {
    all: number;
    newCount: number;
    shortlisted: number;
    scheduled: number;
    offered: number;
    rejected: number;
  };
  items: JobApplication[];
}

export default function Recruitment() {
  const [params, setParams] = useSearchParams();
  const statusParam = params.get('status') ?? 'All';
  const roleParam = params.get('dept') ?? 'All';
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);

  const queryUrl = `/recruitment/applications?status=${encodeURIComponent(statusParam)}&department=${encodeURIComponent(roleParam)}&q=${encodeURIComponent(search)}`;
  const { data, error, reload } = useApi<ApplicationsResponse>(queryUrl);

  // If URL has ?id=..., open that application directly
  useEffect(() => {
    const id = params.get('id');
    if (id && data?.items) {
      const found = data.items.find((x) => x.id === id || x.refCode.toLowerCase() === id.toLowerCase());
      if (found) setSelectedApp(found);
    }
  }, [params, data]);

  const statusOptions: ['All' | 'New' | 'Shortlisted' | 'InterviewScheduled' | 'OfferExtended' | 'Rejected', string, number?][] = [
    ['All', 'All Candidates', data?.counts.all],
    ['New', 'To Vet', data?.counts.newCount],
    ['Shortlisted', 'Shortlisted', data?.counts.shortlisted],
    ['InterviewScheduled', 'Interviews Scheduled', data?.counts.scheduled],
    ['OfferExtended', 'Offers Extended', data?.counts.offered],
    ['Rejected', 'Rejected', data?.counts.rejected],
  ];

  return (
    <div>
      <PageHeader
        title="Recruitment & Talent Vetting"
        subtitle="Review candidate applications from the careers page, vet credentials, and schedule Google Meet interviews."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/careers" target="_blank" className="btn btn-ghost text-xs">
              View Public Careers Page <ExternalLink className="h-3.5 w-3.5 ml-1" />
            </Link>
          </div>
        }
      />

      {/* Metric Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total In Pipeline</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink">{data?.counts.all ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Awaiting Vetting</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand">{data?.counts.newCount ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Shortlisted</p>
          <p className="mt-1 font-display text-2xl font-bold text-indigo">{data?.counts.shortlisted ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Interviews Set</p>
          <p className="mt-1 font-display text-2xl font-bold text-good">{data?.counts.scheduled ?? 0}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Chips
            label="Filter by Status"
            value={statusParam}
            onChange={(v) => {
              params.set('status', v);
              setParams(params);
            }}
            options={statusOptions}
          />

          <SearchBox
            placeholder="Search candidate name, role, email, phone..."
            value={search}
            onChange={(v) => setSearch(v)}
          />
        </div>
      </div>

      {/* Candidate List */}
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty title="No applications match this filter">
          {search ? 'Try clearing your search query.' : 'New applications submitted through the Careers page will appear here.'}
        </Empty>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {data.items.map((app) => (
            <div
              key={app.id}
              onClick={() => setSelectedApp(app)}
              className="p-4 sm:p-5 hover:bg-paper cursor-pointer transition flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-bold text-base text-ink">{app.fullName}</span>
                  <span className="rounded bg-paper px-2 py-0.5 text-xs text-muted font-mono ring-1 ring-line">
                    {app.refCode}
                  </span>
                  <StatusTone status={app.status} />
                  {app.rating > 0 && (
                    <span className="flex items-center text-xs font-semibold text-gold">
                      <Star className="h-3.5 w-3.5 fill-gold mr-0.5" /> {app.rating}/5
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <span className="font-semibold text-ink-2">{app.roleTitle}</span>
                  <span>·</span>
                  <span>{app.department}</span>
                  <span>·</span>
                  <span>{app.experienceYears}</span>
                  <span>·</span>
                  <span>Applied {dateTime(app.createdAt)}</span>
                </div>

                <p className="mt-2 text-xs text-muted line-clamp-1 italic">
                  "{app.coverNote}"
                </p>

                {app.status === 'InterviewScheduled' && app.interviewScheduledAt && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-good-soft px-2.5 py-1 text-xs font-semibold text-good">
                    <Video className="h-3.5 w-3.5" />
                    <span>Interview: {dateTime(app.interviewScheduledAt)}</span>
                    {app.interviewer && <span className="text-good/80 font-normal">({app.interviewer})</span>}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-line">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedApp(app);
                  }}
                  className="btn btn-primary py-1.5 px-3.5 text-xs"
                >
                  Vet & Schedule
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vetting & Interview Scheduling Drawer */}
      {selectedApp && (
        <VettingDrawer
          application={selectedApp}
          onClose={() => {
            setSelectedApp(null);
            params.delete('id');
            setParams(params);
          }}
          onUpdated={() => {
            reload();
          }}
        />
      )}
    </div>
  );
}

function StatusTone({ status }: { status: JobApplication['status'] }) {
  switch (status) {
    case 'New':
      return <Status tone="info">New Candidate</Status>;
    case 'Shortlisted':
      return <Status tone="plain">Shortlisted</Status>;
    case 'InterviewScheduled':
      return <Status tone="good">Interview Scheduled</Status>;
    case 'OfferExtended':
      return <Status tone="good">Offer Extended</Status>;
    case 'Rejected':
      return <Status tone="bad">Not Selected</Status>;
    default:
      return <Status tone="plain">{status}</Status>;
  }
}

function VettingDrawer({
  application: initialApp,
  onClose,
  onUpdated,
}: {
  application: JobApplication;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [app, setApp] = useState<JobApplication>(initialApp);
  const [status, setStatus] = useState(initialApp.status);
  const [notes, setNotes] = useState(initialApp.vettingNotes || '');
  const [rating, setRating] = useState(initialApp.rating || 0);
  const [savingStatus, setSavingStatus] = useState(false);

  // Interview Schedule Form
  const [interviewType, setInterviewType] = useState<'GoogleMeet' | 'Phone' | 'InPerson'>(
    initialApp.interviewType || 'GoogleMeet',
  );
  const [scheduledAt, setScheduledAt] = useState(
    initialApp.interviewScheduledAt ? initialApp.interviewScheduledAt.slice(0, 16) : '',
  );
  const [meetUrl, setMeetUrl] = useState(
    initialApp.meetUrl || `https://meet.google.com/kbr-${initialApp.refCode.toLowerCase().replace('kbr-app-', '')}`,
  );
  const [interviewNotes, setInterviewNotes] = useState(initialApp.interviewNotes || '');
  const [interviewer, setInterviewer] = useState(initialApp.interviewer || 'Founder & CEO');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  const saveVetting = async () => {
    setSavingStatus(true);
    try {
      const res = await api<JobApplication>(`/recruitment/applications/${app.id}/status`, {
        body: { status, vettingNotes: notes, rating },
      });
      setApp(res);
      onUpdated();
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) return;
    setScheduling(true);
    try {
      const res = await api<JobApplication>(`/recruitment/applications/${app.id}/schedule`, {
        body: {
          interviewType,
          scheduledAt: new Date(scheduledAt).toISOString(),
          meetUrl,
          notes: interviewNotes,
          interviewer,
        },
      });
      setApp(res);
      setStatus('InterviewScheduled');
      setScheduleSuccess(true);
      onUpdated();
      setTimeout(() => setScheduleSuccess(false), 5000);
    } finally {
      setScheduling(false);
    }
  };

  const cleanPhone = app.phone.replace(/[^0-9]/g, '');
  const kenyaMsisdn = cleanPhone.startsWith('0') ? '254' + cleanPhone.slice(1) : cleanPhone;
  const whatsappUrl = `https://wa.me/${kenyaMsisdn}?text=${encodeURIComponent(
    `Hello ${app.fullName}, this is Kabuor ERP hiring committee regarding your application for ${app.roleTitle}.`,
  )}`;

  // Google Calendar Link Generator
  const gCalUrl = scheduledAt
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        `Kabuor ERP Interview: ${app.fullName} (${app.roleTitle})`,
      )}&dates=${new Date(scheduledAt).toISOString().replace(/-|:|\.\d\d\d/g, '')}/${new Date(
        new Date(scheduledAt).getTime() + 45 * 60000,
      )
        .toISOString()
        .replace(/-|:|\.\d\d\d/g, '')}&details=${encodeURIComponent(
        `Candidate: ${app.fullName}\nRole: ${app.roleTitle}\nMeet Link: ${meetUrl}\nPhone: ${app.phone}\nLinkedIn: ${app.linkedIn}\nNotes: ${interviewNotes}`,
      )}&location=${encodeURIComponent(meetUrl)}`
    : '';

  const emailInviteUrl = `mailto:${app.email}?subject=${encodeURIComponent(
    `Invitation for Interview: ${app.roleTitle} at Kabuor ERP`,
  )}&body=${encodeURIComponent(
    `Dear ${app.fullName},\n\nThank you for applying for the ${app.roleTitle} position at Kabuor ERP.\n\nWe were impressed by your background and would like to invite you for an interview on ${new Date(
      scheduledAt || Date.now(),
    ).toLocaleString()} via Google Meet.\n\nGoogle Meet Link: ${meetUrl}\n\nPlease confirm if this time works for you.\n\nBest regards,\n${interviewer}\nKabuor ERP Talent Team`,
  )}`;

  return (
    <Sheet title={`Candidate Dossier: ${app.fullName}`} open={true} onClose={onClose}>
      <div className="space-y-6 pb-12">
        {/* Header Summary */}
        <div className="card p-4 bg-paper/60 border-line">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="rounded bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                {app.department}
              </span>
              <h3 className="mt-1 font-display text-xl font-bold text-ink">{app.roleTitle}</h3>
              <p className="text-xs text-muted">Reference: <b className="font-mono text-ink">{app.refCode}</b> · Applied {dateTime(app.createdAt)}</p>
            </div>
            <StatusTone status={app.status} />
          </div>

          {/* Quick Contact Bar */}
          <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-3 text-xs">
            <a
              href={`mailto:${app.email}`}
              className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
            >
              <Mail className="h-3.5 w-3.5" /> {app.email}
            </a>
            <span className="text-faint">·</span>
            <a
              href={`tel:${app.phone}`}
              className="inline-flex items-center gap-1.5 font-medium text-ink-2 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" /> {app.phone}
            </a>
            <span className="text-faint">·</span>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-mpesa hover:underline"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Candidate
            </a>
            <span className="text-faint">·</span>
            <a
              href={app.linkedIn}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> LinkedIn Profile
            </a>
            {app.portfolio && (
              <>
                <span className="text-faint">·</span>
                <a
                  href={app.portfolio}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-indigo hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Portfolio/GitHub
                </a>
              </>
            )}
          </div>
        </div>

        {/* Experience & Cover Pitch */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Candidate Background & Pitch</h4>
            <span className="text-xs font-semibold text-ink-2">Experience: {app.experienceYears}</span>
          </div>
          <div className="card p-4 text-sm text-ink-2 leading-relaxed bg-white border-line">
            <p className="whitespace-pre-line">{app.coverNote}</p>
          </div>
        </div>

        {/* Vetting Assessment & Scorecard */}
        <div className="card p-5 border-line space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink">Vetting Assessment & Rating</h4>
            {/* 5-Star Rating Selector */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition"
                  aria-label={`Rate ${star} stars`}
                >
                  <Star
                    className={cn(
                      'h-5 w-5',
                      star <= rating ? 'fill-gold text-gold' : 'text-line hover:text-gold/50',
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Candidate Pipeline Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="field text-sm font-semibold"
              >
                <option value="New">New (Awaiting Review)</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="InterviewScheduled">Interview Scheduled</option>
                <option value="OfferExtended">Offer Extended</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Internal Reviewer</label>
              <input
                type="text"
                value={interviewer}
                onChange={(e) => setInterviewer(e.target.value)}
                placeholder="e.g. Founder / Technical Director"
                className="field text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Private Vetting Notes & Feedback</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record technical observations, salary expectations discussed, reference checks..."
              className="field text-sm"
            />
          </div>

          <button
            type="button"
            onClick={saveVetting}
            disabled={savingStatus}
            className="btn btn-primary py-2 px-4 text-xs"
          >
            {savingStatus ? 'Saving...' : 'Save Vetting Notes'}
          </button>
        </div>

        {/* Schedule Meet Interview Section */}
        <div className="card p-5 border-brand/40 bg-brand-soft/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-brand" />
              <h4 className="font-display text-sm font-bold text-ink uppercase tracking-wider">
                Schedule Meet Interview
              </h4>
            </div>
            {app.status === 'InterviewScheduled' && (
              <span className="rounded bg-good-soft px-2 py-0.5 text-xs font-bold text-good">
                Scheduled
              </span>
            )}
          </div>

          {scheduleSuccess && (
            <div className="rounded-lg bg-good-soft p-3 text-xs font-semibold text-good flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Interview successfully scheduled! Candidate status set to Interview Scheduled.</span>
            </div>
          )}

          <form onSubmit={handleSchedule} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Meeting Format</label>
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value as any)}
                  className="field text-sm"
                >
                  <option value="GoogleMeet">Google Meet (Video Call)</option>
                  <option value="Phone">Phone Screen</option>
                  <option value="InPerson">In-Person (Nairobi Kilimani HQ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Interview Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="field text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Google Meet Link / Meeting URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  value={meetUrl}
                  onChange={(e) => setMeetUrl(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="field text-sm flex-1 font-mono"
                />
                <a
                  href={meetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost py-2 px-3 text-xs shrink-0"
                >
                  Open Meet <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Interview Agenda / Focus Areas</label>
              <input
                type="text"
                value={interviewNotes}
                onChange={(e) => setInterviewNotes(e.target.value)}
                placeholder="e.g. System architecture deep dive, eTIMS cryptography test, culture alignment"
                className="field text-sm"
              />
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={scheduling}
                className="btn btn-primary py-2.5 px-5 text-xs shadow-sm"
              >
                {scheduling ? 'Scheduling...' : 'Confirm & Schedule Interview'}
              </button>

              {scheduledAt && (
                <>
                  <a
                    href={gCalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost text-xs py-2 px-3"
                  >
                    <Calendar className="h-3.5 w-3.5 mr-1 text-brand" /> Add to Google Calendar
                  </a>

                  <a
                    href={emailInviteUrl}
                    className="btn btn-ghost text-xs py-2 px-3"
                  >
                    <Mail className="h-3.5 w-3.5 mr-1 text-indigo" /> Email Candidate Invite
                  </a>

                  <a
                    href={`https://wa.me/${kenyaMsisdn}?text=${encodeURIComponent(
                      `Hello ${app.fullName}, we have scheduled your Kabuor ERP interview for ${new Date(
                        scheduledAt,
                      ).toLocaleString()}. Google Meet: ${meetUrl}`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-mpesa text-xs py-2 px-3"
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp Invite
                  </a>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </Sheet>
  );
}
