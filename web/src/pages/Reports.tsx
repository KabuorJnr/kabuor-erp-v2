import { useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApi } from '../lib/api';
import { cn, dayYear, ksh, todayIso } from '../lib/format';
import { Chips, ErrorNote, Loading, PageHeader } from '../components/ui';

function periodOf(p: string): [string, string, string] {
  const t = todayIso();
  const [y, m] = t.split('-').map(Number);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p === 'last-month') return [iso(new Date(Date.UTC(y, m - 2, 1))), iso(new Date(Date.UTC(y, m - 1, 0))), 'last month'];
  if (p === 'year') return [`${y}-01-01`, t, `this year`];
  return [iso(new Date(Date.UTC(y, m - 1, 1))), t, 'this month'];
}

function Delta({ now, before, invert }: { now: number; before: number; invert?: boolean }) {
  if (!before) return null;
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  const good = invert ? pct <= 0 : pct >= 0;
  return <span className={cn('text-xs font-semibold', good ? 'text-good' : 'text-bad')}>{pct >= 0 ? '▲' : '▼'} {Math.abs(pct)}%</span>;
}

function ProfitAndLoss({ period }: { period: string }) {
  const [from, to] = periodOf(period);
  const { data, error } = useApi<any>(`/reports/profit-and-loss?from=${from}&to=${to}`);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  const c = data.current;
  const p = data.previous;
  const rows = (list: any[], prev: any[]) =>
    list.map((r) => (
      <tr key={r.code}>
        <td className="py-2">{r.name}</td>
        <td className="num py-2 text-right">{ksh(r.amount)}</td>
        <td className="num py-2 text-right text-muted">{ksh(prev.find((x) => x.code === r.code)?.amount ?? 0)}</td>
      </tr>
    ));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <section className="card overflow-x-auto p-4 sm:p-5">
        <table className="w-full min-w-[26rem] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="pb-2 font-semibold">
                {dayYear(c.from)} – {dayYear(c.to)}
              </th>
              <th className="pb-2 text-right font-semibold">This period</th>
              <th className="pb-2 text-right font-semibold">Period before</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr>
              <td colSpan={3} className="pt-3 pb-1 text-xs font-semibold text-muted uppercase">
                Money earned
              </td>
            </tr>
            {c.income.length ? rows(c.income, p.income) : <tr><td colSpan={3} className="py-2 text-muted">No sales in this period.</td></tr>}
            <tr className="font-semibold">
              <td className="py-2">Total earned</td>
              <td className="num py-2 text-right">{ksh(c.totalIncome)}</td>
              <td className="num py-2 text-right text-muted">{ksh(p.totalIncome)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="pt-4 pb-1 text-xs font-semibold text-muted uppercase">
                Money spent
              </td>
            </tr>
            {c.expenses.length ? rows(c.expenses, p.expenses) : <tr><td colSpan={3} className="py-2 text-muted">No expenses recorded yet (purchases and bills arrive in the next module).</td></tr>}
            <tr className="font-semibold">
              <td className="py-2">Total spent</td>
              <td className="num py-2 text-right">{ksh(c.totalExpenses)}</td>
              <td className="num py-2 text-right text-muted">{ksh(p.totalExpenses)}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <aside className="card h-fit p-5">
        <p className="text-sm text-muted">Profit</p>
        <p className={cn('num mt-1 font-display text-3xl font-bold', c.profit < 0 && 'text-bad')}>{ksh(c.profit)}</p>
        <p className="mt-1 text-xs text-muted">
          {ksh(p.profit)} the period before <Delta now={c.profit} before={p.profit} />
        </p>
        <p className="mt-4 text-xs text-muted">Sales are counted without VAT (VAT belongs to KRA).</p>
      </aside>
    </div>
  );
}

function Aging() {
  const { data, error } = useApi<any>('/reports/aging');
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  if (!data.rows.length) return <p className="card p-5 text-sm text-muted">Nobody owes you anything right now.</p>;
  return (
    <section className="card overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="border-b border-line bg-paper text-left text-xs text-muted">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Customer</th>
            {data.labels.map((l: string, i: number) => (
              <th key={l} className={cn('px-3 py-2.5 text-right font-semibold', i >= 3 && 'text-bad')}>
                {l}
              </th>
            ))}
            <th className="px-4 py-2.5 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.rows.map((r: any) => (
            <tr key={r.customerId} className="hover:bg-paper">
              <td className="px-4 py-2.5">
                <Link to={`/customers/${r.customerId}`} className="font-semibold hover:text-brand">
                  {r.customer}
                </Link>
              </td>
              {r.buckets.map((b: number, i: number) => (
                <td key={i} className={cn('num px-3 py-2.5 text-right', !b && 'text-faint', b > 0 && i >= 3 && 'font-semibold text-bad')}>
                  {b ? ksh(b) : '—'}
                </td>
              ))}
              <td className="num px-4 py-2.5 text-right font-semibold">{ksh(r.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-line bg-paper font-semibold">
          <tr>
            <td className="px-4 py-2.5">Everyone</td>
            {data.totals.map((t: number, i: number) => (
              <td key={i} className="num px-3 py-2.5 text-right">
                {t ? ksh(t) : '—'}
              </td>
            ))}
            <td className="num px-4 py-2.5 text-right">{ksh(data.total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function Vat({ period }: { period: string }) {
  const [from, to, label] = periodOf(period);
  const { data, error } = useApi<any>(`/reports/vat?from=${from}&to=${to}`);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <section className="card overflow-x-auto p-4 sm:p-5">
        <table className="w-full min-w-[26rem] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="pb-2 font-semibold">Tax type</th>
              <th className="pb-2 text-right font-semibold">Sales before VAT</th>
              <th className="pb-2 text-right font-semibold">VAT</th>
              <th className="pb-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.byType.length ? (
              data.byType.map((r: any) => (
                <tr key={r.type}>
                  <td className="py-2">{r.label}</td>
                  <td className="num py-2 text-right">{ksh(r.net)}</td>
                  <td className="num py-2 text-right">{ksh(r.tax)}</td>
                  <td className="num py-2 text-right">{ksh(r.total)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-3 text-muted">
                  No invoices issued {label}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <aside className="card h-fit p-5">
        <p className="text-sm text-muted">VAT on sales, {label}</p>
        <p className="num mt-1 font-display text-3xl font-bold">{ksh(data.totalTax)}</p>
        <p className="mt-2 text-xs text-muted">Output VAT for your return. Input VAT from purchases comes with the purchasing module. VAT returns are due by the 20th of the following month.</p>
      </aside>
    </div>
  );
}

function TrialBalance() {
  const { data, error } = useApi<any>('/reports/trial-balance');
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  return (
    <section className="card overflow-x-auto p-4 sm:p-5">
      <p className={cn('mb-3 flex items-center gap-2 text-sm font-semibold', data.balanced ? 'text-good' : 'text-bad')}>
        {data.balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        {data.balanced ? 'The books balance.' : 'The books don’t balance. Contact support.'}
      </p>
      <table className="w-full min-w-[26rem] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="pb-2 font-semibold">Account</th>
            <th className="pb-2 text-right font-semibold">Debit</th>
            <th className="pb-2 text-right font-semibold">Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.accounts.map((a: any) => (
            <tr key={a.id}>
              <td className="py-2">
                <span className="text-muted">{a.code}</span> {a.name}
              </td>
              <td className="num py-2 text-right">{a.debit ? ksh(a.debit) : ''}</td>
              <td className="num py-2 text-right">{a.credit ? ksh(a.credit) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-line font-semibold">
          <tr>
            <td className="py-2">Total</td>
            <td className="num py-2 text-right">{ksh(data.debit)}</td>
            <td className="num py-2 text-right">{ksh(data.credit)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

export default function Reports() {
  const [tab, setTab] = useState('pnl');
  const [period, setPeriod] = useState('month');
  return (
    <>
      <PageHeader title="Reports" subtitle="Numbers come straight from your invoices and payments, so they’re always up to date." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Chips label="Report" value={tab} onChange={setTab} options={[['pnl', 'Profit & loss'], ['aging', 'Who owes you'], ['vat', 'VAT'], ['tb', 'Trial balance']]} />
        {(tab === 'pnl' || tab === 'vat') && <Chips label="Period" value={period} onChange={setPeriod} options={[['month', 'This month'], ['last-month', 'Last month'], ['year', 'This year']]} />}
      </div>
      {tab === 'pnl' && <ProfitAndLoss period={period} />}
      {tab === 'aging' && <Aging />}
      {tab === 'vat' && <Vat period={period} />}
      {tab === 'tb' && <TrialBalance />}
    </>
  );
}
