# Critical Zero-Code Vulnerabilities: Analysis & Hardening

**Date**: October 24, 2026  
**System**: Kabuor ERP 2.0  
**Domain**: Zero-Code / Configuration-as-a-Vulnerability & Infrastructure Security  

---

## 1. What Are "Zero-Code" Vulnerabilities?

A **Zero-Code Vulnerability** is a high-severity security exposure that exists **independent of application source code logic**. It arises from misconfigurations, ambient authority, improper reverse-proxy trust boundaries, insecure environment defaults, or supply-chain vectors where perfectly written code is compromised by how the system is hosted, deployed, or networked.

---

## 2. Critical Zero-Code Vectors Audited & Hardened

### A. Reverse Proxy Header Spoofing (`X-Forwarded-For` / `X-Forwarded-Proto`)
- **The Zero-Code Risk**: When hosting behind load balancers or edge proxies (Cloudflare, AWS ALB, Nginx, Railway), Kestrel relies on `X-Forwarded-For` to identify the real visitor IP for rate limiting and audit logging. If `KnownNetworks` and `KnownProxies` are cleared without registering trusted networks, direct connections to Kestrel (e.g., bypassing Cloudflare to hit container IP directly) can supply forged `X-Forwarded-For` and `X-Forwarded-Proto` headers.
  - **Impact**: Attackers can spoof client IPs to evade rate limiters and spoof HTTPS headers.
  - **Zero-Code Fix Applied** in [`src/Kabuor.Erp.Api/Program.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Program.cs):
    Explicitly whitelisted private reverse-proxy subnets (`127.0.0.1/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and configured `ForwardLimit = 2`. Direct untrusted external connections attempting to spoof header chains are ignored.

### B. Insecure CORS Defaults in Production
- **The Zero-Code Risk**: Development configurations often hardcode `http://localhost:5173`. If deployed to production without environment-specific origin binding, either:
  1. Production web clients fail due to CORS rejections, OR
  2. Developers open `AllowAnyOrigin()` with credentials, enabling cross-origin authenticated session theft.
  - **Zero-Code Fix Applied** in [`src/Kabuor.Erp.Api/Program.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Program.cs):
    CORS origins are dynamically driven by `config["Cors:AllowedOrigins"]` or the `ALLOWED_ORIGINS` environment variable, falling back to local dev ports only when explicitly running in `Development`.

### C. Container Execution as Root (UID 0)
- **The Zero-Code Risk**: Containers executing as default `root` allow container escape vulnerabilities or host file mounts to compromise the underlying host system.
- **Zero-Code Fix Applied** in [`Dockerfile`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/Dockerfile):
  Configured `USER $APP_UID` on ASP.NET Core 10 runtime images, ensuring the app runs strictly under an unprivileged user with no root privileges.

### D. Cloud Metadata Service SSRF (AWS IMDSv1 / GCP Metadata)
- **The Zero-Code Risk**: Applications that allow webhook URLs or external links can be abused to fetch `http://169.254.169.254/latest/meta-data/iam/security-credentials/` without needing any code execution vulnerability.
- **Zero-Code Fix Applied** in [`src/Kabuor.Erp.Api/Integrations/Integrations.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Integrations/Integrations.cs):
  Enforced strict validation rejecting loopback (`127.0.0.1`), private RFC1918 subnets, and cloud link-local metadata addresses (`169.254.169.254`).

### E. Production Exception Disclosure
- **The Zero-Code Risk**: Unhandled server exceptions leaking framework versions, database schema names, connection strings, or call stacks.
- **Zero-Code Fix Applied** in [`src/Kabuor.Erp.Api/Program.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Program.cs):
  Guarded exception details: stack traces are strictly restricted to `app.Environment.IsDevelopment()`. In production, only generic error messages are returned.

### F. Cryptographic Key Entropy & Fail-Fast Startup
- **The Zero-Code Risk**: Systems that fallback to a default hardcoded JWT key (e.g., `"secret-key-12345"`) when the environment variable is missing. Anyone with the repository code can forge tokens for any tenant.
- **Zero-Code Fix Applied** in [`src/Kabuor.Erp.Api/Auth/Auth.cs`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/kabuor-erp-2/src/Kabuor.Erp.Api/Auth/Auth.cs):
  Zero fallback: If `Jwt:Key` is missing or < 32 characters, or if a development key is used outside of `Development`, the server terminates immediately upon boot via `app.Services.GetRequiredService<TokenIssuer>()`.
