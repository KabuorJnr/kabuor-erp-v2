import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Ban, FileCheck2, Loader2, MessageCircle, Pencil, Printer, RefreshCw, Send, Wallet } from 'lucide-react';
import { api, can, useApi, useSession } from '../lib/api';
import { dateTime, dayYear, ksh, msisdn, prettyPhone, toCents } from '../lib/format';
import { DocStatus } from './Invoices';
import { ErrorNote, Field, Loading, Sheet, Status } from '../components/ui';

const TAX_LABEL: Record<string, string> = { B_Standard16: '16%', E_Reduced8: '8%', C_ZeroRated: '0%', A_Exempt: 'Exempt', D_NonVat: 'Non-VAT' };

function RecordPayment({ doc, open, onClose, onDone }: { doc: any; open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ method: 'Mpesa', amount: String((doc.total - doc.paid) / 100), reference: '', receivedAt: '' });
  const [state, setState] = useState({ busy: false, error: '' });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      await api('/payments', { body: { method: f.method, amount: toCents(f.amount), reference: f.reference, receivedAt: f.receivedAt ? new Date(f.receivedAt).toISOString() : null, customerId: doc.customerId, invoiceId: doc.id } });
      onDone();
      onClose();
    } catch (err) {
      setState({ busy: false, error: (err as Error).message });
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Payment for ${doc.number}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">M-Pesa payments to your Paybill/Till arrive and match by themselves. Record payments here that came another way.</p>
        <div>
          <p className="mb-1.5 text-sm font-semibold">How they paid</p>
          <div className="grid grid-cols-3 gap-2">
            {[['Mpesa', 'M-Pesa'], ['Cash', 'Cash'], ['Bank', 'Bank']].map(([v, l]) => (
              <button key={v} type="button" aria-pressed={f.method === v} onClick={() => setF({ ...f, method: v })} className={f.method === v ? 'btn bg-ink text-white' : 'btn btn-ghost'}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <Field label="Amount (KSh)" hint={`Still to pay: ${ksh(doc.total - doc.paid)}`}>
          <input className="field num" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required />
        </Field>
        <Field label={f.method === 'Mpesa' ? 'M-Pesa code' : f.method === 'Bank' ? 'Bank reference' : 'Receipt number'} hint={f.method === 'Mpesa' ? 'From the SMS, e.g. SJK4H7L2PQ' : 'Optional'}>
          <input className="field uppercase" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} required={f.method === 'Mpesa'} />
        </Field>
        <Field label="Date paid" hint="Leave empty for now.">
          <input className="field" type="datetime-local" value={f.receivedAt} onChange={(e) => setF({ ...f, receivedAt: e.target.value })} />
        </Field>
        {state.error && <ErrorNote>{state.error}</ErrorNote>}
        <button className="btn btn-primary w-full py-3" disabled={state.busy}>
          {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Record {ksh(toCents(f.amount))}
        </button>
      </form>
    </Sheet>
  );
}

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const { data, error, reload } = useApi<{ document: any; payments: any[]; payTo: { paybill: string; account: string } }>(`/sales/${id}`);
  const [paying, setPaying] = useState(false);
  const [state, setState] = useState({ busy: '', error: '' });
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;
  const d = data.document;
  const invoice = d.kind === 'Invoice';
  const balance = d.total - d.paid;
  const issued = d.status !== 'Draft' && d.status !== 'Void';

  const act = async (name: string, path: string, after?: (r: any) => void) => {
    setState({ busy: name, error: '' });
    try {
      const r = await api(path, { body: {} });
      after ? after(r) : reload();
      setState({ busy: '', error: '' });
    } catch (e) {
      setState({ busy: '', error: (e as Error).message });
    }
  };

  const phone = msisdn(d.customer?.phone);
  const payLine = data.payTo.paybill ? `Pay by M-Pesa: Paybill ${data.payTo.paybill}, account ${d.number}.` : `Please quote ${d.number} when you pay.`;
  const waText = invoice
    ? `Hello ${d.customer?.name}, here is invoice ${d.number} from ${session?.company.name} for ${ksh(balance)}${d.dueDate ? `, due ${dayYear(d.dueDate)}` : ''}. ${payLine} Thank you.`
    : `Hello ${d.customer?.name}, here is our quote ${d.number} for ${ksh(d.total)}, valid until ${dayYear(d.dueDate)}. Reply to confirm and we'll get started. Thank you.`;

  return (
    <>
      <Link to={invoice ? '/invoices' : '/quotes'} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink print:hidden">
        <ArrowLeft className="h-4 w-4" /> {invoice ? 'Invoices' : 'Quotes'}
      </Link>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[26px] font-bold tracking-tight sm:text-3xl">{d.number}</h1>
            <DocStatus d={d} />
          </div>
          <p className="mt-1 text-sm text-muted">
            <Link to={`/customers/${d.customerId}`} className="font-semibold text-ink hover:text-brand">
              {d.customer?.name}
            </Link>
            {invoice && issued && <> · {balance > 0 ? <>still to pay <b className="num text-ink">{ksh(balance)}</b> of {ksh(d.total)}</> : <>paid in full</>}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.status === 'Draft' && can(session, 'sell') && (
            <>
              <Link to={`/sales/${d.id}/edit`} className="btn btn-ghost">
                <Pencil className="h-4 w-4" /> Edit
              </Link>
              <button className="btn btn-primary" disabled={Boolean(state.busy)} onClick={() => act('issue', `/sales/${d.id}/issue`)}>
                {state.busy === 'issue' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {invoice ? 'Issue invoice' : 'Mark as sent'}
              </button>
            </>
          )}
          {!invoice && d.status === 'Sent' && can(session, 'sell') && (
            <button className="btn btn-primary" disabled={Boolean(state.busy)} onClick={() => act('convert', `/sales/${d.id}/to-invoice`, (r) => navigate(`/sales/${r.id}`))}>
              <FileCheck2 className="h-4 w-4" /> Turn into invoice
            </button>
          )}
          {issued && phone && (balance > 0 || !invoice) && (
            <a className="btn btn-mpesa" href={`https://wa.me/${phone}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> Send on WhatsApp
            </a>
          )}
          {invoice && issued && balance > 0 && can(session, 'sell') && (
            <button className="btn btn-ghost" onClick={() => setPaying(true)}>
              <Wallet className="h-4 w-4" /> Record payment
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => window.print()} aria-label="Print or save as PDF">
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </header>

      {state.error && <div className="mb-4 print:hidden"><ErrorNote>{state.error}</ErrorNote></div>}
      {invoice && issued && d.etimsStatus !== 'Signed' && d.etimsStatus !== 'NotRequired' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-warn-soft px-4 py-3 text-sm text-warn print:hidden">
          <span>
            <b>Not yet signed with KRA eTIMS.</b> {d.etimsError}
          </span>
          <button className="btn btn-ghost py-1.5" disabled={Boolean(state.busy)} onClick={() => act('etims', `/sales/${d.id}/etims`)}>
            {state.busy === 'etims' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Try again
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        {/* The document as the customer sees it (and as it prints). */}
        <article className="card p-5 sm:p-8 print:shadow-none print:ring-0">
          <div className="flex flex-wrap justify-between gap-6">
            <div>
              <p className="font-display text-xl font-bold">{session?.company.name}</p>
              {session?.company.kraPin && <p className="text-sm text-muted">KRA PIN {session.company.kraPin}</p>}
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold tracking-tight uppercase">{invoice ? 'Invoice' : 'Quote'}</p>
              <p className="text-sm text-muted">{d.number}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold text-muted uppercase">Bill to</p>
              <p className="mt-1 font-semibold">{d.customer?.name}</p>
              {d.customer?.phone && <p className="text-muted">{prettyPhone(d.customer.phone)}</p>}
              {d.customer?.kraPin && <p className="text-muted">PIN {d.customer.kraPin}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase">Date</p>
              <p className="mt-1">{dayYear(d.issueDate)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase">{invoice ? 'Due' : 'Valid until'}</p>
              <p className="mt-1">{dayYear(d.dueDate)}</p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  <th className="py-2 font-semibold">Description</th>
                  <th className="py-2 text-right font-semibold">Qty</th>
                  <th className="py-2 text-right font-semibold">Price</th>
                  <th className="py-2 text-right font-semibold">Tax</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.lines.map((l: any) => (
                  <tr key={l.id}>
                    <td className="py-2.5 pr-3">{l.description}</td>
                    <td className="num py-2.5 text-right">{l.quantity}</td>
                    <td className="num py-2.5 text-right">{ksh(l.unitPrice)}</td>
                    <td className="py-2.5 text-right text-muted">{TAX_LABEL[l.taxType]}</td>
                    <td className="num py-2.5 text-right font-medium">{ksh(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Before VAT</dt>
              <dd className="num">{ksh(d.net)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">VAT</dt>
              <dd className="num">{ksh(d.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="num">{ksh(d.total)}</dd>
            </div>
            {d.paid > 0 && (
              <>
                <div className="flex justify-between text-good">
                  <dt>Paid</dt>
                  <dd className="num">−{ksh(d.paid)}</dd>
                </div>
                <div className="flex justify-between font-bold">
                  <dt>Balance</dt>
                  <dd className="num">{ksh(balance)}</dd>
                </div>
              </>
            )}
          </dl>
          {d.notes && <p className="mt-6 text-sm whitespace-pre-line text-ink-2">{d.notes}</p>}
          {invoice && issued && (
            <div className="mt-6 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
              <p>
                <b className="block">How to pay</b>
                <span className="text-muted">{payLine}</span>
              </p>
              {d.etimsStatus === 'Signed' && (
                <p>
                  <b className="block">KRA eTIMS</b>
                  <span className="text-muted break-all">
                    {d.etimsInvoiceNo} · {d.etimsControlCode}
                  </span>
                </p>
              )}
            </div>
          )}
        </article>

        <aside className="space-y-4 print:hidden">
          {invoice && issued && (
            <section className="card p-4">
              <h2 className="text-sm font-semibold text-muted">Payments</h2>
              {data.payments.length ? (
                <ul className="mt-2 space-y-2.5">
                  {data.payments.map((p, i) => (
                    <li key={i} className="text-sm">
                      <div className="flex justify-between gap-2">
                        <b>{p.method === 'Mpesa' ? 'M-Pesa' : p.method}</b>
                        <span className="num font-semibold">{ksh(p.amount)}</span>
                      </div>
                      <p className="text-xs text-muted">
                        {p.reference && `${p.reference} · `}
                        {dateTime(p.receivedAt)}
                      </p>
                      <p className="text-xs text-faint">Matched {p.matchedBy.startsWith('auto') ? 'automatically' : `by ${p.matchedBy.replace(/^user: /, '')}`}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">None yet. M-Pesa payments with account {d.number} will appear here by themselves.</p>
              )}
            </section>
          )}
          {invoice && d.etimsStatus === 'Signed' && (
            <section className="card p-4 text-sm">
              <Status tone="good">Signed with KRA eTIMS</Status>
              {d.etimsControlCode.startsWith('TEST-') && <p className="mt-2 text-xs text-muted">Test signature (eTIMS sandbox). Live signing starts after KRA certifies the integration.</p>}
            </section>
          )}
          {d.status !== 'Void' && d.paid === 0 && can(session, 'finance') && (
            <button className="btn btn-ghost w-full text-bad" disabled={Boolean(state.busy)} onClick={() => confirm(`Void ${d.number}? This can’t be undone.`) && act('void', `/sales/${d.id}/void`)}>
              <Ban className="h-4 w-4" /> Void {invoice ? 'invoice' : 'quote'}
            </button>
          )}
        </aside>
      </div>
      {paying && <RecordPayment doc={d} open={paying} onClose={() => setPaying(false)} onDone={reload} />}
    </>
  );
}
