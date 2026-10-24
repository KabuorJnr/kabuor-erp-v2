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
      <p>Kabuor ERP is a financial software platform operated by Kabuor Technologies Ltd (with web applications designed and engineered by Kabuor Builds) in Kenya. This notice explains what personal data the service holds, why, who sees it, and your rights under the Data Protection Act, 2019.</p>

      <h2>Two kinds of data, two roles</h2>
      <ul>
        <li><b>Your account</b> (the business and the people who sign in): Kabuor Technologies decides how this is used, so we are the <b>data controller</b>.</li>
        <li><b>The records you keep</b> (your customers, suppliers, employees, payslips, invoices): your business decides what to record and why, so your business is the <b>controller</b> and Kabuor Technologies is your <b>data processor</b>. We only use it to run the service for you.</li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li>Business details: name, KRA PIN, phone, email, county, VAT status, M-Pesa shortcode.</li>
        <li>People who sign in: name, email, phone, role, a scrambled (hashed) password, and two-step sign-in settings.</li>
        <li>Records you enter: customers, invoices, payments, stock, purchases, and, if you use payroll, employee details such as ID, KRA PIN, NSSF, SHA and bank or M-Pesa details.</li>
        <li>Payment details Safaricom sends us when someone pays your Paybill or Till: the amount, M-Pesa receipt, phone number and name.</li>
        <li>Basic technical logs (time, address of the request, errors) to keep the service secure and working.</li>
        <li>If you use tracking links and the online shop: which link someone clicked, a random browser id (cookie <code>kv</code>), the link they came through (cookie <code>kref</code>), whether it was a phone, and what they asked. No advertising cookies are used. Your sign-in is kept in your browser’s storage, not a cookie.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To provide the service you signed up for (contract).</li>
        <li>To meet legal duties, such as sending invoices to KRA eTIMS and keeping tax records (legal obligation).</li>
        <li>To keep accounts secure and prevent fraud (legitimate interest).</li>
        <li>Marketing messages only go to customers you have not marked as having opted out, and every campaign respects that choice.</li>
      </ul>
      <p>We do not sell personal data, and we do not use your records to advertise to anyone.</p>
      <p><b>Profiling and automated suggestions.</b> Kabuor Intelligence groups a business’s customers (for example “best customers” or “at risk”) and its agents suggest actions such as reminders or purchase orders. These help the business decide; no decision with a legal or similarly significant effect on a person is made by the system alone. A credit limit that holds an invoice can always be overridden by a person, and you can ask the business for a human review of any decision about you (section 35 of the Act).</p>
      <p>The service is for businesses and is not meant for children under 18.</p>

      <h2>Who else sees it</h2>
      <ul>
        <li><b>Hosting</b>: the application runs on Render (Frankfurt, Germany) and the database on Neon{info.hostingRegion ? ` (${info.hostingRegion})` : ''}. Data is therefore stored outside Kenya.</li>
        <li><b>KRA</b> (Kenya): invoices are sent to eTIMS when your business is VAT-registered.</li>
        <li><b>Safaricom</b> (Kenya): when you use M-Pesa features (payment notices, prompts, subscriptions).</li>
        <li><b>Africa’s Talking</b> (Kenya): to send sign-in codes and messages by SMS, when SMS is switched on.</li>
        <li><b>Anthropic</b> (United States), for Msaidizi and the agents: the question and the records needed to answer it are sent to produce the answer. It suggests; a person approves anything that changes your books.</li>
        <li><b>GitHub</b> (United States): the nightly database backup, encrypted before it leaves our servers and kept 30 days.</li>
        <li><b>Sentry</b>: error reports, set up not to include personal data such as names, emails or request addresses.</li>
        <li>Anyone the law requires us to share with, such as a court order.</li>
      </ul>
      <p><b>Transfers outside Kenya.</b> We only send personal data abroad on the grounds in sections 48 and 49 of the Act and regulations 40 and 41: under written terms with each provider that bind them to protect it, to providers whose security we have assessed, and only what the service needs. We keep a record of each kind of transfer and give it to the Data Commissioner on request.</p>

      <h2>How long we keep it</h2>
      <p>While your account is open, reviewed at least once a year (regulation 19). Tax law (Tax Procedures Act, section 23) requires business records to be kept for at least five years, so your business should export or keep its records for that long. When you ask us to close your account, we delete or anonymise your data within 90 days, unless you ask us to keep it longer or the law requires it.</p>

      <h2>How we protect it</h2>
      <ul>
        <li>Encrypted connections (HTTPS) and hashed passwords; secrets such as M-Pesa and KRA keys are encrypted at rest.</li>
        <li>Each business only ever sees its own records; inside a business, each role only sees what its job needs.</li>
        <li>Optional two-step sign-in, and “sign out everywhere”.</li>
        <li>Daily backups, kept separately.</li>
        <li>If a breach puts personal data at real risk, we tell the Data Commissioner within 72 hours and the people affected without delay (section 43). For records we process for a business, we tell that business within 48 hours so it can do the same.</li>
      </ul>

      <h2>Your rights</h2>
      <p>You can ask to be told what we hold about you, get a copy, have it corrected, move it to another provider, object to its use, stop direct marketing, or have it deleted where the law allows. For records a business keeps about you (for example as its customer or employee), ask that business first; the app lets it send you your data and erase it, and we help it answer. Write to <Contact email={info.email} />.</p>
      <p>The law sets how fast we answer (Data Protection (General) Regulations, 2021): a copy of your data within <b>7 days</b>; correction within <b>14 days</b>; erasure within <b>14 days</b>; stopping direct marketing within <b>7 days</b>; moving your data to another provider within <b>30 days</b>. Records that tax or employment law requires a business to keep (such as issued invoices) can’t be erased until that period ends; we tell you what was kept and why.</p>
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
      <p>These terms are an agreement between your business and Kabuor Technologies Ltd (operator of Kabuor ERP, with web applications engineered by Kabuor Builds) for the use of Kabuor ERP. By opening an account you agree to them on behalf of your business.</p>

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

      <h2>Processing personal data for you</h2>
      <p>For the records you keep, your business is the data controller and Kabuor Technologies is your data processor. These terms are the written contract that section 42 of the Data Protection Act and regulation 24 require:</p>
      <ul>
        <li><b>What, how long and why</b>: we process your customers’, suppliers’, leads’ and employees’ details (names, phone numbers, emails, KRA PINs, ID and NSSF/SHA numbers, pay and bank or M-Pesa details, invoices, payments and messages) for as long as your account is open, only to provide the service.</li>
        <li><b>Your instructions</b>: we act only on your instructions, given through the app and these terms. If we think an instruction breaks the law, we tell you.</li>
        <li><b>Confidentiality</b>: everyone who works on the service is bound to keep your data confidential.</li>
        <li><b>Security</b>: the technical and organisational measures in the privacy notice, kept up to date.</li>
        <li><b>Sub-processors</b>: you authorise the providers listed in the privacy notice. We give you 30 days’ notice in the app before adding or replacing one, so you can object; each is bound by written terms like these, and we stay responsible for them (regulation 25).</li>
        <li><b>Helping you</b>: we help you answer people’s requests, carry out impact assessments, and handle breaches, which we report to you within 48 hours of becoming aware.</li>
        <li><b>At the end</b>: when the agreement ends you choose to take your records or have them returned; after 30 days we delete them, except where the law requires us to keep them.</li>
        <li><b>Audit</b>: on reasonable notice, we give you the information you need to check we meet these terms, including the results of our security reviews.</li>
      </ul>
      <p><b>Schools and health providers</b>: the law requires personal data from basic education and from primary or secondary health care to be processed in Kenya or to keep a copy there (regulation 26). Kabuor is hosted outside Kenya, so don’t use it for learners’ or patients’ records until Kenya hosting is offered.</p>

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
