import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, DollarSign, FileCheck, Loader2, PackageCheck, Printer, XCircle } from 'lucide-react';
import { api, can, useApi, useSession } from '../lib/api';
import { day, dateTime, ksh, prettyPhone, toCents } from '../lib/format';
import { useLang } from '../lib/i18n';
import { ErrorNote, Field, Loading, PageHeader, Sheet } from '../components/ui';
import { PurchaseStatusBadge } from './Purchases';

type Line = {
  id: string;
  itemId: string | null;
  accountId: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  tax: number;
  total: number;
  taxType: string;
};

type Payment = {
  id: string;
  method: string;
  amount: number;
  reference: string;
  paidAt: string;
};

type PurchaseDoc = {
  id: string;
  kind: 'Order' | 'Bill';
  number: string;
  supplierRef: string;
  status: string;
  issueDate: string;
  dueDate: string;
  net: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  notes: string;
  supplierId: string;
  supplier: { id: string; name: string; number: string; phone: string; kraPin: string };
  lines: Line[];
};

function PayBillModal({
  open,
  onClose,
  doc,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  doc: PurchaseDoc;
  onPaid: () => void;
}) {
  const [method, setMethod] = useState<'Mpesa' | 'Bank' | 'Cash'>('Mpesa');
  const [amountStr, setAmountStr] = useState(((doc.total - doc.paid) / 100).toFixed(2));
  const [reference, setReference] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    const amount = toCents(amountStr);
    if (amount <= 0 || amount > doc.total - doc.paid) {
      setState({ busy: false, error: 'Enter a valid payment amount.' });
      return;
    }
    try {
      await api(`/purchases/${doc.id}/pay`, {
        method: 'POST',
        body: {
          method,
          amount,
          reference: reference.trim() || undefined,
        },
      });
      onPaid();
      onClose();
    } catch (err) {
      setState({ busy: false, error: (err as Error).message });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Pay ${doc.number} (${doc.supplier.name})`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg bg-paper p-3 ring-1 ring-line">
          <span className="text-xs text-muted block">Remaining balance</span>
          <b className="num text-xl font-bold text-ink">{ksh(doc.total - doc.paid)}</b>
        </div>

        <Field label="Payment method">
          <div className="grid grid-cols-3 gap-2">
            {(['Mpesa', 'Bank', 'Cash'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`py-2 text-xs font-semibold rounded-md border ${
                  method === m ? 'border-brand bg-brand-soft text-brand font-bold' : 'border-line text-muted'
                }`}
              >
                {m === 'Mpesa' ? 'M-Pesa' : m}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Amount to pay (KSh)">
          <input
            className="field"
            type="number"
            step="any"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            required
          />
        </Field>

        <Field
          label="Transaction reference"
          hint={method === 'Mpesa' ? 'e.g. SKP1Q2W3E4' : 'Bank slip or receipt number'}
        >
          <input
            className="field uppercase"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={method === 'Mpesa' ? 'M-Pesa code' : 'Ref #'}
          />
        </Field>

        {state.error && <ErrorNote>{state.error}</ErrorNote>}

        <button className="btn btn-primary w-full py-3" disabled={state.busy}>
          {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Record payment
        </button>
      </form>
    </Sheet>
  );
}

export default function PurchaseView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const { t } = useLang();

  const [paying, setPaying] = useState(false);
  const [state, setState] = useState({ busy: false, error: '' });

  const { data, error, reload } = useApi<{
    document: PurchaseDoc;
    payments: Payment[];
    location: string | null;
  }>(id ? `/purchases/${id}` : null);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <Loading />;

  const { document: doc, payments, location } = data;
  const isBill = doc.kind === 'Bill';
  const isDraft = doc.status === 'Draft';
  const isOpen = ['Open', 'PartPaid'].includes(doc.status);

  const postDoc = async () => {
    setState({ busy: true, error: '' });
    try {
      await api(`/purchases/${doc.id}/post`, { method: 'POST' });
      reload();
      setState({ busy: false, error: '' });
    } catch (e) {
      setState({ busy: false, error: (e as Error).message });
    }
  };

  const receiveOrder = async () => {
    setState({ busy: true, error: '' });
    try {
      const bill = await api(`/purchases/${doc.id}/receive`, { method: 'POST' });
      navigate(`/purchases/${bill.id}`);
    } catch (e) {
      setState({ busy: false, error: (e as Error).message });
    }
  };

  const voidDoc = async () => {
    if (!confirm('Are you sure you want to void this bill? This will reverse any stock and journal entries.'))
      return;
    setState({ busy: true, error: '' });
    try {
      await api(`/purchases/${doc.id}/void`, { method: 'POST' });
      reload();
      setState({ busy: false, error: '' });
    } catch (e) {
      setState({ busy: false, error: (e as Error).message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link
          to={`/purchases?kind=${doc.kind}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> {isBill ? t('Bills') : t('Purchase orders')}
        </Link>
        <PageHeader
          title={`${doc.number}`}
          subtitle={`${isBill ? 'Supplier Bill' : 'Purchase Order'} · ${doc.supplier.name}${
            doc.supplierRef ? ` · Invoice ${doc.supplierRef}` : ''
          }`}
          actions={
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </button>

              {isDraft && can(session, isBill ? 'finance' : 'stock') && (
                <button type="button" className="btn btn-primary" disabled={state.busy} onClick={postDoc}>
                  {state.busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  <FileCheck className="h-4 w-4" /> {isBill ? 'Post bill' : 'Send order'}
                </button>
              )}

              {!isBill && doc.status === 'Sent' && can(session, 'stock') && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={state.busy}
                  onClick={receiveOrder}
                >
                  {state.busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  <PackageCheck className="h-4 w-4" /> Receive goods & create bill
                </button>
              )}

              {isBill && isOpen && can(session, 'finance') && (
                <button type="button" className="btn btn-primary" onClick={() => setPaying(true)}>
                  <DollarSign className="h-4 w-4" /> Pay bill
                </button>
              )}

              {isBill && (isDraft || isOpen) && payments.length === 0 && can(session, 'finance') && (
                <button
                  type="button"
                  className="btn btn-ghost text-bad hover:bg-bad-soft"
                  disabled={state.busy}
                  onClick={voidDoc}
                >
                  <XCircle className="h-4 w-4" /> Void
                </button>
              )}
            </div>
          }
        />
      </div>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}

      <div className="card p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap justify-between gap-4 border-b border-line pb-6">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-muted block mb-1">
              {isBill ? 'Supplier Bill' : 'Purchase Order'}
            </span>
            <h2 className="text-2xl font-bold font-display text-ink">{doc.number}</h2>
            <div className="mt-2">
              <PurchaseStatusBadge d={doc} />
            </div>
          </div>
          <div className="text-right sm:text-right">
            <span className="text-xs uppercase tracking-wider font-semibold text-muted block">Supplier</span>
            <Link
              to={`/suppliers/${doc.supplier.id}`}
              className="text-base font-bold text-brand hover:underline"
            >
              {doc.supplier.name}
            </Link>
            {doc.supplier.kraPin && (
              <p className="text-xs text-muted font-mono">PIN: {doc.supplier.kraPin}</p>
            )}
            {doc.supplier.phone && <p className="text-xs text-muted">{prettyPhone(doc.supplier.phone)}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm border-b border-line pb-6">
          <div>
            <span className="text-xs text-muted block">Issue Date</span>
            <b className="font-medium text-ink">{day(doc.issueDate)}</b>
          </div>
          <div>
            <span className="text-xs text-muted block">Due Date</span>
            <b className="font-medium text-ink">{day(doc.dueDate)}</b>
          </div>
          <div>
            <span className="text-xs text-muted block">Supplier Ref</span>
            <b className="font-medium text-ink">{doc.supplierRef || '—'}</b>
          </div>
          <div>
            <span className="text-xs text-muted block">Store Location</span>
            <b className="font-medium text-ink">{location || 'Main'}</b>
          </div>
        </div>

        <div>
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted font-semibold">
              <tr>
                <th className="py-2.5">Item / Description</th>
                <th className="py-2.5 text-right">Quantity</th>
                <th className="py-2.5 text-right">Unit Cost (incl. VAT)</th>
                <th className="py-2.5 text-right">Tax</th>
                <th className="py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {doc.lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-3 pr-2">
                    <p className="font-semibold text-ink">{l.description}</p>
                  </td>
                  <td className="py-3 text-right num font-medium">{l.quantity}</td>
                  <td className="py-3 text-right num font-medium">{ksh(l.unitCost)}</td>
                  <td className="py-3 text-right text-xs text-muted">{ksh(l.tax)}</td>
                  <td className="py-3 text-right num font-semibold">{ksh(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-end border-t border-line pt-4 space-y-1.5 text-sm">
          <div className="w-full max-w-xs flex justify-between text-muted">
            <span>Net total</span>
            <span className="num">{ksh(doc.net)}</span>
          </div>
          <div className="w-full max-w-xs flex justify-between text-muted">
            <span>VAT</span>
            <span className="num">{ksh(doc.tax)}</span>
          </div>
          <div className="w-full max-w-xs flex justify-between font-bold text-base text-ink border-t border-line pt-2">
            <span>Total</span>
            <span className="num text-lg">{ksh(doc.total)}</span>
          </div>
          {isBill && (
            <>
              <div className="w-full max-w-xs flex justify-between text-muted">
                <span>Paid</span>
                <span className="num text-good">{ksh(doc.paid)}</span>
              </div>
              <div className="w-full max-w-xs flex justify-between font-bold text-sm text-bad border-t border-line pt-1">
                <span>Balance due</span>
                <span className="num">{ksh(doc.total - doc.paid)}</span>
              </div>
            </>
          )}
        </div>

        {doc.notes && (
          <div className="rounded-lg bg-paper p-3 text-sm text-muted">
            <span className="font-semibold text-xs block mb-0.5">Notes:</span>
            {doc.notes}
          </div>
        )}
      </div>

      {payments.length > 0 && (
        <section className="card p-4 sm:p-5 print:hidden">
          <h3 className="text-sm font-semibold text-ink mb-3">Payments on this bill</h3>
          <ul className="divide-y divide-line text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div>
                  <b className="text-ink">{p.method === "Mpesa" ? "M-Pesa" : p.method}</b>
                  {p.reference && <span className="text-muted text-xs"> ({p.reference})</span>}
                  <span className="text-xs text-muted block">{dateTime(p.paidAt)}</span>
                </div>
                <b className="num text-good font-semibold">{ksh(p.amount)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PayBillModal
        open={paying}
        onClose={() => setPaying(false)}
        doc={doc}
        onPaid={() => reload()}
      />
    </div>
  );
}
