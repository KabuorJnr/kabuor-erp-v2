# Memory Leaks, Connection Pools, and Race Conditions: Audit & Hardening

**Date**: October 24, 2026  
**System**: Kabuor ERP 2.0  
**Focus**: Performance, Reliability & High-Concurrency Resilience  

---

## 1. Executive Summary

An architectural and code-level deep dive was conducted on the Kabuor ERP 2.0 backend targeting three core system resilience pillars:
1. **Memory Leaks**: Object lifetimes, background workers, socket reuse, and cache eviction.
2. **Connection Pools**: Database connection pool tuning, transient retry handling, and SQLite WAL mode.
3. **Race Conditions**: Sequential document numbering, concurrent stock depletion, and financial allocation concurrency tokens.

All optimizations have been applied and verified via automated regression tests in [`tests/Kabuor.Erp.Tests/ScalingArchitectureTests.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/tests/Kabuor.Erp.Tests/ScalingArchitectureTests.cs).

---

## 2. Memory Leaks Analysis & Remediations

| Potential Risk Area | Audit Finding | Hardening Applied |
|---|---|---|
| **Background Services** | `AgentScheduler` & `WebhookWorker` execute continuously in the background. Long-lived singletons holding scoped dependencies cause memory leaks. | Both services use `IServiceScopeFactory.CreateScope()` inside their iteration loops with `using var scope`, ensuring DbContexts and tracked entities are garbage collected immediately after each task. |
| **HTTP Sockets Exhaustion** | Creating `new HttpClient()` per request causes socket exhaustion under high TPS due to `TIME_WAIT` delays. | Verified all external calls (`anthropic`, `daraja`, `webhooks`, `kra-etims`) resolve from `IHttpClientFactory` registered in [`Program.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Program.cs). |
| **Distributed / In-Memory Cache** | Unbounded memory growth in `IDistributedCache` when Redis is unavailable. | In [`src/Kabuor.Erp.Api/Common/AppCache.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Common/AppCache.cs), every entry enforces `AbsoluteExpirationRelativeToNow = expiry ?? TimeSpan.FromMinutes(5)`, ensuring strict eviction. |
| **Static State** | Static collections accumulating tenant objects. | Audited all `static` fields across `src/`. All collections (`Roles`, `Names`, `CashCategory`, `Secret`) are immutable lookup tables; no mutable static lists or dictionaries exist. |

---

## 3. Database Connection Pools Hardening

### A. PostgreSQL / Npgsql Pool Optimization
In high-throughput environments (e.g. 500k tx/day across 20 tenants), connection pool starvation and transient connection drops can cause cascading request failures.

1. **Connection String Hardening** in [`src/Kabuor.Erp.Api/Program.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Program.cs):
   - Added support for connection pooling parameters:
     - `Pooling=true`
     - `Minimum Pool Size=5` (default, configurable via `DB_MIN_POOL_SIZE`)
     - `Maximum Pool Size=100` (default, configurable via `DB_MAX_POOL_SIZE`)
     - `Connection Idle Lifetime=300s`
     - `Timeout=15s`
2. **Transient Failure Resiliency & Retries**:
   - Configured `EnableRetryOnFailure` on `NpgsqlDbContextOptionsBuilder`:
   ```csharp
   o.UseNpgsql(cs, npgsql =>
   {
       npgsql.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
       npgsql.CommandTimeout(30);
   });
   ```

### B. SQLite Concurrency (Development & Tests)
By default, SQLite locks the entire database file during writes (`SQLITE_BUSY: database is locked`).
- **Remediation**: In [`src/Kabuor.Erp.Api/Data/SchemaSync.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Data/SchemaSync.cs), enabled Write-Ahead Logging (WAL) and a 5,000ms busy timeout:
```sql
PRAGMA journal_mode = WAL; 
PRAGMA busy_timeout = 5000;
```
WAL mode allows concurrent readers while writes are proceeding, eliminating lock contention.

---

## 4. Race Conditions & Concurrency Controls

### A. Document Sequence Number Generation (`Numbers.cs`)
- **Problem**: When two concurrent requests for the same tenant called `numbers.Next("INV")`, both read the same sequence value from the DB, generated duplicate document numbers (e.g. both `"INV-0001"`), and crashed on `IX_SalesDocs_CompanyId_Number` unique constraint.
- **Remediation**:
  1. Implemented a `SequenceGate` in [`src/Kabuor.Erp.Api/Common/Common.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Common/Common.cs) with per-tenant asynchronous semaphore serialization and in-memory monotonic counter tracking.
  2. Configured optimistic concurrency on the database entity in [`src/Kabuor.Erp.Api/Data/ErpDb.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Data/ErpDb.cs):
  ```csharp
  b.Entity<Sequence>().Property(x => x.Next).IsConcurrencyToken();
  ```

### B. Stock Depletion & Negative Inventory Prevention
- **Problem**: When stock is low and `PreventNegativeStock` is enabled, concurrent checkout requests both read `have >= qty`, both subtracted from stock, and committed, resulting in ghost inventory sold.
- **Remediation**: Added concurrency tokens on `StockLevel.Quantity` and `StockBatch.Quantity`:
  ```csharp
  b.Entity<StockLevel>().Property(x => x.Quantity).IsConcurrencyToken();
  b.Entity<StockBatch>().Property(x => x.Quantity).IsConcurrencyToken();
  ```
  EF Core automatically detects any mid-air collisions and throws `DbUpdateConcurrencyException`.

### C. Financial Ledger Allocations
- Verified existing concurrency tokens in [`ErpDb.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Data/ErpDb.cs):
  - `SalesDoc.Paid.IsConcurrencyToken()`
  - `SalesDoc.Status.IsConcurrencyToken()`
  - `Payment.Allocated.IsConcurrencyToken()`
  This prevents two users or automated webhooks from allocating more money than remains on a payment.

---

## 5. Verification Results

All 13 automated tests in [`tests/Kabuor.Erp.Tests/ScalingArchitectureTests.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/tests/Kabuor.Erp.Tests/ScalingArchitectureTests.cs) passed successfully:

- `Concurrent_sequence_generation_prevents_duplicate_numbers`: Spawns 10 parallel asynchronous tasks for the same tenant; confirms all 10 document numbers are unique (**PASSED**).
- `PostgreSql_connection_string_includes_hardened_pool_options`: Asserts pool tuning parameters are correctly formatted (**PASSED**).
- All 11 existing scaling, security, and tenant isolation tests (**PASSED**).
