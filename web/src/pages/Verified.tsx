// Kabuor Verified: the owner's proof page. The owner is deciding "Is my business ready to borrow, and what's holding
// my figures back?", so the page leads with the one number a lender asks for (money Safaricom confirmed, a month),
// then KRA signing, then what would make the proof stronger. Facts only, never a score: lenders decide.
import { useState } from 'react';
import { Link } from 'react-router';
import { BadgeCheck, CircleAlert, ShieldCheck } from 'lucide-react';
import { useApi } from '../lib/api';
import { ksh } from '../lib/format';
import { Chips, Empty, ErrorNote, Loading, PageHeader, Stat } from '../components/ui';
import { ChartCard, Columns, compact, Legend, monthName, SERIES, Table } from '../components/DashboardCharts';

type Month = { month: string; partial: boolean; confirmed: number; allMoneyIn: number; confirmedShare: number; payers: number; topFiveShare: number };
type Source = { source: string; amount: number; count: number; confirmedAmount: number };
type Fix = { code: string; text: string; link: string | null; action: string | null };
type Summary = {
  months: number; from: string; to: string;
  averageMonthlyConfirmed: number; payers: number; topFiveShare: number; monthToDateConfirmed: number;
  ownNumbers: number; notFromSafaricom: number;
  monthList: Month[]; bySource: Source[];
  etims: { required: boolean; issued: number; signed: number; testSigned: number; failedOrPending: number; signedShare: number };
  fixes: Fix[]; checkedAt: string;
};

// Everything that isn't Safaricom's confirmation is shown in a neutral grey: it may be right, but it proves nothing.
const OTHER = '#b9bccf';
const SOURCE_WORDS: Record<string, string> = {
  MpesaConfirmation: 'M-Pesa confirmations', MpesaPrompt: 'M-Pesa payment prompts', Till: 'Recorded at the till',
  StatementImport: 'Statement uploads', ConnectedSystem: 'Connected apps', Manual: 'Entered by hand', Unknown: 'Source not yet known',
};
const pct = (share: number) => `${Math.round(share * 100)}%`;
const num = (n: number) => n.toLocaleString('en-KE');

export default function Verified() {
  const [months, setMonths] = useState<'3' | '6' | '12'>('6');
  const { data, error, loading } = useApi<Summary>(`/verified/summary?months=${months}`);

  return (
    <>
      <PageHeader
        title="Verified"
        subtitle="What Safaricom and KRA confirm about your business. Lenders trust these figures because nobody in your business typed them."
      />
      <div className="mb-4">
        <Chips label="Period" value={months} onChange={setMonths} options={[['3', 'Last 3 months'], ['6', 'Last 6 months'], ['12', 'Last 12 months']]} />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !data && <Loading />}
      {data && <Body s={data} />}
    </>
  );
}

function Body({ s }: { s: Summary }) {
  const nothingYet = s.averageMonthlyConfirmed === 0 && s.monthToDateConfirmed === 0;
  const whole = s.monthList.filter((m) => !m.partial);
  const confirmedTotal = whole.reduce((t, m) => t + m.confirmed, 0);
  const allTotal = whole.reduce((t, m) => t + m.allMoneyIn, 0);
  const labels = s.monthList.map((m) => monthName(`${m.month}-01`) + (m.partial ? '*' : ''));
  // The chart's line covers every bar it shows, this month included; the headline sticks to whole months.
  const shownConfirmed = s.monthList.reduce((t, m) => t + m.confirmed, 0);
  const shownAll = s.monthList.reduce((t, m) => t + m.allMoneyIn, 0);

  return (
    <div className="flex flex-col gap-4">
      {nothingYet ? (
        <Empty title="No money confirmed by Safaricom yet">
          <ol className="mx-auto mt-2 max-w-md list-decimal space-y-1.5 pl-5 text-left text-sm">
            <li>Open <Link to="/settings" className="font-semibold text-brand hover:underline">Settings → Business &amp; M-Pesa</Link> and copy your confirmation address.</li>
            <li>Paste it into your Paybill or Till settings on Safaricom’s M-Pesa portal (or ask Safaricom to register it).</li>
            <li>From then on, every customer payment arrives straight from Safaricom and counts here.</li>
          </ol>
        </Empty>
      ) : s.averageMonthlyConfirmed === 0 ? (
        // Confirmations only started this month: lead with what's there, and say what a lender will look for.
        <section className="card p-5 sm:p-6">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-good"><BadgeCheck className="h-4 w-4" /> Confirmed by Safaricom</p>
          <p className="num mt-1 font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{ksh(s.monthToDateConfirmed)} <span className="whitespace-nowrap text-lg font-semibold text-muted">so far this month</span></p>
          <p className="mt-1 text-sm text-ink-2">Your first whole month of confirmed money ends on the last day of this month. Lenders usually look at three to six whole months.</p>
        </section>
      ) : (
        <section className="card p-5 sm:p-6">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-good"><BadgeCheck className="h-4 w-4" /> Confirmed by Safaricom</p>
          <p className="num mt-1 font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{ksh(Math.round(s.averageMonthlyConfirmed / 100) * 100)} <span className="text-lg font-semibold text-muted">a month</span></p>
          <p className="mt-1 text-sm text-ink-2">
            from <b>{num(s.payers)}</b> different paying numbers, on average over the last {s.months} whole months
            {allTotal > 0 && <> · {pct(confirmedTotal / allTotal)} of all money in</>}
          </p>
          <p className="mt-3 text-sm text-muted">This month so far: <span className="num font-semibold text-ink">{ksh(s.monthToDateConfirmed)}</span></p>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Confirmed money by month"
          answer={shownAll > 0 ? `${pct(shownConfirmed / shownAll)} of money in since ${monthName(s.from.slice(0, 10), true)} was confirmed by Safaricom` : 'No money in yet in this period'}
          legend={<Legend items={[['Confirmed by Safaricom', SERIES[0]], ['All money in', OTHER]]} />}
          table={<Table head={['Month', 'Confirmed', 'All money in', 'Paying numbers']} rows={s.monthList.map((m, i) => [labels[i], ksh(m.confirmed), ksh(m.allMoneyIn), num(m.payers)])} />}
        >
          <Columns
            labels={labels}
            series={[{ name: 'Confirmed by Safaricom', color: SERIES[0], values: s.monthList.map((m) => m.confirmed) }, { name: 'All money in', color: OTHER, values: s.monthList.map((m) => m.allMoneyIn) }]}
            fmt={compact}
            tip={(i) => {
              const m = s.monthList[i];
              return (
                <>
                  <p className="font-semibold">{monthName(`${m.month}-01`, true)}{m.partial && ' (so far)'}</p>
                  <p className="mt-1">Confirmed: <b className="num">{ksh(m.confirmed)}</b></p>
                  <p>All money in: <span className="num">{ksh(m.allMoneyIn)}</span></p>
                  <p className="text-muted">{num(m.payers)} paying numbers{m.allMoneyIn > 0 && ` · ${pct(m.confirmedShare)} confirmed`}</p>
                </>
              );
            }}
          />
          {s.monthList.some((m) => m.partial) && <p className="mt-1 text-2xs text-faint">* this month so far</p>}
        </ChartCard>

        <EtimsTile e={s.etims} />
      </div>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-brand" /> Strength of your proof</h2>
        {s.fixes.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">Nothing to fix: your money in comes from Safaricom and your invoices are signed by KRA.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {s.fixes.map((f) => (
              <li key={f.code} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                <p className="min-w-0 flex-1 text-sm">{f.text}</p>
                {f.link && f.action && <Link to={f.link} className="btn btn-ghost shrink-0 py-1.5 text-sm">{f.action}</Link>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {s.bySource.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold">Where money in came from</h2>
          <p className="mt-0.5 text-sm text-muted">Only money Safaricom’s servers confirmed counts as proof. The rest may be right, but a lender can’t check it.</p>
          <div className="mt-3">
            <Table
              head={['Source', 'Payments', 'Amount', 'Counts as proof']}
              rows={s.bySource.map((r) => [SOURCE_WORDS[r.source] ?? r.source, num(r.count), ksh(r.amount), r.confirmedAmount > 0 ? <span className="font-semibold text-good">{ksh(r.confirmedAmount)}</span> : <span className="text-faint">None</span>])}
            />
          </div>
        </section>
      )}

      <p className="text-xs text-faint">
        Checked {new Date(s.checkedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. Kabuor shows facts, not a credit score: lenders make their own decisions.
        No customer names or phone numbers are part of these figures.
      </p>
    </div>
  );
}

function EtimsTile({ e }: { e: Summary['etims'] }) {
  if (!e.required)
    return <Stat label="KRA eTIMS" value="Not needed">Your business isn’t registered for VAT, so invoices don’t need KRA’s signature.</Stat>;
  if (e.issued === 0) return <Stat label="KRA eTIMS" value="No invoices yet">Issued invoices are signed by KRA as you send them.</Stat>;
  return (
    <Stat label="Invoices signed by KRA" value={pct(e.signedShare)} tone={e.signedShare >= 0.95 ? 'good' : undefined}>
      <span className="num">{num(e.signed)} of {num(e.issued)}</span> issued invoices in this period.
      {e.testSigned > 0 && <> {num(e.testSigned)} signed in test mode until KRA certifies Kabuor ERP.</>}
      {e.failedOrPending > 0 && <> {num(e.failedOrPending)} waiting to be signed.</>}
    </Stat>
  );
}
