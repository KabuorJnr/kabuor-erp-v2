import { useState } from 'react';
import { Link } from 'react-router';
import {
  CheckCircle2,
  Sparkles,
  Smartphone,
  Store,
  Download,
  Loader2,
  Check,
  ArrowRight,
} from 'lucide-react';
import { api, useApi } from '../lib/api';
import { cn, ksh } from '../lib/format';
import { ErrorNote, Field } from './ui';

export type OnboardingStatus = {
  isNewBusiness: boolean;
  hasCustomers: boolean;
  hasItems: boolean;
  hasInvoices: boolean;
  hasMpesaConfigured: boolean;
  completionPercentage: number;
};

export default function OnboardingWizard({ onComplete }: { onComplete?: () => void }) {
  const { data: status, reload, loading } = useApi<OnboardingStatus>('/onboarding/status');
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [dismissed, setDismissed] = useState(false);

  // Step 1 Quickstart Form
  const [qf, setQf] = useState({
    customerName: 'Mama Jane General Stores',
    customerPhone: '0712345678',
    customerEmail: 'jane@example.com',
    itemName: 'Fresh Maize Flour 2kg',
    itemPrice: 22000, // in cents (KSh 220)
    quantity: 5,
    paymentMethod: 'Mpesa',
    mpesaReceipt: 'QKB9876543',
  });
  const [qfBusy, setQfBusy] = useState(false);
  const [qfError, setQfError] = useState('');
  const [qfDone, setQfDone] = useState(false);

  // Step 2 Shortcode Form
  const [shortcode, setShortcode] = useState('');
  const [shortcodeBusy, setShortcodeBusy] = useState(false);
  const [shortcodeError, setShortcodeError] = useState('');
  const [shortcodeDone, setShortcodeDone] = useState(false);

  // Step 3 Subscription Form
  const [plan, setPlan] = useState<'starter' | 'business' | 'growth'>('business');
  const [billingPhone, setBillingPhone] = useState('0712345678');
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingMsg, setBillingMsg] = useState('');
  const [billingError, setBillingError] = useState('');

  if (loading && !status) return null;
  if (!status || (status.completionPercentage === 100 && !qfDone) || dismissed) return null;

  const submitQuickstart = async (e: React.FormEvent) => {
    e.preventDefault();
    setQfBusy(true);
    setQfError('');
    try {
      await api('/onboarding/quickstart', { body: qf });
      setQfDone(true);
      reload();
      setActiveStep(2);
      onComplete?.();
    } catch (err) {
      setQfError((err as Error).message);
    } finally {
      setQfBusy(false);
    }
  };

  const submitShortcode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortcode.trim()) return;
    setShortcodeBusy(true);
    setShortcodeError('');
    try {
      await api('/settings/company', { body: { mpesaShortcode: shortcode.trim() } });
      setShortcodeDone(true);
      reload();
      setActiveStep(3);
    } catch (err) {
      setShortcodeError((err as Error).message);
    } finally {
      setShortcodeBusy(false);
    }
  };

  const submitSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillingBusy(true);
    setBillingError('');
    setBillingMsg('');
    try {
      const res = await api<{ status: string; phone: string }>('/settings/billing/pay', {
        body: { plan, months: 1, phone: billingPhone },
      });
      setBillingMsg(
        res.status === 'Paid'
          ? 'Payment confirmed! Your subscription is now active.'
          : `Check ${res.phone || billingPhone} for the M-Pesa STK prompt and enter your PIN.`
      );
      reload();
    } catch (err) {
      setBillingError((err as Error).message);
    } finally {
      setBillingBusy(false);
    }
  };

  return (
    <div className="card relative mb-6 overflow-hidden border-2 border-brand/20 bg-gradient-to-br from-white via-white to-brand/5 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">
              Welcome! Get your business selling in under 3 minutes
            </h2>
            <p className="text-xs text-muted">
              Complete these 3 simple steps to issue your first eTIMS invoice and automate M-Pesa payments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs font-semibold text-muted uppercase">Progress</span>
            <div className="text-sm font-bold text-brand">{status.completionPercentage}% Done</div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-muted hover:text-ink hover:underline"
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="my-4 h-2 w-full overflow-hidden rounded-full bg-line/60">
        <div
          className="h-full bg-brand transition-all duration-500 ease-out"
          style={{ width: `${Math.max(status.completionPercentage, 10)}%` }}
        />
      </div>

      {/* Steps Navigation Tabs */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          onClick={() => setActiveStep(1)}
          className={cn(
            'flex items-center gap-3 rounded-lg border p-3 text-left transition',
            activeStep === 1
              ? 'border-brand bg-brand-soft font-semibold text-brand'
              : status.hasInvoices
              ? 'border-line bg-white/70 text-ink-2'
              : 'border-line/70 bg-white/40 text-muted hover:border-brand/40'
          )}
        >
          <div
            className={cn(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold',
              status.hasInvoices
                ? 'bg-good text-white'
                : activeStep === 1
                ? 'bg-brand text-white'
                : 'bg-line text-muted'
            )}
          >
            {status.hasInvoices ? <Check className="h-3.5 w-3.5" /> : '1'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">1. First Product & Sale</p>
            <p className="truncate text-[11px] text-muted">Customer & eTIMS invoice</p>
          </div>
        </button>

        <button
          onClick={() => setActiveStep(2)}
          className={cn(
            'flex items-center gap-3 rounded-lg border p-3 text-left transition',
            activeStep === 2
              ? 'border-brand bg-brand-soft font-semibold text-brand'
              : status.hasMpesaConfigured
              ? 'border-line bg-white/70 text-ink-2'
              : 'border-line/70 bg-white/40 text-muted hover:border-brand/40'
          )}
        >
          <div
            className={cn(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold',
              status.hasMpesaConfigured
                ? 'bg-good text-white'
                : activeStep === 2
                ? 'bg-brand text-white'
                : 'bg-line text-muted'
            )}
          >
            {status.hasMpesaConfigured ? <Check className="h-3.5 w-3.5" /> : '2'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">2. M-Pesa Integration</p>
            <p className="truncate text-[11px] text-muted">Paybill or Till shortcode</p>
          </div>
        </button>

        <button
          onClick={() => setActiveStep(3)}
          className={cn(
            'flex items-center gap-3 rounded-lg border p-3 text-left transition',
            activeStep === 3
              ? 'border-brand bg-brand-soft font-semibold text-brand'
              : 'border-line/70 bg-white/40 text-muted hover:border-brand/40'
          )}
        >
          <div
            className={cn(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold',
              activeStep === 3 ? 'bg-brand text-white' : 'bg-line text-muted'
            )}
          >
            3
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">3. Platform Subscription</p>
            <p className="truncate text-[11px] text-muted">M-Pesa STK push checkout</p>
          </div>
        </button>
      </div>

      {/* Step Contents */}
      <div className="mt-5 rounded-xl border border-line bg-white p-5 shadow-xs">
        {activeStep === 1 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-ink">Sell your first item in 60 seconds</h3>
                <p className="text-xs text-muted">
                  Create your first customer, inventory item, and eTIMS tax invoice in one instant click.
                </p>
              </div>
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">
                eTIMS Ready
              </span>
            </div>

            {qfDone ? (
              <div className="rounded-lg bg-good/10 p-4 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-good" />
                <h4 className="font-bold text-good">First Invoice Successfully Issued!</h4>
                <p className="mt-1 text-xs text-ink-2">
                  Customer, product, and tax invoice were created and payment was matched.
                </p>
                <button
                  onClick={() => setActiveStep(2)}
                  className="btn btn-primary mt-3 text-xs"
                >
                  Continue to Step 2: Connect M-Pesa <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <form onSubmit={submitQuickstart} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Customer name">
                    <input
                      className="field text-sm"
                      required
                      value={qf.customerName}
                      onChange={(e) => setQf({ ...qf, customerName: e.target.value })}
                    />
                  </Field>
                  <Field label="Customer phone">
                    <input
                      className="field text-sm"
                      required
                      value={qf.customerPhone}
                      onChange={(e) => setQf({ ...qf, customerPhone: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Product / Service name">
                    <input
                      className="field text-sm"
                      required
                      value={qf.itemName}
                      onChange={(e) => setQf({ ...qf, itemName: e.target.value })}
                    />
                  </Field>
                  <Field label="Price (KSh)">
                    <input
                      className="field text-sm"
                      type="number"
                      required
                      value={qf.itemPrice / 100}
                      onChange={(e) =>
                        setQf({ ...qf, itemPrice: Math.round(Number(e.target.value) * 100) })
                      }
                    />
                  </Field>
                  <Field label="Quantity">
                    <input
                      className="field text-sm"
                      type="number"
                      min={1}
                      required
                      value={qf.quantity}
                      onChange={(e) => setQf({ ...qf, quantity: Number(e.target.value) })}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Payment method">
                    <select
                      className="field text-sm"
                      value={qf.paymentMethod}
                      onChange={(e) => setQf({ ...qf, paymentMethod: e.target.value })}
                    >
                      <option value="Mpesa">M-Pesa</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank Transfer</option>
                    </select>
                  </Field>
                  <Field label="M-Pesa reference code (optional)">
                    <input
                      className="field text-sm font-mono uppercase"
                      value={qf.mpesaReceipt}
                      onChange={(e) => setQf({ ...qf, mpesaReceipt: e.target.value.toUpperCase() })}
                      placeholder="e.g. QKB1234567"
                    />
                  </Field>
                </div>

                {qfError && <ErrorNote>{qfError}</ErrorNote>}

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted">
                    Total: <b className="text-ink">{ksh((qf.itemPrice * qf.quantity))}</b>
                  </span>
                  <button className="btn btn-primary" disabled={qfBusy}>
                    {qfBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Issue Invoice & Match Payment
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeStep === 2 && (
          <div>
            <div className="mb-4">
              <h3 className="font-display font-bold text-ink">Connect your M-Pesa Paybill or Till</h3>
              <p className="text-xs text-muted">
                Incoming payments from Safaricom will automatically reconcile and close open customer invoices.
              </p>
            </div>

            {shortcodeDone || status.hasMpesaConfigured ? (
              <div className="rounded-lg bg-good/10 p-4 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-good" />
                <h4 className="font-bold text-good">M-Pesa Shortcode Connected!</h4>
                <p className="mt-1 text-xs text-ink-2">
                  Automated callbacks will route payments straight to your accounting ledger.
                </p>
                <button
                  onClick={() => setActiveStep(3)}
                  className="btn btn-primary mt-3 text-xs"
                >
                  Continue to Step 3: Subscription <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <form onSubmit={submitShortcode} className="space-y-4">
                <Field
                  label="Business Shortcode"
                  hint="Your 5-7 digit Safaricom Paybill or Buy Goods Till number."
                >
                  <input
                    className="field text-sm font-mono"
                    required
                    value={shortcode}
                    onChange={(e) => setShortcode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 522522 or 987654"
                    maxLength={7}
                  />
                </Field>

                {shortcodeError && <ErrorNote>{shortcodeError}</ErrorNote>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="btn btn-secondary text-xs"
                  >
                    Skip for now
                  </button>
                  <button className="btn btn-primary text-xs" disabled={shortcodeBusy}>
                    {shortcodeBusy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Save Shortcode
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeStep === 3 && (
          <div>
            <div className="mb-4">
              <h3 className="font-display font-bold text-ink">Activate Automated Platform Subscription</h3>
              <p className="text-xs text-muted">
                Receive an automated M-Pesa STK prompt on your phone to unlock full multi-user access.
              </p>
            </div>

            <form onSubmit={submitSubscription} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label
                  className={cn(
                    'relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 text-left transition',
                    plan === 'starter'
                      ? 'border-brand bg-brand-soft ring-2 ring-brand'
                      : 'border-line hover:border-brand/40'
                  )}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="starter"
                    className="sr-only"
                    checked={plan === 'starter'}
                    onChange={() => setPlan('starter')}
                  />
                  <div>
                    <span className="font-bold text-ink">Starter</span>
                    <p className="mt-1 font-display text-xl font-bold text-brand">KSh 1,500<span className="text-xs font-normal text-muted">/mo</span></p>
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      <li>✓ Invoices, POS & Quotes</li>
                      <li>✓ eTIMS Ready</li>
                      <li>✓ 3 Users</li>
                    </ul>
                  </div>
                </label>

                <label
                  className={cn(
                    'relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 text-left transition',
                    plan === 'business'
                      ? 'border-brand bg-brand-soft ring-2 ring-brand'
                      : 'border-line hover:border-brand/40'
                  )}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="business"
                    className="sr-only"
                    checked={plan === 'business'}
                    onChange={() => setPlan('business')}
                  />
                  <div className="absolute -top-2.5 right-3 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-ink uppercase">
                    Popular
                  </div>
                  <div>
                    <span className="font-bold text-ink">Business</span>
                    <p className="mt-1 font-display text-xl font-bold text-brand">KSh 4,500<span className="text-xs font-normal text-muted">/mo</span></p>
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      <li>✓ Everything in Starter</li>
                      <li>✓ Payroll & Staff Portal</li>
                      <li>✓ AI Agents & 15 Users</li>
                    </ul>
                  </div>
                </label>

                <label
                  className={cn(
                    'relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 text-left transition',
                    plan === 'growth'
                      ? 'border-brand bg-brand-soft ring-2 ring-brand'
                      : 'border-line hover:border-brand/40'
                  )}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="growth"
                    className="sr-only"
                    checked={plan === 'growth'}
                    onChange={() => setPlan('growth')}
                  />
                  <div>
                    <span className="font-bold text-ink">Growth</span>
                    <p className="mt-1 font-display text-xl font-bold text-brand">KSh 9,500<span className="text-xs font-normal text-muted">/mo</span></p>
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      <li>✓ Unlimited Users & Staff</li>
                      <li>✓ Multi-Branch & Store</li>
                      <li>✓ Priority WhatsApp Care</li>
                    </ul>
                  </div>
                </label>
              </div>

              <Field label="M-Pesa Phone Number" hint="Safaricom number to receive the PIN prompt.">
                <input
                  className="field text-sm"
                  required
                  value={billingPhone}
                  onChange={(e) => setBillingPhone(e.target.value)}
                  placeholder="0712 345 678"
                />
              </Field>

              {billingError && <ErrorNote>{billingError}</ErrorNote>}
              {billingMsg && (
                <div className="rounded-lg bg-good/10 p-3 text-xs font-semibold text-good">
                  {billingMsg}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <Link to="/settings?tab=plan" className="text-xs text-muted hover:underline">
                  Manage billing in settings
                </Link>
                <button className="btn btn-primary" disabled={billingBusy}>
                  {billingBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Smartphone className="mr-1.5 h-4 w-4" /> Send M-Pesa STK Prompt
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* POS Offline Kiosk App Callout Banner */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink px-4 py-3 text-white">
        <div className="flex items-center gap-2.5">
          <Store className="h-5 w-5 text-gold" />
          <span className="text-xs font-medium">
            Running a retail shop or supermarket? Install the <b>Offline POS App</b> on this device to keep selling when internet drops.
          </span>
        </div>
        <Link
          to="/pos"
          className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
        >
          <Download className="h-3.5 w-3.5" /> Open Till & Install
        </Link>
      </div>
    </div>
  );
}
