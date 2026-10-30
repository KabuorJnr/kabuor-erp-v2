# Implementation brief: Kabuor Verified (proof of M-Pesa revenue and eTIMS compliance for lenders)

Hand this whole document to the developer or AI session doing the work. It is self-contained.

## 1. Goal, in one paragraph

Lenders in Kenya will fund a merchant who can **prove** steady M-Pesa revenue (for example KSh 300k a month) and
eTIMS compliance. They don't trust a merchant's own books, because the merchant typed them. Kabuor ERP sits on the
two sources lenders do trust: Safaricom (M-Pesa confirmations and prompt results) and KRA (eTIMS-signed invoices).
Build **Kabuor Verified**: the system works out verified figures automatically, and **the business owner alone**
decides who sees them, what they see and for how long. Lenders get a link (and QR) to a live, tamper-evident page
of totals, never customer details. Every share is recorded as consent.

## 2. Ground rules (read before writing code)

- Repository: `KabuorJnr/kabuor-erp-v2` (ASP.NET Core minimal APIs on .NET 10, EF Core, Postgres/Neon in production
  and SQLite in tests; React 19 + TypeScript + Tailwind 4 web app in `web/`).
- Branch from `main` for each PR. Commit with
  `git -c user.name="David Kiragu" -c user.email="173531629+vitamind38@users.noreply.github.com" commit ...`
  (never change global git config). End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  and PR bodies with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Match the codebase's style: short comments that say *why*, plain-English user copy, no jargon in the UI.
- UI work follows the staff-level UX rules: design for the owner's decision ("Is my business ready to borrow, and
  who can see my figures?"), show context on every number, say what each action will do before it happens.
- Every new migration: `dotnet ef migrations add <Name> --project src/Kabuor.Erp.Api --output-dir Data/Migrations`,
  then read it. CI fails if the model and migrations disagree.
- Run the full test suite (`dotnet test tests/Kabuor.Erp.Tests`) and `npx tsc --noEmit -p web` before each PR.
  Stop any locally running API first (it locks the build).
- Don't poll CI. Open the PR, report its link.

### Legal and regulatory boundaries (non-negotiable)

- **Facts, not scores.** Kabuor shows verified facts (money in, payer counts, signing rates). It does not produce
  credit scores, risk grades or lending decisions. Scoring belongs to lenders and licensed credit bureaus
  (CRB Regulations 2020, CBK Digital Credit Provider rules).
- **Consent per share** (Data Protection Act 2019, sections 30 and 32): explicit, purpose-limited, time-limited,
  revocable, and recorded.
- **Data minimisation:** lenders see totals and counts only. Never customer names, phone numbers or invoice lines.
  Payer identities may be counted but never shown.
- **Only the owner** can create or revoke a share. The accountant may view the proof page (to help prepare it) but
  not share. Other roles don't see the section.

## 3. What exists today (verified by reading the code)

Payments are created in these places, all through `PaymentService.Record(PaymentInput input, string actor)`
(`src/Kabuor.Erp.Api/Payments/PaymentService.cs`):

| Where | How it arrives | Today's `actor` / clue |
|---|---|---|
| `Endpoints.cs` `POST /api/payments` | typed by a person on Money in | user's name |
| `PaymentService.FromMpesa` via `POST /api/mpesa/c2b/{key}/confirmation` | Safaricom C2B confirmation | `"M-Pesa"`; audit actor `M-Pesa` |
| `Payments/Stk.cs` `Callback` via `POST /api/mpesa/stk/{key}` | M-Pesa prompt (STK) result | `"M-Pesa prompt"`; allocation `MatchedBy = "user: M-Pesa prompt"` |
| `Accounting/Statements.cs` `RecordPayment` | a line from an uploaded statement CSV | user's name; `StatementLine.MatchKind = "Payment"`, `MatchId = payment id` |
| `Integrations/Integrations.cs` (public API orders) | reported by a connected system | `"API"`; allocation `MatchedBy = "user: API"` |
| `PosEndpoints.cs` (till) | cashier at the till | cashier's name; reference ends `-POS` |
| `Data/EnterpriseDemoSeeder.cs` | demo data | n/a |

`Payment` entity (`Domain/Entities.cs`) has `Method`, `Amount`, `ReceivedAt`, `Reference`, `PayerPhone`, `PayerName`,
`AccountRef`, `CustomerId`, `Status`, `Allocations`. **Nothing records how the payment arrived.** A payment typed as
"M-Pesa" looks the same as one Safaricom confirmed.

eTIMS: `SalesDoc.EtimsStatus` (`Signed`, `Pending`, `Failed`, `NotRequired`), `EtimsControlCode`, `EtimsInvoiceNo`,
`EtimsQrUrl`. Sandbox signatures have control codes starting `TEST-`. Live signing waits on KRA certification.

Audit: `AuditEntry` (`Actor`, `Action` = `Added|Modified|Deleted`, `Entity`, `EntityId`, `Changes`), written by
`ErpDb.StampAndAudit`.

Two-step sign-in exists (`Auth.cs`: `TwoFactorInput(Code, Password)`, TOTP via `Totp.Match`). Reuse it for re-auth.

Forwarded headers (`Program.cs`): `XForwardedFor`, `ForwardLimit = 2`, known networks are private ranges only, so
`HttpContext.Connection.RemoteIpAddress` is the real caller behind the host's proxy and a client can't spoof it by
sending its own `X-Forwarded-For`.

### The security gap that matters most for lenders

The C2B confirmation URL is protected only by a secret key in the path, and the **owner can see that URL** in
Settings (they paste it into Safaricom's portal). A merchant could POST fake "Safaricom" confirmations to their own
URL and inflate their figures. STK results are harder to fake (they must match a `CheckoutRequestID` we created), but
use the same URL-secret pattern. **Fix: record the caller's IP on every M-Pesa callback and only count payments whose
callback came from Safaricom's published callback addresses as "confirmed by Safaricom".**

## 4. Delivery: three PRs, in order

---

### PR 1: Label every payment with its source (and make "confirmed by Safaricom" unforgeable)

**Data model** (`Domain/Entities.cs`):

```csharp
/// <summary>How a payment reached the books. Only Safaricom-sourced ones from Safaricom's servers count as proof.</summary>
public enum PaymentSource { Unknown, Manual, Till, StatementImport, ConnectedSystem, MpesaConfirmation, MpesaPrompt }
```

Add to `Payment`:
- `PaymentSource Source` (default `Unknown` so existing rows are visibly unlabelled until backfilled)
- `string CallbackIp` (default `""`): the IP that delivered an M-Pesa callback
- `bool FromSafaricom` (default `false`): true only when `Source` is `MpesaConfirmation` or `MpesaPrompt` **and**
  `CallbackIp` is one of Safaricom's callback addresses

Migration: `PaymentSource`. Index `(CompanyId, Source, ReceivedAt)` for the summaries in PR 2.

**Safaricom callback addresses** (`Payments/SafaricomCallers.cs`, new):
- `public static bool IsSafaricom(IPAddress? ip, IConfiguration config)`.
- Read the allowed list from configuration `Mpesa:CallbackIps` (comma-separated IPs or CIDRs), with a built-in
  default of Safaricom's published Daraja callback IPs. **Verify the current list against Safaricom's Daraja
  documentation before shipping** (at the time of writing it included 196.201.214.200, 196.201.214.206,
  196.201.213.114, 196.201.214.207, 196.201.214.208, 196.201.213.44, 196.201.212.127, 196.201.212.138,
  196.201.212.129, 196.201.212.136, 196.201.212.74, 196.201.212.69).
- Handle IPv4-mapped IPv6 (`::ffff:a.b.c.d`). A null IP is never Safaricom.

**Setting the source at every entry point.** The client must never be able to choose the source, so do **not** put
`Source` on `PaymentInput` (it's the public request body of `POST /api/payments`). Instead extend the service:

```csharp
public async Task<Payment> Record(PaymentInput input, string actor, PaymentSource source = PaymentSource.Manual, string? callbackIp = null)
```

- `POST /api/payments` → `Manual` (default).
- `FromMpesa(MpesaC2B c, string? callbackIp)` → `MpesaConfirmation`, IP from the endpoint's `HttpContext`.
- `StkService.Callback(Company, JsonObject, string? callbackIp)` → `MpesaPrompt`.
- `Statements.RecordPayment` → `StatementImport`.
- `Integrations` order payment → `ConnectedSystem`.
- `PosEndpoints` till payment → `Till`.
- Demo seeder: `Manual` (demo data is never proof).
- `FromSafaricom = source is MpesaConfirmation or MpesaPrompt && SafaricomCallers.IsSafaricom(ip)`.
- When a callback arrives from a non-Safaricom address, still record the payment (don't lose money), but log a
  warning with the company id and IP, and leave `FromSafaricom = false`.

**Backfill existing payments** (one-shot, idempotent, runs at start-up after migrations; e.g.
`Payments/PaymentSourceBackfill.cs` as a hosted service that exits when done, skipped when
`Retention:Disabled`/test setting says so). Process rows with `Source == Unknown` across all companies
(`IgnoreQueryFilters`), in this order, first match wins:
1. Reference equals an uppercased `MpesaRequest.Receipt` with status `Paid` → `MpesaPrompt`.
2. An `AuditEntry` with `Entity == "Payment"`, `Action == "Added"`, `Actor == "M-Pesa"` and `EntityId` equal to the
   payment id (compare GUIDs parsed in C#, not as strings, because SQLite and Postgres format them differently)
   → `MpesaConfirmation`.
3. A `PaymentAllocation` with `MatchedBy == "user: API"` → `ConnectedSystem`.
4. A `StatementLine` with `MatchKind == "Payment"` and `MatchId == payment id` that created it (the payment's
   `Reference` equals the line's reference or starts with `STMT-`) → `StatementImport`.
5. Reference ends with `-POS` → `Till`.
6. Otherwise → `Manual`.

Legacy rows keep `FromSafaricom = false` (no IP was recorded). Update in chunks of 500 with `ExecuteUpdateAsync`.

**API:** include `source`, `fromSafaricom` in `GET /api/payments` rows and `GET /api/payments/{id}`. Never include
`callbackIp` in normal responses (show it only to the owner on the payment detail, as "Delivered from <ip>").

**UI** (`web/src/pages/Payments.tsx`, invoice payment lists): a small label under each payment, in this wording:

| Condition | Label | Tone |
|---|---|---|
| `fromSafaricom` | Confirmed by Safaricom | good (green) |
| M-Pesa source, `callbackIp` empty | From M-Pesa (before address checks) | muted |
| M-Pesa source, not from Safaricom | Not from Safaricom’s servers | bad (red) |
| `StatementImport` | From a statement upload | muted |
| `ConnectedSystem` | Reported by a connected app | muted |
| `Till` | Recorded at the till | muted |
| `Manual` | Entered by hand | muted |
| `Unknown` | Source not yet known | muted |

Add a filter chip on Money in: **Confirmed by Safaricom (n)**.

**Tests** (`tests/Kabuor.Erp.Tests/PaymentSourceTests.cs`):
- Manual `POST /api/payments` → `Source = Manual`, `FromSafaricom = false`, even if the JSON body includes
  `source: "MpesaConfirmation"` or `fromSafaricom: true` (they must be ignored).
- C2B confirmation from the test server (no Safaricom IP) → `MpesaConfirmation`, `FromSafaricom = false`.
- Unit tests for `SafaricomCallers.IsSafaricom`: listed IP true, IPv4-mapped true, other IP false, null false,
  CIDR from config works.
- STK callback → `MpesaPrompt`; statement record → `StatementImport`; API order → `ConnectedSystem`; till → `Till`.
- Backfill: seed payments of each kind with `Source = Unknown` and the clues above; run the backfill; assert labels;
  run again and assert nothing changes.

**Acceptance:** every new payment has a non-Unknown source; no client can set it; only Safaricom-addressed
callbacks are `FromSafaricom`; Money in shows the label and the filter.

---

### PR 2: "Verified" section for the owner: the proof page

**Permissions** (`Auth/Auth.cs`, `web/src/lib/api.ts`):
- `VerifiedView = "verified.view"`: Owner and Accountant.
- `VerifiedShare = "verified.share"`: Owner only.
- Add both to the `Permission` type and to the sign-in payload; add the menu item **Verified** (icon: `ShieldCheck`)
  under Finance in `Shell.tsx`, shown only with `verified.view`.

**Summary service** (`Verified/VerifiedService.cs`, new) and `GET /api/verified/summary?months=6` (VerifiedView):
for the chosen period (3, 6 or 12 whole months, plus month-to-date), return:
- `months[]`: for each month, `confirmed` (sum of `Amount` where `FromSafaricom`), `allMoneyIn` (all sources),
  `confirmedShare` (confirmed ÷ all), `payers` (distinct `PayerPhone` among confirmed payments),
  `topFiveShare` (share of confirmed money from the five largest payers).
- `bySource`: totals per `PaymentSource` for the period, so the owner sees what doesn't count.
- `ownNumbers`: confirmed money whose `PayerPhone` matches the company's phone or any staff user's phone (normalise
  with `Phones.ToMsisdn`). Flag, don't exclude.
- `etims`: issued invoices in the period (not Draft, not Void, VAT-registered company), `signed` (EtimsStatus
  Signed and control code not starting `TEST-`), `testSigned` (starts `TEST-`), `failedOrPending`, `signedShare`.
- `checkedAt`: now (UTC).
- `fixes[]`: plain-language suggestions, each with a code and a link target, for example:
  - no confirmed payment in 30 days while M-Pesa payments exist → "Connect your Paybill confirmations so payments
    count" (→ Settings → Business & M-Pesa);
  - manual or import share over 20% → "X% of money in was entered by hand or uploaded, so it doesn't count";
  - topFiveShare over 50% → "Most money comes from five numbers. Lenders may ask about this.";
  - ownNumbers over 0 → "KSh X came from your own or your staff's numbers; it isn't counted as customer money";
  - test eTIMS signatures → "Invoices are signed in test mode until KRA certifies Kabuor ERP";
  - unsigned invoices → "N invoices aren't signed with KRA yet".
- Never return names or phone numbers.
- SQLite can't compare `DateTimeOffset` in queries: filter dates in memory when `!db.Database.IsNpgsql()`, as
  `DriverLinks.Live` and `DriverTrailRetention` already do.

**Page** (`web/src/pages/Verified.tsx`, route `/verified`):
- Headline answering the decision: **"KSh 312,400 a month confirmed by Safaricom, from 412 different customers"**
  (average of the last full months), with month-to-date beside it.
- A month bar chart of confirmed vs all money in (load the `dataviz` skill before writing the chart; one series
  colour for confirmed, a neutral for the rest; tooltips; table view).
- **eTIMS** tile: "96% of invoices signed by KRA" with counts, and test-mode note when relevant.
- **Strength of your proof:** the `fixes[]` list, each with its action button.
- Period selector: 3 / 6 / 12 months (chips, counts in context).
- Empty state for a business with no confirmed payments: what to connect, step by step.
- A primary button **Share with a lender** (only with `verified.share`; disabled with explanation otherwise).

**Tests:** summary maths on a seeded company (confirmed vs manual, distinct payers, top-five share, own-number flag,
eTIMS rates excluding `TEST-`); permissions (Accountant can view, cannot share; Sales gets 403); no PII in the
response (assert no phone or name strings appear).

---

### PR 3: Sharing with lenders, the lender's page, and the consent record

**Data model:**

```csharp
public sealed class VerifiedShare : ICompanyOwned
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CompanyId { get; set; }
    public required string LenderName { get; set; }      // "Equity Bank", typed or picked
    public string LenderContact { get; set; } = "";      // optional email or phone, for the owner's own record
    public int Months { get; set; }                      // 3, 6 or 12
    public string TokenHash { get; set; } = "";          // SHA-256 of the link token; the token itself is shown once
    public Guid CreatedByUserId { get; set; }
    public string CreatedBy { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }        // 7, 30 or 90 days
    public DateTimeOffset? RevokedAt { get; set; }
    public string? RevokedBy { get; set; }
}
public sealed class VerifiedShareView : ICompanyOwned
{
    public long Id { get; set; }
    public Guid CompanyId { get; set; }
    public Guid ShareId { get; set; }
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
    public string IpHash { get; set; } = "";             // salted hash, not the raw IP
    public string Agent { get; set; } = "";              // browser/device summary, trimmed
}
```

Add `TokenHash` to the `Secret` set in `ErpDb` so it never appears in audit changes.

**Owner endpoints** (`/api/verified/shares`):
- `GET` (VerifiedView): all shares with status (active / expired / revoked), views count and last viewed.
- `POST` (VerifiedShare) body `{ lenderName, lenderContact?, months, days, password?, code? }`:
  re-authenticate (password, or TOTP code when two-step is on) using the same checks as `TwoFactorInput`;
  validate months ∈ {3,6,12}, days ∈ {7,30,90}; create a 32-byte random token (hex), store only its hash; return the
  link `https://<public url>/v/<token>` and a QR (the web app renders the QR from the link).
- `POST /{id}/revoke` (VerifiedShare): sets `RevokedAt`; effective immediately.
- `GET /{id}/views` (VerifiedView): the view log for that share.
- Every create and revoke writes an `AuditEntry` (that is the consent record).

**Public endpoint** `GET /api/verified/s/{token}` (no login; rate-limited like the driver link, e.g. 120 per
15 minutes per token): look up by hash with `IgnoreQueryFilters`; 404 if unknown, revoked or expired (same message
for all three: "This link has ended. Ask the business for a new one."). Log a `VerifiedShareView`. Return:
- business: name, KRA PIN, county (identity a lender needs; shown to the owner in the preview before sharing);
- the PR 2 summary for `Months` (totals only), `checkedAt`;
- `lenderName`, `expiresAt`;
- `signature`: Ed25519 (or HMAC-SHA256 with a server key from configuration `Verified:SigningKey`) over the canonical
  JSON of the above, plus `keyId`, so a downloaded copy can be checked later. Publish the public key (if Ed25519) at
  `GET /api/verified/key`.
- Add the public routes to the allowlist in `tests/Kabuor.Erp.Tests/SecurityEndToEndTests.cs` (note the route
  pattern spelling, e.g. `"/api/verified/s/{token}"`).

**Owner UI** (on `/verified`):
- **Share with a lender** sheet: lender name, period, how long; a **preview of exactly what the lender will see**;
  password or two-step code; then the link with Copy, WhatsApp (`wa.me` with a short message) and QR.
- **Who can see your figures**: active shares first ("Equity Bank · until 30 Nov · opened 3 times, last 4 Nov"),
  each with **Stop sharing** (confirm, then immediate); expired and revoked below, greyed.
- Consent history: who shared, with whom, when, revoked by whom.

**Lender page** (`web/src/pages/VerifiedView.tsx`, public route `/v/:token`, works signed out, like `/d/:token`):
- Business name and KRA PIN; "Prepared for <lender> · valid until <date>" as a visible banner on the page;
  "Checked against Safaricom and KRA at <time>".
- Monthly confirmed money in (chart and table), payers, top-five share, eTIMS signing rate, test-mode note if any.
- Plain definitions of each figure ("Confirmed by Safaricom: payments Safaricom's servers sent to Kabuor directly;
  payments typed in by the business are not counted").
- Print view with a QR back to the live link; footer: "Kabuor provides verified facts, not a credit score."
- Expired or revoked: the ended message, nothing else.

**Tests:**
- Owner creates a share (with password; with TOTP when enabled; wrong password refused); Accountant cannot create
  or revoke (403).
- Public link returns totals only (assert no customer names or phones in the body), logs a view, includes a valid
  signature that verifies with the published key.
- Expired link and revoked link both return 404 with the same message; revoke takes effect immediately.
- Token is never stored in clear (hash only) and never appears in the audit trail.
- Rate limit on the public route.

## 5. Privacy notice and terms

When PR 3 lands, update `web/src/pages/Legal.tsx`:
- Privacy notice, "What we collect": share records and lender view logs (hashed IP, device summary).
- "Who else sees it": lenders the owner chooses, totals only, until the share ends.
- "How long": share and view records kept while the account is open (they are the consent record).
- Terms: a short "Verified reports" section: the owner chooses each lender; Kabuor provides facts, not credit
  decisions; the business is responsible for telling a lender about anything the figures don't show.

## 6. Out of scope for now (note in PR descriptions as next steps)

- Cross-checking confirmations with Daraja's Transaction Status API (stronger than IP checks; needs each merchant's
  initiator credentials).
- Live eTIMS signing (blocked on KRA certification).
- Lender accounts and an API for lenders (start with links; add accounts when a lender asks).
- Bank statement verification.

## 7. Definition of done for the whole feature

- A merchant who connects Paybill confirmations sees a headline of Safaricom-confirmed monthly revenue that a manual
  entry, a statement upload or a forged callback can't inflate.
- The owner, and only the owner, can share it with a named lender for a fixed period, revoke it instantly, and see
  every time it was opened.
- The lender sees totals, payer counts and eTIMS rates, with the business's identity, expiry and a verifiable
  signature, and never a customer's name or number.
- All tests pass on SQLite and Postgres; the privacy notice and terms describe the feature.
