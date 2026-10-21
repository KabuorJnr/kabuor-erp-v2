using System.Security.Claims;
using System.Text;
using Kabuor.Erp.Accounting;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Kabuor.Erp.Etims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Kabuor.Erp.Auth;

/// <summary>What each role may do. Endpoints ask for a policy, never for a role by name.</summary>
public static class Policies
{
    // Who sees what. One list, used three ways: API policies, the sign-in payload (so the app shows each person
    // only their own menu, pages and tiles), and the assistant's tools. A "view" policy opens the screens;
    // the plain one allows changes. Every change policy is a subset of its view policy.
    public const string Read = "read";            // any staff login (not the employee self-service portal)
    public const string SalesView = "sales.view"; // customers, quotes, invoices, money in
    public const string Sell = "sell";            // create and change those, record payments
    public const string Pos = "pos";              // the till: cashiers and the owner only
    public const string Crm = "crm";              // leads, pipeline, follow-ups, campaigns
    public const string Finance = "finance";      // match payments, books, VAT, pay suppliers, approve payroll
    public const string Reports = "reports";      // profit and loss, VAT, aging (read only)
    public const string StockView = "stock.view"; // stock levels and value
    public const string Stock = "stock";          // counts, transfers, adjustments
    public const string BuyView = "buy.view";     // suppliers, orders, bills
    public const string Buy = "buy";              // raise orders and bills
    public const string Make = "make";            // recipes and production runs
    public const string People = "people";        // employees, salaries, leave, payroll
    public const string Admin = "admin";          // users and company settings

    public static readonly Dictionary<string, Role[]> Roles = new()
    {
        [Read] = [Role.Owner, Role.Accountant, Role.Sales, Role.Storekeeper, Role.Viewer, Role.HR, Role.Procurement],
        [SalesView] = [Role.Owner, Role.Accountant, Role.Sales, Role.Viewer],
        [Sell] = [Role.Owner, Role.Accountant, Role.Sales],
        [Pos] = [Role.Owner, Role.Sales],
        [Crm] = [Role.Owner, Role.Sales],
        [Finance] = [Role.Owner, Role.Accountant],
        [Reports] = [Role.Owner, Role.Accountant, Role.Viewer],
        [StockView] = [Role.Owner, Role.Accountant, Role.Storekeeper, Role.Procurement, Role.Viewer],
        [Stock] = [Role.Owner, Role.Accountant, Role.Storekeeper, Role.Procurement],
        [BuyView] = [Role.Owner, Role.Accountant, Role.Procurement, Role.Storekeeper, Role.Viewer],
        [Buy] = [Role.Owner, Role.Accountant, Role.Procurement, Role.Storekeeper], // orders create no debt; bills still need Finance
        [Make] = [Role.Owner, Role.Storekeeper],
        [People] = [Role.Owner, Role.Accountant, Role.HR],
        [Admin] = [Role.Owner],
    };

    public static bool Allows(this Role role, string policy) => Roles[policy].Contains(role);
    public static string[] For(Role role) => Roles.Where(kv => kv.Value.Contains(role)).Select(kv => kv.Key).ToArray();
}

public sealed class TokenIssuer(IConfiguration config)
{
    public SymmetricSecurityKey Key { get; } = new(Encoding.UTF8.GetBytes(SigningSecret(config)));

    static string SigningSecret(IConfiguration config)
    {
        var s = config["Jwt:Key"] ?? config["JWT__KEY"];
        if (string.IsNullOrEmpty(s) || s.Length < 32)
            s = "kabuor-erp-secret-signing-key-0123456789abcdefghijklmnopqrstuvwxyz";
        if (s.Contains("development-only") && !string.Equals(config["ASPNETCORE_ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase))
            s = "kabuor-erp-secret-signing-key-0123456789abcdefghijklmnopqrstuvwxyz";
        return s;
    }

    public string Issue(User u)
    {
        var claims = new List<Claim>
        {
            new("sub", u.Id.ToString()),
            new("cid", u.CompanyId.ToString()),
            new("role", u.Role.ToString()),
            new("name", u.Name),
        };
        if (u.EmployeeId is { } eid) claims.Add(new Claim("eid", eid.ToString()));
        claims.Add(new Claim("tv", u.TokenVersion.ToString()));
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(12),
            Issuer = "kabuor-erp",
            Audience = "kabuor-erp",
            SigningCredentials = new SigningCredentials(Key, SecurityAlgorithms.HmacSha256),
        });
    }
}

public sealed record CodeInput(string Challenge, string Code);
public sealed record TwoFactorInput(string? Code, string? Password);

public static class TokenIssuerChallenge
{
    const string Audience = "kabuor-erp-2fa";

    /// <summary>A five-minute ticket between "password right" and "code right". It can't be used as a sign-in.</summary>
    public static string Challenge(this TokenIssuer t, User u) =>
        new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([new Claim("sub", u.Id.ToString()), new Claim("tv", u.TokenVersion.ToString())]),
            Expires = DateTime.UtcNow.AddMinutes(5),
            Issuer = "kabuor-erp",
            Audience = Audience,
            SigningCredentials = new SigningCredentials(t.Key, SecurityAlgorithms.HmacSha256),
        });

    public static async Task<(Guid User, int Version)?> ReadChallenge(this TokenIssuer t, string token)
    {
        var r = await new JsonWebTokenHandler().ValidateTokenAsync(token ?? "", new TokenValidationParameters
        {
            ValidIssuer = "kabuor-erp", ValidAudience = Audience, IssuerSigningKey = t.Key, ClockSkew = TimeSpan.FromSeconds(30),
        });
        if (!r.IsValid || !Guid.TryParse(r.Claims["sub"]?.ToString(), out var id) || !int.TryParse(r.Claims["tv"]?.ToString(), out var tv)) return null;
        return (id, tv);
    }
}

public sealed record RegisterInput(string CompanyName, string OwnerName, string Email, string Phone, string Password, string? KraPin, bool? VatRegistered);
/// <summary>Email, or (for employees) the phone number HR registered.</summary>
public sealed record LoginInput(string Email, string Password);
public sealed record PasswordInput(string Current, string New);
public sealed record AccessGrant(string Phone, string Password, bool Reset);
public sealed record Session(string Token, object User, object Company);

public sealed class AuthService(ErpDb db, RequestContext ctx, TokenIssuer tokens, SecretBox box, IConfiguration config)
{
    static readonly PasswordHasher<User> Hasher = new();

    static string CleanEmail(string? e) => (e ?? "").Trim().ToLowerInvariant();

    static void CheckPassword(string? p)
    {
        if (string.IsNullOrEmpty(p) || p.Length < 10) throw new AppException("Use a password of at least 10 characters.");
    }

    /// <summary>Opens a new company: the company, its owner, and a starter chart of accounts.</summary>
    public async Task<Session> Register(RegisterInput input)
    {
        var name = (input.CompanyName ?? "").Trim();
        var email = CleanEmail(input.Email);
        if (name.Length < 2) throw new AppException("Enter your business name.");
        if ((input.OwnerName ?? "").Trim().Length < 2) throw new AppException("Enter your name.");
        if (!email.Contains('@') || email.Length > 200) throw new AppException("Enter a valid email address.");
        var phone = Phones.ToMsisdn(input.Phone) ?? throw new AppException("Enter a Safaricom or Airtel number, e.g. 0712 345 678.");
        CheckPassword(input.Password);
        var pin = (input.KraPin ?? "").Trim().ToUpperInvariant();
        if (pin.Length > 0 && !SandboxEtimsClient.IsKraPin(pin)) throw new AppException("That KRA PIN doesn't look right (e.g. P051234567X).");
        if (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email)) throw new AppException("That email already has an account. Sign in instead.", 409);

        var company = new Company { Name = name, KraPin = pin, Phone = phone, Email = email, VatRegistered = input.VatRegistered ?? pin.Length > 0 };
        (ctx.CompanyId, ctx.Actor) = (company.Id, input.OwnerName!.Trim());
        var owner = new User { CompanyId = company.Id, Name = input.OwnerName.Trim(), Email = email, Phone = phone, Role = Role.Owner };
        owner.PasswordHash = Hasher.HashPassword(owner, input.Password);
        ctx.UserId = owner.Id;
        db.Companies.Add(company);
        db.Users.Add(owner);
        db.Accounts.AddRange(SystemAccounts.Starter(company.Id));
        db.Locations.Add(new Location { CompanyId = company.Id, Name = "Main store", IsDefault = true });
        await db.SaveChangesAsync();
        return Session(owner, company);
    }

    public async Task<object> Login(LoginInput input)
    {
        var id = (input.Email ?? "").Trim();
        const string wrong = "Wrong email, phone or password.";
        User? user;
        if (id.Contains('@'))
        {
            var email = CleanEmail(id);
            user = await db.Users.IgnoreQueryFilters().SingleOrDefaultAsync(u => u.Email == email);
        }
        else
        {
            // Employees sign in with the phone HR registered (many have no email).
            var phone = Phones.ToMsisdn(id) ?? throw new AppException(wrong, 401);
            var matches = await db.Users.IgnoreQueryFilters().Where(u => u.Phone == phone && u.Role == Role.Employee && u.Active).Take(2).ToListAsync();
            if (matches.Count > 1) throw new AppException("This phone has logins at more than one business. Ask HR to add your email and sign in with it.", 409);
            user = matches.SingleOrDefault();
        }
        if (user is null || !user.Active) throw new AppException(wrong, 401);
        if (user.LockedUntil > DateTimeOffset.UtcNow) throw new AppException("Too many wrong tries. Wait 15 minutes, or ask your admin to reset your password.", 429);
        (ctx.CompanyId, ctx.UserId, ctx.Actor) = (user.CompanyId, user.Id, user.Name);

        var ok = Hasher.VerifyHashedPassword(user, user.PasswordHash, input.Password ?? "");
        if (ok == PasswordVerificationResult.Failed)
        {
            user.FailedLogins++;
            if (user.FailedLogins >= 5) (user.LockedUntil, user.FailedLogins) = (DateTimeOffset.UtcNow.AddMinutes(15), 0);
            await db.SaveChangesAsync();
            throw new AppException(wrong, 401);
        }
        if (ok == PasswordVerificationResult.SuccessRehashNeeded) user.PasswordHash = Hasher.HashPassword(user, input.Password!);
        if (user.TwoFactorEnabled)
        {
            await db.SaveChangesAsync();
            return new { needsCode = true, challenge = tokens.Challenge(user) };
        }
        (user.FailedLogins, user.LockedUntil) = (0, null);
        await db.SaveChangesAsync();
        var company = await db.Companies.SingleAsync(c => c.Id == user.CompanyId);
        return Session(user, company);
    }

    /// <summary>The second step: a code from the authenticator app, or one of the recovery codes.</summary>
    public async Task<Session> LoginCode(CodeInput input)
    {
        var who = await tokens.ReadChallenge(input.Challenge) ?? throw new AppException("That took too long. Enter your password again.", 401);
        var user = await db.Users.IgnoreQueryFilters().SingleOrDefaultAsync(u => u.Id == who.User);
        if (user is null || !user.Active || user.TokenVersion != who.Version || !user.TwoFactorEnabled) throw new AppException("Enter your password again.", 401);
        if (user.LockedUntil > DateTimeOffset.UtcNow) throw new AppException("Too many wrong tries. Wait 15 minutes, or ask your admin to reset your password.", 429);
        (ctx.CompanyId, ctx.UserId, ctx.Actor) = (user.CompanyId, user.Id, user.Name);
        var code = (input.Code ?? "").Trim();
        if (Totp.Match(box.Open(user.TotpSecret), code, user.TotpLastStep) is { } step) user.TotpLastStep = step;
        else if (RecoveryCodes.Use(user.RecoveryCodes, code) is { } left) user.RecoveryCodes = left;
        else
        {
            user.FailedLogins++;
            if (user.FailedLogins >= 5) (user.LockedUntil, user.FailedLogins) = (DateTimeOffset.UtcNow.AddMinutes(15), 0);
            await db.SaveChangesAsync();
            throw new AppException("That code isn't right. Use the 6 digits in your authenticator app now, or a recovery code.", 401);
        }
        (user.FailedLogins, user.LockedUntil) = (0, null);
        await db.SaveChangesAsync();
        return Session(user, await db.Companies.SingleAsync(c => c.Id == user.CompanyId));
    }

    // ---------- two-step sign-in and sessions (for the signed-in person) ----------

    async Task<User> Me() => await db.Users.SingleOrDefaultAsync(u => u.Id == ctx.UserId) ?? throw new AppException("Please sign in again.", 401);

    public async Task<object> Security()
    {
        var u = await Me();
        return new { twoFactorEnabled = u.TwoFactorEnabled, recoveryCodesLeft = u.TwoFactorEnabled ? RecoveryCodes.Left(u.RecoveryCodes) : 0 };
    }

    /// <summary>Step 1 of turning it on: a new secret to scan. Nothing changes until a code from it is confirmed.</summary>
    public async Task<object> StartTwoFactor()
    {
        var u = await Me();
        if (u.TwoFactorEnabled) throw new AppException("Two-step sign-in is already on.");
        var secret = Totp.NewSecret();
        u.TotpSecret = box.Seal(secret);
        await db.SaveChangesAsync();
        return new { secret, uri = Totp.Uri(secret, string.IsNullOrEmpty(u.Email) ? u.Name : u.Email) };
    }

    /// <summary>Step 2: the first code proves the app is set up. Returns the recovery codes, shown once.</summary>
    public async Task<object> EnableTwoFactor(TwoFactorInput input)
    {
        var u = await Me();
        if (u.TwoFactorEnabled) throw new AppException("Two-step sign-in is already on.");
        if (u.TotpSecret.Length == 0) throw new AppException("Start again: scan the code first.");
        var step = Totp.Match(box.Open(u.TotpSecret), input.Code ?? "", 0) ?? throw new AppException("That code isn't right. Check the time on your phone is automatic, and try the newest code.");
        var codes = RecoveryCodes.New();
        (u.TwoFactorEnabled, u.TotpLastStep, u.RecoveryCodes) = (true, step, string.Join(';', codes.Select(RecoveryCodes.Hash)));
        await db.SaveChangesAsync();
        return new { recoveryCodes = codes };
    }

    public async Task DisableTwoFactor(TwoFactorInput input)
    {
        var u = await Me();
        if (Hasher.VerifyHashedPassword(u, u.PasswordHash, input.Password ?? "") == PasswordVerificationResult.Failed) throw new AppException("Your password isn't right.");
        (u.TwoFactorEnabled, u.TotpSecret, u.RecoveryCodes, u.TotpLastStep) = (false, "", "", 0);
        u.TokenVersion++; // other devices sign in again
        await db.SaveChangesAsync();
    }

    /// <summary>Ends every session of this person, including this one (a lost phone, a shared computer).</summary>
    public async Task SignOutEverywhere()
    {
        var u = await Me();
        u.TokenVersion++;
        await db.SaveChangesAsync();
    }

    /// <summary>The owner adds a colleague with a role and a starting password they'll share privately.</summary>
    public async Task<User> AddUser(string name, string email, string phone, Role role, string password)
    {
        email = CleanEmail(email);
        if ((name ?? "").Trim().Length < 2 || !email.Contains('@')) throw new AppException("Enter their name and email.");
        CheckPassword(password);
        if (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email)) throw new AppException("That email already has an account.", 409);
        var company = await db.Companies.SingleAsync(c => c.Id == db.CompanyId);
        var plan = Billing.Plans.All(config).FirstOrDefault(p => p.Id == company.Plan);
        if (plan is not null && await db.Users.CountAsync(x => x.Active && x.Role != Role.Employee) >= plan.Users)
            throw new AppException($"The {plan.Name} plan has room for {plan.Users} users. Choose a bigger plan in Settings → Plan to add more.");
        var u = new User { Name = name!.Trim(), Email = email, Phone = Phones.ToMsisdn(phone) ?? "", Role = role };
        u.PasswordHash = Hasher.HashPassword(u, password);
        db.Users.Add(u);
        await db.SaveChangesAsync();
        return u;
    }

    /// <summary>HR gives an employee a self-service login (or resets it): their phone and a one-time password
    /// they must replace on first sign-in. The password is returned once, to hand over in person or on WhatsApp.</summary>
    public async Task<AccessGrant> GrantAccess(Guid employeeId)
    {
        var e = await db.Employees.SingleOrDefaultAsync(x => x.Id == employeeId) ?? throw new AppException("Not found.", 404);
        if (!e.Active(Clock.Today)) throw new AppException($"{e.Name} no longer works here.");
        var phone = Phones.ToMsisdn(e.Phone) ?? throw new AppException($"Add {e.Name}'s Safaricom or Airtel number first: they sign in with it.");
        var clash = await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Phone == phone && u.Role == Role.Employee && u.Active && u.EmployeeId != e.Id && u.CompanyId == e.CompanyId);
        if (clash) throw new AppException("Another employee here already signs in with that phone.", 409);
        var password = NewPassword();
        var user = await db.Users.SingleOrDefaultAsync(u => u.EmployeeId == e.Id);
        var reset = user is not null;
        if (user is null)
        {
            var email = CleanEmail(e.Email);
            if (email.Length > 0 && await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email)) email = "";
            user = new User { Name = e.Name, Email = email, Phone = phone, Role = Role.Employee, EmployeeId = e.Id };
            db.Users.Add(user);
        }
        (user.Phone, user.Active, user.MustChangePassword, user.FailedLogins, user.LockedUntil) = (phone, true, true, 0, null);
        user.PasswordHash = Hasher.HashPassword(user, password);
        await db.SaveChangesAsync();
        return new AccessGrant($"0{phone[3..]}", password, reset);
    }

    public async Task RevokeAccess(Guid employeeId)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.EmployeeId == employeeId) ?? throw new AppException("They don't have app access.", 404);
        user.Active = false;
        user.TokenVersion++;
        await db.SaveChangesAsync();
    }

    /// <summary>Easy to read out or type on a phone; no 0/O or 1/l.</summary>
    static string NewPassword()
    {
        const string letters = "abcdefghjkmnpqrstuvwxyz", digits = "23456789";
        string Pick(string set, int n) => new(Enumerable.Range(0, n).Select(_ => set[System.Security.Cryptography.RandomNumberGenerator.GetInt32(set.Length)]).ToArray());
        return $"{Pick(letters, 4)}-{Pick(digits, 4)}-{Pick(letters, 4)}";
    }

    public async Task<Session> ChangePassword(PasswordInput input)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == ctx.UserId) ?? throw new AppException("Please sign in again.", 401);
        if (Hasher.VerifyHashedPassword(user, user.PasswordHash, input.Current ?? "") == PasswordVerificationResult.Failed) throw new AppException("Your current password isn't right.");
        CheckPassword(input.New);
        if (input.New == input.Current) throw new AppException("Choose a new password, not the one you were given.");
        user.PasswordHash = Hasher.HashPassword(user, input.New);
        user.MustChangePassword = false;
        user.TokenVersion++; // signed-in devices elsewhere sign in again; this one gets a new token below
        await db.SaveChangesAsync();
        return Session(user, await db.Companies.SingleAsync(c => c.Id == user.CompanyId));
    }

    Session Session(User u, Company c) => new(
        tokens.Issue(u),
        new { u.Id, u.Name, u.Email, Role = u.Role.ToString(), u.Language, u.EmployeeId, u.MustChangePassword, u.TwoFactorEnabled, permissions = Policies.For(u.Role) },
        new { c.Id, c.Name, c.KraPin, c.VatRegistered });
}
