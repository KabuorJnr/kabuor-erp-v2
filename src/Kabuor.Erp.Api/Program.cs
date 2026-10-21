using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Kabuor.Erp;
using Kabuor.Erp.Accounting;
using Kabuor.Erp.Assistant;
using Kabuor.Erp.Auth;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Kabuor.Erp.Etims;
using Kabuor.Erp.Payments;
using Kabuor.Erp.Reports;
using Kabuor.Erp.Sales;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// Error alerts (Sentry), only when SENTRY__DSN is set: every crash and every logged error is reported, with the
// route and the company id, never request bodies, names or phone numbers.
if (!string.IsNullOrWhiteSpace(config["Sentry:Dsn"]))
    builder.WebHost.UseSentry(o =>
    {
        o.Dsn = config["Sentry:Dsn"];
        o.Environment = config["Sentry:Environment"] ?? builder.Environment.EnvironmentName;
        o.Release = (config["RENDER_GIT_COMMIT"] ?? config["RAILWAY_GIT_COMMIT_SHA"]) is { Length: > 7 } sha ? sha[..7] : null;
        o.SendDefaultPii = false;
        o.MaxRequestBodySize = Sentry.Extensibility.RequestSize.None;
        o.MinimumEventLevel = LogLevel.Error;
        o.TracesSampleRate = config.GetValue("Sentry:TracesSampleRate", 0.05);
        // Expected answers (a wrong password, a rule the person can fix) aren't errors.
        o.SetBeforeSend(e => e.Exception is Kabuor.Erp.Common.AppException ? null : e);
    });

// Database: PostgreSQL in production (a "Host=…" connection string), SQLite file locally.
var cs = Program.ConnectionString(config.GetConnectionString("Erp") ?? config["DATABASE_URL"] ?? "Data Source=kabuor-erp.db");
builder.Services.AddScoped<RequestContext>();
builder.Services.AddMemoryCache();

// Distributed caching: Redis in production when REDIS_URL or ConnectionStrings:Redis is set, otherwise memory fallback.
var redisCs = config["REDIS_URL"] ?? config["VALKEY_URL"] ?? config.GetConnectionString("Redis") ?? config.GetConnectionString("Valkey") ?? config["REDIS_CONNECTION_STRING"];
if (!string.IsNullOrWhiteSpace(redisCs))
{
    var redisOptions = Program.ParseRedisConnectionString(redisCs);
    builder.Services.AddStackExchangeRedisCache(o =>
    {
        o.ConfigurationOptions = redisOptions;
        o.InstanceName = "kerp:";
    });
}
else
{
    builder.Services.AddDistributedMemoryCache();
}
builder.Services.AddSingleton<AppCache>();
builder.Services.AddDbContext<ErpDb>(o =>
{
    if (cs.StartsWith("Host=", StringComparison.OrdinalIgnoreCase)) o.UseNpgsql(cs);
    else o.UseSqlite(cs);
});

builder.Services.AddScoped<Ledger>();
builder.Services.AddScoped<Numbers>();
builder.Services.AddScoped<SalesService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<ReportService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddSingleton<SecretBox>();
builder.Services.AddScoped<AssistantService>();
builder.Services.AddScoped<Kabuor.Erp.Inventory.InventoryService>();
builder.Services.AddScoped<Kabuor.Erp.Purchases.PurchaseService>();
builder.Services.AddScoped<Kabuor.Erp.Payroll.PeopleService>();
builder.Services.AddScoped<Kabuor.Erp.Payroll.DeductionService>();
builder.Services.AddScoped<WithholdingService>();
builder.Services.AddScoped<StatementService>();
builder.Services.AddScoped<Kabuor.Erp.Import.ImportService>();
builder.Services.AddScoped<Kabuor.Erp.Billing.BillingService>();
builder.Services.AddScoped<Kabuor.Erp.Payments.StkService>();
builder.Services.AddScoped<Kabuor.Erp.Intelligence.LinkService>();
builder.Services.AddScoped<Kabuor.Erp.Intelligence.InquiryService>();
builder.Services.AddScoped<Kabuor.Erp.Intelligence.InsightsService>();
builder.Services.AddScoped<Kabuor.Erp.Intelligence.KpiService>();
builder.Services.AddScoped<Kabuor.Erp.Privacy.DataRightsService>();
builder.Services.AddScoped<Kabuor.Erp.Intelligence.QuoteAuditService>();
builder.Services.AddScoped<Kabuor.Erp.Intelligence.PortalService>();
builder.Services.AddSingleton<Kabuor.Erp.Intelligence.PortalTokens>();
builder.Services.AddScoped<Kabuor.Erp.Integrations.WebhookService>();
builder.Services.AddHostedService<Kabuor.Erp.Integrations.WebhookWorker>();
builder.Services.AddHttpClient("webhooks", c => c.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddHttpClient("daraja", c => c.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddScoped<Kabuor.Erp.Crm.CrmService>();
builder.Services.AddScoped<Kabuor.Erp.Production.ProductionService>();
builder.Services.AddScoped<Kabuor.Erp.Marketing.MarketingService>();
builder.Services.AddScoped<Kabuor.Erp.Agents.AgentService>();
builder.Services.AddSingleton<Kabuor.Erp.Agents.AgentScheduler>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<Kabuor.Erp.Agents.AgentScheduler>());
builder.Services.AddSingleton<Kabuor.Erp.Marketing.ISmsSender, Kabuor.Erp.Marketing.AfricasTalkingSms>();
builder.Services.AddScoped<IEtimsClient, OscuEtimsClient>();
builder.Services.AddSingleton<OscuApi>();
builder.Services.AddScoped<EtimsService>();
builder.Services.AddHttpClient("kra-etims", c => c.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddSingleton<TokenIssuer>();
builder.Services.AddHttpClient("anthropic", c =>
{
    c.BaseAddress = new Uri("https://api.anthropic.com/");
    c.Timeout = TimeSpan.FromSeconds(90);
});

builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// Sign-in tokens, checked on every request.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme).Configure<TokenIssuer>((o, tokens) =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = "kabuor-erp",
        ValidAudience = "kabuor-erp",
        IssuerSigningKey = tokens.Key,
        ClockSkew = TimeSpan.FromMinutes(1),
        RoleClaimType = "role",
        NameClaimType = "name",
    };
});
builder.Services.AddAuthorization(o =>
{
    foreach (var (name, roles) in Policies.Roles)
        o.AddPolicy(name, p => p.RequireAuthenticatedUser().RequireClaim("cid").RequireRole(roles.Select(r => r.ToString())));
});

// Limits per visitor IP on what's worth abusing.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "?", _ => new FixedWindowRateLimiterOptions { PermitLimit = 500, Window = TimeSpan.FromMinutes(15) }));
    o.AddPolicy("assistant", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.User.FindFirst("sub")?.Value ?? "?", _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(10) }));
});

builder.Services.AddCors(o => o.AddPolicy("dev", p => p.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

var app = builder.Build();

// Fail at start, with the reason, if there's no signing key: never run a server that can't sign anyone in.
app.Services.GetRequiredService<TokenIssuer>();

// Bring the database to the model's shape on start (see Data/SchemaSync.cs).
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ErpDb>();
    await SchemaSync.Prepare(db); // migrations on PostgreSQL; EnsureCreated + new tables/columns on SQLite
}

app.UseForwardedHeaders();
app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h.XContentTypeOptions = "nosniff";
    h["Referrer-Policy"] = "strict-origin-when-cross-origin";
    h.XFrameOptions = "DENY";
    h["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()";
    // Only this site's own scripts, styles, fonts and API: injected scripts and other sites' code can't run.
    h.ContentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
    if (ctx.Request.IsHttps) h.StrictTransportSecurity = "max-age=31536000";
    await next();
});

// Problems the user can fix come back as { error }, with the right status. Anything else is logged, not leaked.
app.UseExceptionHandler(new ExceptionHandlerOptions
{
    // Expected answers (wrong password, a rule the person can fix) aren't errors: keep them out of the error log.
    SuppressDiagnosticsCallback = c => c.Exception is AppException or BadHttpRequestException,
    ExceptionHandler = async ctx =>
{
    var ex = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
    var (status, message) = ex switch
    {
        AppException a => (a.Status, a.Message),
        DbUpdateConcurrencyException => (409, "Someone else changed this at the same time. Refresh and try again."),
        BadHttpRequestException b => (b.StatusCode, "The request wasn't in the expected format."),
        UnbalancedEntryException => (500, "Something went wrong on our side."),
        _ => (500, "Something went wrong on our side."),
    };
    if (status >= 500) app.Logger.LogError(ex, "Unhandled error on {Path}", ctx.Request.Path);
    ctx.Response.StatusCode = status;
    // In development, 500s carry the exception so problems are quick to find; never in production.
    if (ex is not AppException && app.Environment.IsDevelopment()) await ctx.Response.WriteAsJsonAsync(new { error = message, detail = ex?.ToString() });
    else await ctx.Response.WriteAsJsonAsync(new { error = message });
},
});

app.UseCors("dev");
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRateLimiter();
app.UseAuthentication();

// Who is asking: the company and person from the sign-in token, used by the database's company filter.
app.Use(async (http, next) =>
{
    var u = http.User;
    if (u.Identity?.IsAuthenticated == true && Guid.TryParse(u.FindFirst("cid")?.Value, out var cid))
    {
        var ctx = http.RequestServices.GetRequiredService<RequestContext>();
        ctx.CompanyId = cid;
        ctx.UserId = Guid.TryParse(u.FindFirst("sub")?.Value, out var uid) ? uid : null;
        ctx.Actor = u.FindFirst("name")?.Value ?? "user";
        ctx.Role = Enum.TryParse<Role>(u.FindFirst("role")?.Value, out var r) ? r : Role.Viewer;
        ctx.EmployeeId = Guid.TryParse(u.FindFirst("eid")?.Value, out var eid) ? eid : null;
        Sentry.SentrySdk.ConfigureScope(scope => scope.SetTag("company", cid.ToString()));
        // A session ends when the person is switched off, or their sessions were ended (password, sign out everywhere).
        var tv = int.TryParse(u.FindFirst("tv")?.Value, out var v) ? v : 0;
        var db = http.RequestServices.GetRequiredService<ErpDb>();
        var current = await db.Users.IgnoreQueryFilters().Where(x => x.Id == ctx.UserId).Select(x => new { x.Active, x.TokenVersion, x.Role }).SingleOrDefaultAsync();
        if (current is null || !current.Active || current.TokenVersion != tv || current.Role != ctx.Role)
        {
            http.Response.StatusCode = 401;
            await http.Response.WriteAsJsonAsync(new { error = "Your session has ended. Please sign in again." });
            return;
        }
        // Trial over and nothing paid: everything stays readable and downloadable; adding and changing waits for a plan.
        var method = http.Request.Method;
        var path = http.Request.Path.Value ?? "";
        if (method is not ("GET" or "HEAD" or "OPTIONS") && !path.StartsWith("/api/billing") && !path.StartsWith("/api/auth") && !path.StartsWith("/api/me"))
        {
            var company = await db.Companies.Where(c => c.Id == cid).Select(c => new { c.CreatedAt, c.TrialEndsAt, c.PaidUntil }).SingleAsync();
            var probe = new Company { Name = "", CreatedAt = company.CreatedAt, TrialEndsAt = company.TrialEndsAt, PaidUntil = company.PaidUntil };
            if (Kabuor.Erp.Billing.Plans.Locked(probe, DateTimeOffset.UtcNow))
            {
                http.Response.StatusCode = 402;
                await http.Response.WriteAsJsonAsync(new { error = "Your free trial has ended. Choose a plan (Settings → Plan) to keep adding and changing records. Everything you have is still here." });
                return;
            }
        }
    }
    await next();
});
app.UseAuthorization();

Endpoints.Map(app);
IntelligenceEndpoints.Map(app);
// The web app (built into wwwroot): any other path is a page in it.
app.MapFallbackToFile("index.html");

AppDomain.CurrentDomain.UnhandledException += (_, e) =>
{
    var msg = $"[{DateTime.UtcNow:O}] AppDomain.UnhandledException: {e.ExceptionObject}";
    Console.Error.WriteLine(msg);
    try { File.AppendAllText("crash.log", msg + Environment.NewLine); } catch { }
};

TaskScheduler.UnobservedTaskException += (_, e) =>
{
    var msg = $"[{DateTime.UtcNow:O}] TaskScheduler.UnobservedTaskException: {e.Exception}";
    Console.Error.WriteLine(msg);
    try { File.AppendAllText("crash.log", msg + Environment.NewLine); } catch { }
    e.SetObserved();
};

try
{
    app.Run();
}
catch (Exception ex)
{
    var msg = $"[{DateTime.UtcNow:O}] Fatal host crash: {ex}";
    Console.Error.WriteLine(msg);
    try { File.AppendAllText("crash.log", msg + Environment.NewLine); } catch { }
    throw;
}

public partial class Program
{
    // Railway and most hosts give PostgreSQL as a URL (postgresql://user:pass@host:port/db); Npgsql wants key=value.
    internal static string ConnectionString(string raw)
    {
        if (!raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) && !raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)) return raw;
        var u = new Uri(raw);
        var (user, pass) = (u.UserInfo.Split(':', 2) is [var a, var b] ? (Uri.UnescapeDataString(a), Uri.UnescapeDataString(b)) : (Uri.UnescapeDataString(u.UserInfo), ""));
        var query = u.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries).Select(p => p.Split('=', 2)).Where(p => p.Length == 2)
            .ToDictionary(p => p[0].ToLowerInvariant(), p => Uri.UnescapeDataString(p[1]).ToLowerInvariant());
        // Neon (and any URL asking for verify-full) gets an encrypted, certificate-checked connection; sslmode=require
        // is encrypted; otherwise (a private network or a proxy with its own certificate) it prefers encryption.
        var ssl = u.Host.EndsWith(".neon.tech", StringComparison.OrdinalIgnoreCase) || query.GetValueOrDefault("sslmode") == "verify-full" ? "SSL Mode=VerifyFull"
            : query.GetValueOrDefault("sslmode") is "require" or "verify-ca" ? "SSL Mode=Require;Trust Server Certificate=true"
            : "SSL Mode=Prefer;Trust Server Certificate=true";
        var binding = query.GetValueOrDefault("channel_binding") == "require" ? ";Channel Binding=Require" : "";
        return $"Host={u.Host};Port={(u.Port > 0 ? u.Port : 5432)};Database={u.AbsolutePath.TrimStart('/')};Username={user};Password={pass};{ssl}{binding}";
    }

    internal static StackExchange.Redis.ConfigurationOptions ParseRedisConnectionString(string raw)
    {
        if (Uri.TryCreate(raw, UriKind.Absolute, out var u) && 
           (u.Scheme.Equals("redis", StringComparison.OrdinalIgnoreCase) || 
            u.Scheme.Equals("rediss", StringComparison.OrdinalIgnoreCase) ||
            u.Scheme.Equals("valkey", StringComparison.OrdinalIgnoreCase) ||
            u.Scheme.Equals("valkeys", StringComparison.OrdinalIgnoreCase)))
        {
            var isSsl = u.Scheme.Equals("rediss", StringComparison.OrdinalIgnoreCase) || u.Scheme.Equals("valkeys", StringComparison.OrdinalIgnoreCase);
            var parts = u.UserInfo.Split(':', 2);
            var pass = parts.Length == 2 ? Uri.UnescapeDataString(parts[1]) : (parts.Length == 1 ? Uri.UnescapeDataString(parts[0]) : null);
            var user = parts.Length == 2 && parts[0].Length > 0 && parts[0] != "default" ? Uri.UnescapeDataString(parts[0]) : null;
            var port = u.Port > 0 ? u.Port : (isSsl ? 6380 : 6379);
            var opts = new StackExchange.Redis.ConfigurationOptions
            {
                EndPoints = { { u.Host, port } },
                Ssl = isSsl,
                AbortOnConnectFail = false,
                ConnectTimeout = 5000,
                SyncTimeout = 5000
            };
            if (!string.IsNullOrEmpty(pass)) opts.Password = pass;
            if (!string.IsNullOrEmpty(user)) opts.User = user;
            return opts;
        }

        var parsed = StackExchange.Redis.ConfigurationOptions.Parse(raw);
        parsed.AbortOnConnectFail = false;
        parsed.ConnectTimeout = 5000;
        parsed.SyncTimeout = 5000;
        return parsed;
    }
}

