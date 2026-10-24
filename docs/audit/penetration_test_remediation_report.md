# Penetration Testing & Vulnerability Remediation Report

**Date**: October 24, 2026  
**Target Platform**: Kabuor ERP 2.0 Web API  
**Environment**: Production Readiness Security Audit  
**Assessment Type**: Defensive Code Audit, Penetration Test Simulation & Vulnerability Remediation  

---

## 1. Executive Summary

A comprehensive penetration testing audit was performed across the **Kabuor ERP 2.0** application architecture, examining authentication boundaries, tenant query filters, public-facing unauthenticated endpoints, CSV parser resource consumption, API key resolution, and cookie handling. 

All identified vulnerabilities and edge cases were patched directly in the source code, and automated regression test coverage was added to [`tests/Kabuor.Erp.Tests/ScalingArchitectureTests.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/tests/Kabuor.Erp.Tests/ScalingArchitectureTests.cs). All 11 test suites now pass with **100% success rate**.

---

## 2. Findings & Applied Remediations

### Finding 1: Unbounded CSV Statement Parsing Denial of Service (DoS)
- **Severity**: Medium (Availability / Resource Exhaustion)
- **Vulnerability**: In [`src/Kabuor.Erp.Api/Accounting/Statements.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Accounting/Statements.cs), file payload size was capped at 5MB, but the row count was unbounded. An attacker could transmit a 4.9MB CSV with 100,000+ tiny lines, forcing the server to instantiate hundreds of thousands of EF Core entities and trigger transaction timeouts.
- **Remediation**: Added a strict limit of 10,000 rows in `StatementService.Csv(text)`. Any input exceeding 10,000 rows immediately aborts with an `AppException`.

```csharp
row.Add(cell.ToString().Trim());
if (row.Any(x => x.Length > 0)) rows.Add([.. row]);
if (rows.Count > 10_000) 
    throw new AppException("CSV exceeds the maximum limit of 10,000 rows. Please split the file into smaller batches.");
return rows;
```

---

### Finding 2: Anonymous Tracking Link Context Crash & Potential Bypass
- **Severity**: High (Functional Denial of Service / Audit Integrity)
- **Vulnerability**: In [`src/Kabuor.Erp.Api/IntelligenceEndpoints.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/IntelligenceEndpoints.cs), public tracking links (`/l/{code}`) record visitor metrics by creating a `LinkVisit`. Because the endpoint allows unauthenticated public requests, `RequestContext.CompanyId` was empty (`Guid.Empty`), causing `ErpDb.StampAndAudit()` to throw `InvalidOperationException: No company for new LinkVisit` and return a 500 error to public visitors.
- **Remediation**: Injected `RequestContext ctx` into `/l/{code}`, resolved `link.CompanyId`, and stamped `(ctx.CompanyId, ctx.Actor) = (link.CompanyId, "Tracking link")` prior to database commit.

```csharp
app.MapGet("/l/{code}", async (string code, HttpContext http, ErpDb db, RequestContext ctx) =>
{
    var link = await db.TrackingLinks.IgnoreQueryFilters().SingleOrDefaultAsync(l => l.Code == code.ToLowerInvariant() && l.Active);
    if (link is null) return Results.Redirect("/");
    (ctx.CompanyId, ctx.Actor) = (link.CompanyId, "Tracking link");
    ...
```

---

### Finding 3: Tracking Cookie Parameter Sanitization
- **Severity**: Low (Parameter Injection / Header Splitting)
- **Vulnerability**: The visitor cookie `kv` was read directly from `http.Request.Cookies["kv"]` without character set validation before being appended to the HTTP response header or stored in the database.
- **Remediation**: Enforced alphanumeric character validation (`v.All(char.IsLetterOrDigit)`). If any invalid characters or control characters are detected, a cryptographically secure `Guid.NewGuid().ToString("N")` is substituted. Set `Secure = true` to protect cookie transmission.

```csharp
var rawVisitor = http.Request.Cookies["kv"];
var visitor = rawVisitor is { Length: > 10 and < 64 } v && v.All(char.IsLetterOrDigit) 
    ? v 
    : Guid.NewGuid().ToString("N");
var cookie = new CookieOptions { MaxAge = TimeSpan.FromDays(60), HttpOnly = false, SameSite = SameSiteMode.Lax, Secure = http.Request.IsHttps || !http.Request.Host.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) };
```

---

### Finding 4: Unbounded Bulk Payment Allocation
- **Severity**: Low (Database Contention / DoS)
- **Vulnerability**: In [`src/Kabuor.Erp.Api/Payments/PaymentService.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Payments/PaymentService.cs), `Allocate()` accepted an unbounded array of invoice allocation records, which could cause query bloat in EF Core `Where(d => ids.Contains(d.Id))`.
- **Remediation**: Added a ceiling check:
```csharp
if (allocations.Count > 100) 
    throw new AppException("Cannot allocate to more than 100 invoices at once.");
```

---

## 3. Automated Pen Test Suite & Verification Results

The regression suite [`tests/Kabuor.Erp.Tests/ScalingArchitectureTests.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/tests/Kabuor.Erp.Tests/ScalingArchitectureTests.cs) was executed with `dotnet test`:

| # | Test Case | Target Attack Vector | Result |
|---|---|---|---|
| 1 | `Health_checks_are_accessible_and_healthy` | Service Availability & Readiness probes | **PASSED** |
| 2 | `Telemetry_and_metrics_can_be_recorded_without_exceptions` | Monitoring & Audit instrumentation | **PASSED** |
| 3 | `Tenant_isolation_is_strictly_enforced_between_different_companies` | Cross-tenant data leakage / IDOR | **PASSED** |
| 4 | `Onboarding_status_and_quickstart_generates_first_invoice` | Self-service lifecycle integrity | **PASSED** |
| 5 | `Network_headers_and_security_controls_are_enforced` | Clickjacking, MIME sniffing, CSP framing | **PASSED** |
| 6 | `Dangerous_http_methods_are_rejected` | TRACE / TRACK XST attack vectors | **PASSED** |
| 7 | `Ssrf_webhook_registration_is_blocked` | SSRF against AWS/GCP metadata & loopback | **PASSED** |
| 8 | `Csv_memory_exhaustion_payload_is_rejected` | Parser DoS (>10,000 rows CSV) | **PASSED** |
| 9 | `Unauthenticated_requests_cannot_access_employee_self_service` | Unauthorized access to `/api/me` | **PASSED** |
| 10 | `Cross_tenant_api_key_cannot_access_other_tenant_data` | Cross-tenant API key data leakage | **PASSED** |
| 11 | `Tracking_link_visitor_cookie_is_sanitized_against_injection` | Cookie parameter injection / 500 error | **PASSED** |

**Summary**: 11 passed, 0 failed, 0 skipped.
