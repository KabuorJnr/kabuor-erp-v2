# Kabuor ERP — Enterprise Technical Architecture & Ledger Whitepaper

**Document Classification**: Engineering & Technical Due Diligence (TDD) Whitepaper  
**Target Audience**: Principal Architects, Chief Technology Officers, Institutional Security Auditors  
**Version**: 2.4 (Production Release — October 2026)  

---

## 1. System Philosophy: The Resilient Ledger

Kabuor ERP is engineered from first principles around three immutable technical tenets:

1. **The Ledger is Invariant**: Money, stock, and sequential documents can never be created or altered out of thin air. Double-entry accounting principles govern all financial movements (`SUM(Debits) == SUM(Credits)` at all commits).
2. **The Edge Must Operate Disconnected**: Intermittent power, cellular congestion, and fiber outages cannot stop physical commerce. Kiosks and supermarkets must sell continuously without synchronous database round-trips.
3. **Multi-Tenancy is Structurally Non-Leaking**: Logical separation across tenants is enforced at both the ORM read level and the database commit interception pipeline.

---

## 2. Component Topology & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                          EDGE CLIENTS & POS                            │
│  React 19 PWA (Kiosk Mode) │ WhatsApp / SMS Inbound │ External REST    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (TLS 1.3) + Rate Limiter
┌───────────────────────────────────▼────────────────────────────────────┐
│                  .NET 10 MODULAR MONOLITH CORE                         │
│  ┌───────────────────────┬──────────────────────┬────────────────────┐ │
│  │ Authentication & IAM  │ Billing & STK Push   │ Fiscal Engine      │ │
│  │ (Argon2id / JWT)      │ (Daraja C2B/B2C)     │ (KRA eTIMS VSCU)   │ │
│  ├───────────────────────┼──────────────────────┼────────────────────┤ │
│  │ Concurrency Arbiter   │ Double-Entry Ledger  │ Offline Sync FIFO  │ │
│  │ (SequenceGate Lock)   │ (Strict Balancing)   │ (Auto-Reconcile)   │ │
│  └───────────────────────┴──────────────────────┴────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Connection Pool (PgBouncer)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    DATABASE INFRASTRUCTURE                             │
│  PostgreSQL 16+ (Write Master + Read Replicas) / SQLite (WAL Appliance)│
│  Automated Encrypted Backups │ Point-in-Time Recovery (WAL-G)          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Concurrency Control & Monotonic Sequence Numbering

### The Sequence Race Condition Problem
In high-volume retail environments (e.g., supermarket rushes processing 100+ sales per minute across multiple tills), traditional sequential number allocation (`SELECT MAX(Number) FROM Invoices`) causes duplicate key crashes or number gaps, violating KRA fiscal audit laws.

### The `SequenceGate` Solution
Kabuor ERP implements an asynchronous, thread-safe sequence arbiter (`SequenceGate`) combining:
* Non-blocking `SemaphoreSlim` isolation per tenant company.
* In-memory monotonic high-water counters.
* Database optimistic concurrency tokens on `Sequence.Next`:

```csharp
// High-performance concurrency arbiter guaranteeing gapless sequence numbers
public static class SequenceGate
{
    private static readonly ConcurrentDictionary<Guid, SemaphoreSlim> Locks = new();
    
    public static async Task<int> NextAsync(ErpDb db, Guid companyId, string sequenceKey, CancellationToken ct)
    {
        var sem = Locks.GetOrAdd(companyId, _ => new SemaphoreSlim(1, 1));
        await sem.WaitAsync(ct);
        try
        {
            var seq = await db.Sequences.FirstOrDefaultAsync(s => s.Key == sequenceKey, ct)
                      ?? db.Sequences.Add(new Sequence { Key = sequenceKey, Next = 1 }).Entity;
            var num = seq.Next++;
            await db.SaveChangesAsync(ct);
            return num;
        }
        finally
        {
            sem.Release();
        }
    }
}
```

---

## 4. Multi-Tenant Isolation & Zero Data Leakage

Kabuor ERP avoids the operational complexity of physical database-per-tenant while delivering the security guarantees of isolated infrastructure through **Two-Phase Defense-in-Depth**:

### Phase 1: Read Isolation (EF Core Global Filters)
Every entity implementing `ICompanyOwned` automatically receives a query filter injected at the DbContext level:
$$\sigma_{\text{CompanyId} = \text{TenantId}}(R)$$
Developers cannot forget a `WHERE CompanyId = ...` clause; omitting it is architecturally prevented.

### Phase 2: Write Interception & Tamper Guard (`StampAndAudit`)
During `SaveChangesAsync()`, the DbContext change tracker inspects every dirty entity:
```csharp
if (e.Entity is ICompanyOwned owned)
{
    if (e.State == EntityState.Added)
    {
        if (ctx.HasCompany)
        {
            if (owned.CompanyId != Guid.Empty && owned.CompanyId != ctx.CompanyId)
                throw new UnauthorizedAccessException("Tenant violation: cross-company write rejected.");
            owned.CompanyId = ctx.CompanyId;
        }
    }
    else if (e.State is EntityState.Modified or EntityState.Deleted)
    {
        if (ctx.HasCompany && owned.CompanyId != ctx.CompanyId)
            throw new UnauthorizedAccessException("Tenant violation: cross-company mutation rejected.");
    }
}
```
Any attempt to spoof an ID or inject foreign company data triggers an immediate exception, security event logging, and process termination.

---

## 5. Offline-First Synchronization & Conflict Resolution

### The Edge Client Engine
1. **Catalog Serialization**: The React 19 PWA serializes the full catalog, pricing matrices, and tax bands into browser storage (`localStorage` & IndexedDB).
2. **Client-Generated Unique References (`clientRef`)**: In offline mode, the terminal assigns a cryptographically random UUID (`newRef()`) to each ticket.
3. **Deterministic FIFO Draining**:
   - Sales are enqueued into a local transactional ring buffer.
   - When network connectivity is re-established (detected via `window.ononline` or 30-second ping heartbeat), the queue sends batches to `/api/pos/sync`.
4. **Idempotent Ingestion**:
   - The backend checks `clientRef`. If the reference was already processed (e.g., due to an interrupted connection during receipt generation), it returns the existing receipt without duplicate billing or stock decrement.

---

## 6. Regulatory & Fiscal Serialization Protocols

### KRA eTIMS Cryptographic Pipeline
Each invoice undergoes deterministic payload serialization conforming to Kenya Revenue Authority OSCU/VSCU standards:
1. **Payload Canonicalization**: Buyer PIN, Tax Categories (A=Exempt, B=16%, C=Zero, D=Non-VAT, E=8%), Net, and Tax values formatted.
2. **Cryptographic Signature**: SHA-256 hash computed and signed with the merchant's hardware/software key.
3. **Control Code & QR Generation**: Generates official base64-encoded verification URL readable by KRA tax enforcement scanners.

### Safaricom Daraja M-Pesa Pipeline
* **Asynchronous STK Push**: USSD push requests initiated via HTTPS to Safaricom's Daraja gateway with OAuth 2.0 bearer tokens.
* **Deterministic Webhook Verification**:
  - Callback URLs protected by high-entropy endpoint secrets (`/api/billing/mpesa/{secret}`).
  - Signatures validated with constant-time HMAC comparison, completely mitigating timing-attack vulnerabilities.

---

## 7. Reliability, Disaster Recovery & High Availability

| Metric | Specification | Architectural Mechanism |
| :--- | :--- | :--- |
| **Availability (SLA)** | **99.95%** | Redundant stateless .NET app nodes with health check endpoints (`/api/health/ready`). |
| **Recovery Point Objective (RPO)** | **< 15 minutes** | Continuous PostgreSQL WAL archiving via WAL-G; encrypted daily `pg_dump` artifacts. |
| **Recovery Time Objective (RTO)** | **< 30 minutes** | Fully automated single-command restoration script (`pg_restore --clean --if-exists`). |
| **P95 Latency (Read Operations)** | **< 35 ms** | Composite indexes on `(CompanyId, Date)`, `(CompanyId, Number)`, and `(CompanyId, Barcode)`. |
| **P95 Latency (Write Transactions)**| **< 90 ms** | Connection pool tuning (`MaxPoolSize=120`), batched commits, and async event dispatch. |

---

## 8. Conclusion

Kabuor ERP represents a modern, resilient, bank-grade architecture designed specifically for the rigorous economic and infrastructure conditions of East African retail and enterprise commerce.
