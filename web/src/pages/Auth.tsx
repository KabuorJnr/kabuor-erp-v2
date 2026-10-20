import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Check, Loader2 } from 'lucide-react';
import { api, setSession, type Session } from '../lib/api';
import { ErrorNote, Field } from '../components/ui';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-indigo/40 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <img src="/mark.svg" alt="" className="h-9 w-9" />
          <span className="font-display text-lg font-bold">Kabuor ERP</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-display text-5xl leading-[1.05] font-bold tracking-tight">Run the whole business from one place.</h1>
          <ul className="mt-8 space-y-3 text-[15px] text-white/80">
            {['M-Pesa payments match your invoices by themselves', 'Every invoice ready for KRA eTIMS', 'Ask Msaidizi in English or Kiswahili', 'Works on your phone, for the whole team'].map((x) => (
              <li key={x} className="flex gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-gold" /> {x}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/50">A Kabuor Builds product · Made in Kenya</p>
      </section>
      <section className="grid place-items-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/mark.svg" alt="" className="h-8 w-8" />
            <span className="font-display font-bold">Kabuor ERP</span>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}

export function SignIn() {
  const [f, setF] = useState({ email: '', password: '' });
  const [state, setState] = useState({ busy: false, error: '' });
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      const r = await api<Session | { needsCode: true; challenge: string }>('/auth/login', { body: f });
      if ('needsCode' in r) {
        setChallenge(r.challenge);
        setState({ busy: false, error: '' });
      } else setSession(r);
    } catch (err) {
      setState({ busy: false, error: (err as Error).message });
    }
  };
  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      setSession(await api<Session>('/auth/login/code', { body: { challenge, code } }));
    } catch (err) {
      const message = (err as Error).message;
      if (/password again|too long/i.test(message)) setChallenge(null);
      setState({ busy: false, error: message });
    }
  };
  if (challenge)
    return (
      <Frame>
        <h1 className="font-display text-3xl font-bold tracking-tight">Enter your code</h1>
        <p className="mt-1 text-sm text-muted">{recovery ? 'Type one of the recovery codes you saved. Each works once.' : 'Open your authenticator app and type the 6-digit code for Kabuor ERP.'}</p>
        <form onSubmit={submitCode} className="mt-8 space-y-4">
          <Field label={recovery ? 'Recovery code' : 'Code'}>
            {recovery ? (
              <input className="field font-mono" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} placeholder="abcd-2345" autoComplete="off" />
            ) : (
              <input className="field num text-center font-display text-2xl tracking-[0.4em]" autoFocus required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
            )}
          </Field>
          {state.error && <ErrorNote>{state.error}</ErrorNote>}
          <button className="btn btn-primary w-full py-3" disabled={state.busy || (!recovery && code.length !== 6)}>
            {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
          </button>
        </form>
        <div className="mt-6 flex justify-between text-sm">
          <button onClick={() => (setRecovery(!recovery), setCode(''), setState({ busy: false, error: '' }))} className="font-semibold text-brand hover:underline">
            {recovery ? 'Use the app code instead' : 'Lost your phone? Use a recovery code'}
          </button>
          <button onClick={() => (setChallenge(null), setCode(''))} className="text-muted hover:underline">
            Back
          </button>
        </div>
      </Frame>
    );
  return (
    <Frame>
      <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in to your business.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Email or phone" hint="Staff sign in with the phone number HR registered.">
          <input className="field" type="text" inputMode="email" autoComplete="username" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@business.co.ke or 0712 345 678" />
        </Field>
        <Field label="Password">
          <input className="field" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        {state.error && <ErrorNote>{state.error}</ErrorNote>}
        <button className="btn btn-primary w-full py-3" disabled={state.busy}>
          {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{' '}
        <Link to="/signup" className="font-semibold text-brand hover:underline">
          Open your business account
        </Link>
      </p>
    </Frame>
  );
}

export function SignUp() {
  const [f, setF] = useState({ companyName: '', ownerName: '', email: '', phone: '', password: '', kraPin: '', vatRegistered: true });
  const [state, setState] = useState({ busy: false, error: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      setSession(await api<Session>('/auth/register', { body: { ...f, kraPin: f.kraPin.trim().toUpperCase() } }));
    } catch (err) {
      setState({ busy: false, error: (err as Error).message });
    }
  };
  return (
    <Frame>
      <h1 className="font-display text-3xl font-bold tracking-tight">Open your business account</h1>
      <p className="mt-1 text-sm text-muted">Two minutes. You can add your team after.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <Field label="Business name">
          <input className="field" required value={f.companyName} onChange={set('companyName')} placeholder="e.g. Mama Pili Sauces Ltd" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name">
            <input className="field" required autoComplete="name" value={f.ownerName} onChange={set('ownerName')} />
          </Field>
          <Field label="Phone">
            <input className="field" required inputMode="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="0712 345 678" />
          </Field>
        </div>
        <Field label="Email">
          <input className="field" type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="At least 10 characters.">
          <input className="field" type="password" required minLength={10} autoComplete="new-password" value={f.password} onChange={set('password')} />
        </Field>
        <Field label="Company KRA PIN" hint="Needed to sign invoices with eTIMS. You can add it later.">
          <input className="field uppercase" value={f.kraPin} onChange={set('kraPin')} placeholder="P051234567X" maxLength={11} />
        </Field>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={f.vatRegistered} onChange={set('vatRegistered')} />
          We’re registered for VAT
        </label>
        {state.error && <ErrorNote>{state.error}</ErrorNote>}
        <button className="btn btn-primary w-full py-3" disabled={state.busy}>
          {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Open my account
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have one?{' '}
        <Link to="/" className="font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </Frame>
  );
}

/** After HR (or the owner) set someone's password, they choose their own before anything else. */
export function ChooseOwnPassword({ session }: { session: Session }) {
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [state, setState] = useState({ busy: false, error: '' });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.next !== f.again) return setState({ busy: false, error: 'The two new passwords don’t match.' });
    setState({ busy: true, error: '' });
    try {
      setSession(await api<Session>('/auth/password', { body: { current: f.current, new: f.next } }));
    } catch (err) {
      setState({ busy: false, error: (err as Error).message });
    }
  };
  return (
    <Frame>
      <h1 className="font-display text-3xl font-bold tracking-tight">Choose your own password</h1>
      <p className="mt-1 text-sm text-muted">Hi {session.user.name.split(' ')[0]}. The password you were given only works once. Pick one only you know.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Password you were given">
          <input className="field" type="password" autoComplete="current-password" required value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
        </Field>
        <Field label="New password" hint="At least 10 characters. A short sentence is easy to remember.">
          <input className="field" type="password" autoComplete="new-password" required minLength={10} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
        </Field>
        <Field label="New password again">
          <input className="field" type="password" autoComplete="new-password" required minLength={10} value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} />
        </Field>
        {state.error && <ErrorNote>{state.error}</ErrorNote>}
        <button className="btn btn-primary w-full py-3" disabled={state.busy}>
          {state.busy && <Loader2 className="h-4 w-4 animate-spin" />} Save and continue
        </button>
      </form>
      <button onClick={() => setSession(null)} className="mt-6 w-full text-center text-sm text-muted hover:underline">
        Sign out
      </button>
    </Frame>
  );
}
