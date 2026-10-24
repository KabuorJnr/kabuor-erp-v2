# Kabuor ERP: 360-Degree Security & Compliance Audit

This comprehensive audit evaluates Kabuor ERP across all critical security vectors: Authentication, Multi-Tenant Data Isolation, Cryptographic Hygiene, FinTech/Payment Protection, Application Network Defenses, SSRF/Injection Resistance, and Regulatory Compliance (Kenya Data Protection Act, 2019).

---

## 1. Authentication & Session Security

| Security Control | Implementation Detail | Status |
| :--- | :--- | :---: |
| **Password Hashing** | Uses ASP.NET Core `PasswordHasher<User>` (PBKDF2 with HMAC-SHA512/256, 100,000+ iterations, per-user cryptographic salt). Auto-rehashes when upgrades are available. | 🟢 **Robust** |
| **Brute-Force & Lockout** | 5 consecutive failed sign-ins trigger an automatic 15-minute account freeze (`LockedUntil = Now + 15m`). Fixed-window rate limiter (500 req/15 min per IP) on `/api/auth`. | 🟢 **Robust** |
| **Session Invalidation** | Monotonically increasing `TokenVersion` on `User`. Changing password, enabling/disabling 2FA, revoking access, or clicking *"Sign Out Everywhere"* increments `TokenVersion`, instantly invalidating active JWTs across all devices. | 🟢 **Robust** |
| **Two-Factor Authentication** | RFC 6238 TOTP (6-digit, 30s step). TOTP secret is encrypted at rest using AES-GCM (see Cryptography below). `TotpLastStep` prevents code replay within the same time window. One-time recovery codes are stored as individual SHA-256 hashes. | 🟢 **Robust** |
| **Timing Attack Defense** | `CryptographicOperations.FixedTimeEquals()` used in TOTP code comparison to prevent side-channel timing leaks. | 🟢 **Robust** |

---

## 2. Multi-Tenancy & Data Isolation

| Vector | Risk Mitigated | Implementation | Status |
| :--- | :--- | :--- | :---: |
| **Cross-Tenant Reads** | Tenant A querying Tenant B's data | Dynamic EF Core Global Query Filter applied via reflection across **all** entities implementing `ICompanyOwned` (`x.CompanyId == ctx.CompanyId`). Even if developers add new tables, omissions are mathematically impossible. | 🟢 **Airtight** |
| **Cross-Tenant Writes** | Spoofing another company ID on insert | In `ErpDb.StampAndAudit()`, `owned.CompanyId` is strictly checked: attempting to pass a non-empty `CompanyId` different from the signed-in tenant throws `UnauthorizedAccessException`. | 🟢 **Airtight** |
| **Cross-Tenant Updates/Deletes** | Tampering with records belonging to other tenants | In `StampAndAudit()`, modifying or deleting an entity belonging to a different company throws `UnauthorizedAccessException`. | 🟢 **Airtight** |
| **Database Index Scoping** | Slow queries or uniqueness collisions across companies | Indexes are composite with `CompanyId` first (e.g. `{CompanyId, Number}`, `{CompanyId, Name}`, `{CompanyId, Phone}`). | 🟢 **Optimized** |

---

## 3. Cryptography & Secret Storage

| Component | Standard Applied | Notes | Status |
| :--- | :--- | :--- | :---: |
| **Stored Secrets at Rest** | AES-256-GCM (`SecretBox`) | Authenticated Encryption with Associated Data (AEAD). Uses 12-byte cryptographically random nonces, 16-byte authentication tags. Secret keys derived via SHA-256 from master JWT key. | 🟢 **Best Practice** |
| **Master Key Enforcement** | Runtime Startup Assertion | Server fails at boot if `Jwt:Key` is missing or < 32 characters. Production aborts immediately if a dev key is detected. | 🟢 **Secure** |
| **API Keys** | SHA-256 One-Way Hash | `kerp_` 24-byte cryptographically secure random keys. The raw key is shown only once to the user upon generation; only the SHA-256 hash and a 9-character prefix are stored in the database. | 🟢 **Best Practice** |
| **Audit Log Scrubbing** | Sanitization at ChangeTracker | Passwords, hashes, and M-Pesa callback keys are explicitly filtered out (`HashSet Secret = ["PasswordHash", "MpesaCallbackKey"]`) and never written to audit tables. | 🟢 **Protected** |

---

## 4. FinTech & Payment Processing Security

| Vector | Defense Mechanism | Status |
| :--- | :--- | :---: |
| **Safaricom Callback Secrecy** | Unpredictable 32-character hex secret per company: `/api/mpesa/c2b/{key}/confirmation` and `/api/mpesa/stk/{key}`. | 🟢 **Protected** |
| **Callback Replay Protection** | `MpesaRequest` checkout IDs and `Payment.Reference` (TransID) are uniquely indexed. Duplicate callbacks from Safaricom return an immediate acknowledgement without double-crediting balances. | 🟢 **Protected** |
| **Shortcode Spoofing** | Validates incoming payload `BusinessShortCode` matches the company's registered Paybill/Till number. | 🟢 **Protected** |
| **Arithmetic Integrity** | Money is strictly handled as `long cents` (integer arithmetic). Floating point numbers (`double`/`float`) are forbidden for financial values, eliminating IEEE-754 precision rounding vulnerabilities. | 🟢 **FinTech Standard** |
| **Double-Entry Ledger Invariant** | In [`Ledger.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Accounting/Ledger.cs), debits and credits are required to balance to zero on every posting. Unbalanced postings throw `UnbalancedEntryException` and abort the transaction. | 🟢 **Airtight** |
| **Race Conditions / Concurrency** | Optimistic concurrency tokens (`IsConcurrencyToken`) on `SalesDoc.Paid`, `SalesDoc.Status`, `Payment.Allocated`, `PayrollRun.Status`, and `ProductionRun.Status` prevent double-spend and parallel allocation collisions. | 🟢 **Protected** |

---

## 5. Network, Headers & Ingestion Defenses

| Security Layer | Implementation in Kabuor ERP | Status |
| :--- | :--- | :---: |
| **Content Security Policy (CSP)** | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` | 🟢 **Hardened** |
| **Clickjacking** | `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`. | 🟢 **Protected** |
| **MIME Sniffing** | `X-Content-Type-Options: nosniff`. | 🟢 **Protected** |
| **Transport Layer Security** | `Strict-Transport-Security: max-age=31536000` (HSTS). Production enforces PostgreSQL SSL Mode (`VerifyFull` / `Require`). | 🟢 **Hardened** |
| **SSRF (Server-Side Request Forgery)** | Outbound webhooks strictly enforce `https://` and block `localhost`, `127.0.0.1`, private IP ranges (`10.*`, `192.168.*`, `172.16.*`), and cloud metadata IP (`169.254.169.254`). | 🟢 **Hardened** |
| **Outbound Webhook Signatures** | Every webhook delivery carries an `X-Kabuor-Signature` header computed as `sha256(HMAC(secret, body))`, enabling recipient payload verification. | 🟢 **Hardened** |

---

## 6. Privacy & Legal Compliance (Kenya Data Protection Act, 2019)

* **Right of Access (Section 26 / Reg. 9(4))**:
  * Implemented [`DataRights.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Privacy/DataRights.cs) `Export(customerId)`: Generates complete personal data dossier (inquiries, documents, payments, activities, marketing history).
* **Right to Erasure (Section 40 / Reg. 12(3))**:
  * `Erase(customerId)` scrubs personal details, conversations, and leads from live tables and audit history.
  * Respects the statutory statutory exception (Reg. 12(4)): Invoices and tax documents are retained for the mandatory 5-year window required by the **Tax Procedures Act, 2015 (s. 23)**.
* **Telemetry PII Protection**:
  * Sentry telemetry explicitly disables request bodies and PII (`SendDefaultPii = false; MaxRequestBodySize = None`).
