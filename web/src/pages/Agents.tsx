// Agents: what they want you to check, and which ones are working. On each task the reviewer is deciding
// "should this happen?", so the card says who is asking, what they found, exactly what approving does, lets you
// change the wording first, and keeps the timeline one tap away. The setup cards say plainly what each agent
// does by itself and what it always asks about first.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Bot, Check, ChevronDown, ExternalLink, Hand, Loader2, Play, Sparkles } from 'lucide-react';
import { api, can, useApi, useSession } from '../lib/api';
import { cn, dateTime } from '../lib/format';
import { Chips, Empty, ErrorNote, Loading, PageHeader, Status } from '../components/ui';

type Step = { at: string; who: string; text: string };
type Task = {
  id: string; agentKey: string; agent: string; title: string; detail: string; action: string; status: string; result: string; link: string;
  createdAt: string; decidedAt: string | null; decidedBy: string; draft: string | null; steps: Step[];
};
type Agent = {
  key: string; name: string; job: string; onItsOwn: string[]; asksFirst: string[]; every: string; enabled: boolean; enabledBy: string | null;
  lastRunAt: string | null; lastRunSummary: string | null; settings: Record<string, any>; toReview: number; canManage: boolean; canRun: boolean;
};

const APPROVE: Record<string, [string, string]> = {
  send_reminder: ['Send reminder', 'Opens WhatsApp with this message ready; you tap send. (With an SMS account set up, it goes by SMS straight away.)'],
  match_payment: ['Apply payment', 'Applies the payment to the invoice and updates what the customer owes.'],
  send_order: ['Mark order sent', 'Marks the order as sent to the supplier. Share it with them from the order page.'],
};

export default function Agents() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'review' | 'agents' | 'done') ?? 'review';
  const tasks = useApi<{ counts: { review: number; done: number }; items: Task[] }>(tab === 'agents' ? null : `/agents/tasks?status=${tab === 'done' ? 'done' : 'review'}`);
  const agents = useApi<Agent[]>('/agents');
  const on = agents.data?.filter((a) => a.enabled).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle={agents.data && `${on} of ${agents.data.length} working · they draft and check; you decide what leaves the business`}
      />
      <div className="mb-4">
        <Chips
          label="Show"
          value={tab}
          onChange={(v) => setParams(v === 'review' ? {} : { tab: v })}
          options={[
            ['review', 'To review', tasks.data?.counts.review],
            ['agents', 'Agents', agents.data?.length],
            ['done', 'History', tasks.data?.counts.done],
          ]}
        />
      </div>
      {tab === 'agents' ? (
        agents.error ? <ErrorNote>{agents.error}</ErrorNote> : !agents.data ? <Loading /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {agents.data.map((a) => (
              <AgentCard key={a.key} a={a} onChange={() => (agents.reload(), tasks.reload())} />
            ))}
          </div>
        )
      ) : tasks.error ? (
        <ErrorNote>{tasks.error}</ErrorNote>
      ) : !tasks.data ? (
        <Loading />
      ) : tasks.data.items.length === 0 ? (
        tab === 'review' ? (
          <Empty title="Nothing to review" action={on === 0 ? <button onClick={() => setParams({ tab: 'agents' })} className="btn btn-primary">See the agents</button> : undefined}>
            {on === 0 ? 'No agent is switched on yet. Each one drafts work for you to approve; nothing is sent without you.' : 'Your agents have nothing waiting for you. They check again on their own schedule.'}
          </Empty>
        ) : (
          <Empty title="No history yet" />
        )
      ) : (
        <ul className="space-y-3">
          {tasks.data.items.map((t) => (
            <TaskCard key={t.id} t={t} onDone={() => (tasks.reload(), agents.reload())} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskCard({ t, onDone }: { t: Task; onDone: () => void }) {
  const [text, setText] = useState(t.draft ?? '');
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ busy: '', error: '' });
  const review = t.status === 'NeedsReview';
  const [label, effect] = APPROVE[t.action] ?? ['Mark handled', 'Nothing is sent or changed; this just clears it from your list.'];

  const decide = async (approve: boolean) => {
    setState({ busy: approve ? 'approve' : 'dismiss', error: '' });
    try {
      const r = await api<{ result: string }>(`/agents/tasks/${t.id}/${approve ? 'approve' : 'dismiss'}`, { body: { text: t.action === 'send_reminder' ? text : undefined } });
      if (r.result?.startsWith('https://wa.me/')) window.open(r.result, '_blank', 'noopener');
      onDone();
    } catch (e) {
      setState({ busy: '', error: (e as Error).message });
    }
  };

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo/10 px-2 py-0.5 font-semibold text-indigo">
          <Bot className="h-3.5 w-3.5" /> {t.agent}
        </span>
        <span>{dateTime(t.createdAt)}</span>
        {!review && (
          <Status tone={t.status === 'Done' ? 'good' : t.status === 'Failed' ? 'bad' : 'plain'}>
            {t.status === 'Done' ? 'Done' : t.status === 'Dismissed' ? 'Dismissed' : 'Failed'}
          </Status>
        )}
      </div>
      <h2 className="mt-2 font-semibold text-[16px] leading-snug">{t.title}</h2>
      {t.detail && <p className="mt-1 text-sm text-muted">{t.detail}</p>}

      {review && t.action === 'send_reminder' && (
        <label className="mt-3 block">
          <span className="mb-1 flex justify-between text-xs font-semibold text-muted">
            Message to send <span className="num font-normal">{text.length}/480</span>
          </span>
          <textarea className="field min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={480} />
        </label>
      )}
      {!review && t.result && !t.result.startsWith('https://') && <p className="mt-2 text-sm font-medium text-good">{t.result}</p>}

      {review && <p className="mt-3 rounded-md bg-paper px-3 py-2 text-xs text-muted"><b className="text-ink-2">If you approve:</b> {effect}</p>}
      {state.error && <div className="mt-3"><ErrorNote>{state.error}</ErrorNote></div>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {review && (
          <>
            <button onClick={() => decide(true)} disabled={Boolean(state.busy) || (t.action === 'send_reminder' && text.trim().length < 10)} className="btn btn-primary">
              {state.busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {label}
            </button>
            <button onClick={() => decide(false)} disabled={Boolean(state.busy)} className="btn btn-ghost">
              {t.action === 'send_order' ? 'Cancel the draft' : 'Dismiss'}
            </button>
          </>
        )}
        {t.link && (
          <Link to={t.link} className="btn btn-ghost">
            <ExternalLink className="h-4 w-4" /> Open
          </Link>
        )}
        <button onClick={() => setOpen(!open)} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink" aria-expanded={open}>
          Timeline ({t.steps.length}) <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
        </button>
      </div>
      {open && (
        <ol className="mt-3 space-y-2 border-l-2 border-line pl-4">
          {t.steps.map((s, i) => (
            <li key={i} className="relative text-sm">
              <span className={cn('absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full', s.who.includes('agent') ? 'bg-indigo' : 'bg-brand')} />
              <b>{s.who}</b> <span className="text-xs text-faint">{dateTime(s.at)}</span>
              <p className="text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function AgentCard({ a, onChange }: { a: Agent; onChange: () => void }) {
  const session = useSession();
  const [settings, setSettings] = useState(a.settings);
  const [state, setState] = useState({ busy: '', error: '', note: '' });
  const call = async (what: string, fn: () => Promise<any>) => {
    setState({ busy: what, error: '', note: '' });
    try {
      const r = await fn();
      setState({ busy: '', error: '', note: r?.summary ?? '' });
      onChange();
    } catch (e) {
      setState({ busy: '', error: (e as Error).message, note: '' });
    }
  };
  const save = (enabled: boolean, s = settings) => call('save', () => api(`/agents/${a.key}`, { method: 'PUT', body: { enabled, settings: s } }));

  return (
    <section className="card flex flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', a.enabled ? 'bg-indigo text-white' : 'bg-paper text-faint ring-1 ring-line')}>
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{a.name}</h2>
          <p className="text-sm text-muted">{a.job}</p>
        </div>
        {a.canManage ? (
          <button role="switch" aria-checked={a.enabled} aria-label={`${a.name} ${a.enabled ? 'on' : 'off'}`} onClick={() => save(!a.enabled)} disabled={Boolean(state.busy)} className={cn('relative h-7 w-12 shrink-0 rounded-full transition', a.enabled ? 'bg-good' : 'bg-line')}>
            <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition', a.enabled ? 'left-6' : 'left-1')} />
          </button>
        ) : (
          <Status tone={a.enabled ? 'good' : 'plain'}>{a.enabled ? 'On' : 'Off'}</Status>
        )}
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wider text-faint uppercase">Does by itself</p>
          <ul className="space-y-1">
            {a.onItsOwn.map((x) => (
              <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-good" /> {x}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wider text-faint uppercase">Always asks you first</p>
          <ul className="space-y-1">
            {a.asksFirst.map((x) => (
              <li key={x} className="flex gap-2"><Hand className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> {x}</li>
            ))}
          </ul>
        </div>
      </div>

      {a.key === 'collections' && a.canManage && (
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-paper p-3 text-sm">
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">Remind every</span>
            <select className="field py-1.5" value={settings.remindEveryDays} onChange={(e) => setSettings({ ...settings, remindEveryDays: Number(e.target.value) })}>
              {[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">Start after</span>
            <select className="field py-1.5" value={settings.minDaysLate} onChange={(e) => setSettings({ ...settings, minDaysLate: Number(e.target.value) })}>
              {[1, 3, 7, 14].map((d) => <option key={d} value={d}>{d} day{d === 1 ? '' : 's'} late</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">Language</span>
            <select className="field py-1.5" value={settings.language} onChange={(e) => setSettings({ ...settings, language: e.target.value })}>
              <option value="en">English</option>
              <option value="sw">Kiswahili</option>
            </select>
          </label>
          {JSON.stringify(settings) !== JSON.stringify(a.settings) && (
            <button onClick={() => save(a.enabled)} className="btn btn-ghost col-span-3 py-1.5">Save settings</button>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3 text-sm text-muted">
        <span className="flex-1">
          {a.enabled ? (
            <>
              {a.every}{a.enabledBy && <> · switched on by {a.enabledBy}</>}
              {a.lastRunAt && <span className="block text-xs">Last run {dateTime(a.lastRunAt)}: {a.lastRunSummary}</span>}
            </>
          ) : a.canManage ? 'Off. Switch it on to start; it works with your rights for this job.' : 'Off. The owner can switch it on.'}
        </span>
        {a.toReview > 0 && <Link to="/agents" className="font-semibold text-brand hover:underline">{a.toReview} to review</Link>}
        {a.canRun && can(session, 'read') && (
          <button onClick={() => call('run', () => api(`/agents/${a.key}/run`, { body: {} }))} disabled={Boolean(state.busy)} className="btn btn-ghost py-1.5">
            {state.busy === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run now
          </button>
        )}
      </div>
      {state.note && <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-good"><Sparkles className="h-4 w-4" /> {state.note}</p>}
      {state.error && <div className="mt-2"><ErrorNote>{state.error}</ErrorNote></div>}
    </section>
  );
}
