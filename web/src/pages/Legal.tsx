// Privacy notice and terms of service, written for Kenyan law (Data Protection Act 2019, Tax Procedures Act).
// Plain language first: a shop owner should understand what happens to their data and their customers' data.
// The contact email and hosting region come from the server's settings (Legal:Email, Legal:HostingRegion),
// so they're never guessed here. Have a Kenyan advocate review both before relying on them.
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useApi } from '../lib/api';

type Info = { email: string; hostingRegion: string; updated: string };

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Kabuor ERP
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
      <div className="legal mt-6 space-y-4 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
    </main>
  );
}

function useInfo(): Info {
  const { data } = useApi<Info>('/legal');
  return data ?? { email: '', hostingRegion: '', updated: '' };
}

const Contact = ({ email }: { email: string }) =>
  email ? <a className="font-semibold text-brand underline" href={`mailto:${email}`}>{email}</a> : <>the contact details on the Kabuor Builds website</>;

export function Privacy() {
  const info = useInfo();
  return (
    <Page title="Privacy notice">
      {info.updated && <p className="text-sm text-muted">Last updated {info.updated}</p>}
      <p>Kabuor ERP is run by Kabuor Builds in Kenya. This notice explains what personal data the service holds, why, who sees it, and your rights under the Data Protection Act, 2019.</p>

      <h2>Two kinds of data, two roles</h2>
      <ul>
        <li><b>Your account</b> (the business and the people who sign in): Kabuor Builds decides how this is used, so we are the <b>data controller</b>.</li>
        <li><b>The records you keep</b> (your customers, suppliers, employees, payslips, invoices): your business decides what to record and why, so your business is the <b>controller</b> and Kabuor Builds is your <b>data processor</b>. We only use it to run the service for you.</li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li>Business details: name, KRA PIN, phone, email, county, VAT status, M-Pesa shortcode.</li>
        <li>People who sign in: name, email, phone, role, a scrambled (hashed) password, and two-step sign-in settings.</li>
        <li>Records you enter: customers, invoices, payments, stock, purchases, and, if you use payroll, employee details such as ID, KRA PIN, NSSF, SHA and bank or M-Pesa details.</li>
        <li>Payment details Safaricom sends us when someone pays your Paybill or Till: the amount, M-Pesa receipt, phone number and name.</li>
        <li>Basic technical logs (time, address of the request, errors) to keep the service secure and working.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To provide the service you signed up for (contract).</li>
        <li>To meet legal duties, such as sending invoices to KRA eTIMS and keeping tax records (legal obligation).</li>
        <li>To keep accounts secure and prevent fraud (legitimate interest).</li>
        <li>Marketing messages only go to customers you have not marked as having opted out, and every campaign respects that choice.</li>
      </ul>
      <p>We do not sell personal data, and we do not use your records to advertise to anyone.</p>

      <h2>Who else sees it</h2>
      <ul>
        <li><b>Hosting</b>: our servers and database run on Railway{info.hostingRegion ? `, in ${info.hostingRegion}` : ''}. This may mean data is stored outside Kenya; we rely on the safeguards in section 48 of the Act and the provider’s security commitments.</li>
        <li><b>KRA</b>: invoices are sent to eTIMS when your business is VAT-registered.</li>
        <li><b>Safaricom</b>: when you use M-Pesa features (payment notices, prompts, subscriptions).</li>
        <li><b>Msaidizi, the assistant</b>: when you ask it something, the question and the records it needs are sent to an AI provider (Anthropic) to produce the answer. It suggests; a person approves anything that changes your books.</li>
        <li>Anyone the law requires us to share with, such as a court order.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>While your account is open. Tax law (Tax Procedures Act, section 23) requires business records to be kept for at least five years, so your business should export or keep its records for that long. When you ask us to close your account, we delete or anonymise your data within 90 days, unless you ask us to keep it longer or the law requires it.</p>

      <h2>How we protect it</h2>
      <ul>
        <li>Encrypted connections (HTTPS) and hashed passwords; secrets such as M-Pesa and KRA keys are encrypted at rest.</li>
        <li>Each business only ever sees its own records; inside a business, each role only sees what its job needs.</li>
        <li>Optional two-step sign-in, and “sign out everywhere”.</li>
        <li>Daily backups, kept separately.</li>
        <li>If a breach puts your data at real risk, we will tell the Data Commissioner within 72 hours and tell you without delay, as section 43 requires.</li>
      </ul>

      <h2>Your rights</h2>
      <p>You can ask to be told what we hold about you, get a copy, have it corrected, object to its use, or have it deleted where the law allows. For records a business keeps about you (for example as its customer or employee), ask that business first; we will help them answer. Write to <Contact email={info.email} />. We reply within 30 days.</p>
      <p>You can also complain to the Office of the Data Protection Commissioner (odpc.go.ke).</p>

      <h2>Changes</h2>
      <p>If we change this notice in a way that matters, we will tell account owners in the app before it takes effect.</p>
    </Page>
  );
}

export function Terms() {
  const info = useInfo();
  return (
    <Page title="Terms of service">
      {info.updated && <p className="text-sm text-muted">Last updated {info.updated}</p>}
      <p>These terms are an agreement between your business and Kabuor Builds for the use of Kabuor ERP. By opening an account you agree to them on behalf of your business.</p>

      <h2>The service</h2>
      <p>Kabuor ERP helps you invoice, take payments, keep stock, run payroll and keep your books. It sends invoices to KRA eTIMS and reads M-Pesa payments when you connect them. We aim to keep it available at all times but can’t promise it will never be interrupted; we tell you in the app about planned maintenance.</p>

      <h2>Free trial and paying</h2>
      <ul>
        <li>New businesses get a 30-day free trial with every feature.</li>
        <li>After the trial and 7 more days’ grace, your records stay readable and downloadable, but adding and changing them waits until you choose a plan.</li>
        <li>Plans are paid in Kenyan shillings, in advance, monthly or yearly (a year costs ten months). Prices are shown in Settings → Plan & billing; we give 30 days’ notice of any price change.</li>
        <li>Paid time is not refunded if you stop early, except where the law requires.</li>
      </ul>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Keep sign-in details private, and only give access to people who need it.</li>
        <li>The figures, tax returns and payroll you file are your responsibility. Kabuor ERP calculates PAYE, NSSF, SHA, the Housing Levy and VAT from the current rules, but check them and get professional advice where needed.</li>
        <li>You must have a lawful basis to record and message your customers and employees, and respect their opt-outs.</li>
        <li>Don’t use the service for anything illegal, or try to reach other businesses’ data.</li>
      </ul>

      <h2>Your data</h2>
      <p>Your records belong to your business. You can export them at any time. We handle personal data as described in the <Link className="font-semibold text-brand underline" to="/privacy">privacy notice</Link>, acting as your processor for the records you keep.</p>

      <h2>Liability</h2>
      <p>We are responsible for running the service with reasonable care and skill. We are not liable for indirect losses (such as lost profit) or for losses caused by information you entered, by KRA, Safaricom or other services being unavailable, or by events outside our control. Our total liability in any year is limited to what you paid us in the 12 months before the claim. Nothing here limits rights you have under the Consumer Protection Act or other law that can’t be excluded.</p>

      <h2>Ending the agreement</h2>
      <p>You can close your account at any time. We may suspend an account that breaks these terms or is unpaid after the grace period, after telling the owner. On closing, you have 30 days to export your records before they are deleted as the privacy notice describes.</p>

      <h2>Law and disputes</h2>
      <p>These terms are governed by the laws of Kenya. We will first try to settle any dispute by talking; if that fails, the courts of Kenya decide.</p>

      <h2>Contact</h2>
      <p>Questions about these terms: <Contact email={info.email} />.</p>
    </Page>
  );
}
