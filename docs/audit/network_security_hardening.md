# Network Security Hardening & Attack Surface Elimination

This report details the concrete networking defenses implemented in Kabuor ERP to block denial-of-service, spoofing, SSRF, header manipulation, and side-channel attacks.

---

## 1. Kestrel Web Server Hardening & Slowloris Mitigation
Configured in [`Program.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Program.cs):
* **Server Banner Stripping**: `k.AddServerHeader = false` stops leaking internal web server and .NET version headers.
* **Slowloris Attack Prevention**:
  * `RequestHeadersTimeout = 15s`: Prevents attackers from holding open sockets by sending partial HTTP headers byte-by-byte.
  * `MinRequestBodyDataRate = 100 bytes/sec`: Drops slow-client requests holding connection threads hostage.
  * `MinResponseDataRate = 100 bytes/sec`: Drops slow-reading connections.
* **Payload Memory Exhaustion (OOM) Protection**:
  * `MaxRequestBodySize = 10MB`: Enforces an upper boundary on incoming request bodies, preventing large-payload heap exhaustion.
  * `MaxRequestHeaderCount = 64` and `MaxRequestHeadersTotalSize = 32KB`: Defends against hash-table and header buffer overflows.

---

## 2. Reverse Proxy & Header Spoofing Protection
* **`X-Forwarded-For` Chain Protection**:
  * Set `ForwardLimit = 2`: Prevents attackers from injecting fake IP addresses in the `X-Forwarded-For` header to bypass IP-based rate limiting or poison audit logs.
  * Forwarded headers are parsed strictly from the immediate upstream proxy (e.g., Render or Cloudflare load balancer).

---

## 3. Global API Flood & DoS Rate Limiting
* In [`Program.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Program.cs), implemented an automatic `PartitionedRateLimiter` token bucket limiter across all `/api/*` routes:
  * **Burst Capacity**: 250 tokens per IP.
  * **Replenishment**: 50 tokens / second.
  * **Queue**: Max 25 queued requests before rejecting with `429 Too Many Requests`.
  * Preserves unthrottled access for `/health` liveness/readiness probes.

---

## 4. HTTP Method Hardening & Cross-Site Tracing (XST)
* Blocked dangerous and debugging HTTP verbs (`TRACE`, `TRACK`, `DEBUG`) with an immediate `405 Method Not Allowed`.
* Prevents attackers from reflecting HTTP authentication cookies or `Bearer` tokens via debugging methods.

---

## 5. Server-Side Request Forgery (SSRF) Elimination
* In [`Integrations.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Integrations/Integrations.cs), hardened webhook URL validation:
  1. Mandates `https://` protocol.
  2. Actively blocks loopback hosts (`localhost`, `127.0.0.1`).
  3. Rejects RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  4. Explicitly blocks cloud instance metadata services (`169.254.169.254`), closing off AWS/GCP/Azure credential theft.

---

## 6. HTTP Security Headers
* **Content-Security-Policy (CSP)**:
  * Enhanced with `upgrade-insecure-requests;` to enforce HTTPS on all embedded resources.
  * `frame-ancestors 'none'` and `object-src 'none'`.
* **Cross-Origin Isolation**:
  * `Cross-Origin-Opener-Policy: same-origin` (COOP) protects against cross-window side-channel attacks (Spectre).
  * `Cross-Origin-Resource-Policy: same-origin` (CORP) prevents malicious sites from embedding API responses.
* **Domain Policies**:
  * `X-Permitted-Cross-Domain-Policies: none` prevents Flash/PDF cross-domain leaks.
* **Clickjacking & Sniffing**:
  * `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`.
* **HSTS**:
  * `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

---

## 7. Container Process Isolation (Non-Root Execution)
* In [`Dockerfile`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/Dockerfile), enforced non-root execution via `USER $APP_UID`.
* The application container runs as an unprivileged user (UID 1654), mitigating container breakout risks.
