// Getting the database to the shape of the model at start-up.
//  - PostgreSQL (production): EF migrations (Data/Migrations). A database first made by EnsureCreated, before
//    migrations existed, is recognised and marked as being at the first migration, then brought up to date.
//  - SQLite (development files and the tests): EnsureCreated, then any table or column the model has gained
//    since the file was made is added. Columns are only ever added, never changed or dropped.
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage;

namespace Kabuor.Erp.Data;

public static partial class SchemaSync
{
    public static async Task Prepare(ErpDb db)
    {
        if (db.Database.IsNpgsql()) await Migrate(db);
        else await SyncSqlite(db);

        await SeedPlatformAdmin(db);
        await SeedDemoBusiness(db);
        await SeedOdhiamboBusiness(db);
    }

    static async Task Migrate(ErpDb db)
    {
        var first = db.Database.GetMigrations().First();
        // A brand-new server has no database yet: migrations create it from scratch.
        if (!await db.GetService<IRelationalDatabaseCreator>().ExistsAsync())
        {
            await db.Database.MigrateAsync();
            return;
        }
        var conn = db.Database.GetDbConnection();
        await db.Database.OpenConnectionAsync();
        try
        {
            async Task<bool> Exists(string table)
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = $"SELECT to_regclass('public.\"{table}\"') IS NOT NULL";
                return (bool)(await cmd.ExecuteScalarAsync())!;
            }
            if (!await Exists("__EFMigrationsHistory") && await Exists("Companies"))
            {
                var version = typeof(DbContext).Assembly.GetName().Version!.ToString(3);
                await db.Database.ExecuteSqlRawAsync("""
                    CREATE TABLE "__EFMigrationsHistory" ("MigrationId" character varying(150) NOT NULL PRIMARY KEY, "ProductVersion" character varying(32) NOT NULL);
                    """);
                await db.Database.ExecuteSqlRawAsync("""INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ({0}, {1})""", first, version);
            }
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
        await db.Database.MigrateAsync();
        await SyncPostgreSqlColumns(db);
    }

    static async Task SyncPostgreSqlColumns(ErpDb db)
    {
        try
        {
            var conn = db.Database.GetDbConnection();
            await db.Database.OpenConnectionAsync();
            try
            {
                foreach (var entity in db.Model.GetEntityTypes())
                {
                    var table = entity.GetTableName();
                    if (string.IsNullOrEmpty(table)) continue;
                    var store = Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table(table, null);
                    foreach (var p in entity.GetProperties())
                    {
                        var column = p.GetColumnName(store);
                        if (string.IsNullOrEmpty(column)) continue;
                        var type = p.GetColumnType();
                        var notNull = !p.IsNullable;
                        var fallback = p.Name == "UnitFactor" ? "'1.0'"
                            : type.Contains("text", StringComparison.OrdinalIgnoreCase) || type.Contains("varchar", StringComparison.OrdinalIgnoreCase) ? "''"
                            : type.Contains("uuid", StringComparison.OrdinalIgnoreCase) ? "'00000000-0000-0000-0000-000000000000'"
                            : type.Contains("timestamp", StringComparison.OrdinalIgnoreCase) ? "NOW()"
                            : type.Contains("bool", StringComparison.OrdinalIgnoreCase) ? "FALSE"
                            : "0";
                        var sql = $"ALTER TABLE IF EXISTS \"{table}\" ADD COLUMN IF NOT EXISTS \"{column}\" {type}{(notNull ? $" NOT NULL DEFAULT {fallback}" : "")};";
                        await using var cmd = conn.CreateCommand();
                        cmd.CommandText = sql;
                        await cmd.ExecuteNonQueryAsync();
                    }
                }
            }
            finally
            {
                await db.Database.CloseConnectionAsync();
            }
        }
        catch
        {
            // Non-blocking schema safeguard
        }
    }

    static async Task SyncSqlite(ErpDb db)
    {
        await db.Database.EnsureCreatedAsync();
        try { await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;"); } catch { }
        // Tables first, then missing columns, then indexes (a new index can be on a column added just now).
        var indexes = new List<string>();
        foreach (var raw in db.Database.GenerateCreateScript().Split(";", StringSplitOptions.RemoveEmptyEntries))
        {
            var sql = raw.Trim();
            if (sql.StartsWith("CREATE TABLE ", StringComparison.Ordinal)) sql = "CREATE TABLE IF NOT EXISTS " + sql["CREATE TABLE ".Length..];
            else if (Index().IsMatch(sql)) { indexes.Add(Index().Replace(sql, "$1 IF NOT EXISTS ", 1)); continue; }
            else continue;
            await db.Database.ExecuteSqlRawAsync(sql.Replace("{", "{{").Replace("}", "}}"));
        }

        // Columns added to existing tables since the file was created.
        var conn = db.Database.GetDbConnection();
        await db.Database.OpenConnectionAsync();
        try
        {
            foreach (var entity in db.Model.GetEntityTypes())
            {
                var table = entity.GetTableName();
                if (table is null) continue;
                var have = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                await using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $"PRAGMA table_info(\"{table}\")";
                    await using var r = await cmd.ExecuteReaderAsync();
                    while (await r.ReadAsync()) have.Add(r.GetString(1));
                }
                var store = Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table(table, null);
                foreach (var p in entity.GetProperties())
                {
                    var column = p.GetColumnName(store);
                    if (column is null || have.Contains(column)) continue;
                    var type = p.GetColumnType();
                    var notNull = !p.IsNullable;
                    var fallback = p.Name == "UnitFactor" ? "'1.0'" // lines from before units: one base unit each
                        : type.Contains("TEXT", StringComparison.OrdinalIgnoreCase) ? "''" : "0";
                    await db.Database.ExecuteSqlRawAsync($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {type}{(notNull ? $" NOT NULL DEFAULT {fallback}" : "")}");
                }
            }
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
        foreach (var sql in indexes) await db.Database.ExecuteSqlRawAsync(sql.Replace("{", "{{").Replace("}", "}}"));
    }

    [GeneratedRegex(@"^(CREATE (?:UNIQUE )?INDEX) ")]
    private static partial Regex Index();

    public static readonly Guid PlatformCompanyId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid PlatformAdminUserId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    static async Task SeedPlatformAdmin(ErpDb db)
    {
        try
        {
            const string email = "rooneykabuor2004@gmail.com";
            var company = await db.Companies.FirstOrDefaultAsync(c => c.Name == "Kabuor Builds" || c.Id == PlatformCompanyId);
            if (company is null)
            {
                company = new Domain.Company
                {
                    Id = PlatformCompanyId,
                    Name = "Kabuor Builds",
                    Email = email,
                    Phone = "0705607954",
                    County = "Nairobi",
                    Plan = "enterprise",
                    PaidUntil = DateTimeOffset.UtcNow.AddYears(10)
                };
                db.Companies.Add(company);
                await db.SaveChangesAsync();
            }

            var user = await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == email || u.Id == PlatformAdminUserId);
            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<Domain.User>();
            if (user is null)
            {
                user = new Domain.User
                {
                    Id = PlatformAdminUserId,
                    CompanyId = company.Id,
                    Name = "Rooney Kabuor",
                    Email = email,
                    Phone = "0705607954",
                    Role = Domain.Role.Owner,
                    TwoFactorEnabled = false,
                    Active = true,
                    CreatedAt = DateTimeOffset.UtcNow,
                    LastSignInAt = DateTimeOffset.UtcNow
                };
                user.PasswordHash = hasher.HashPassword(user, "KabuorAdmin2026!");
                db.Users.Add(user);
                await db.SaveChangesAsync();
            }
            else
            {
                user.Active = true;
                user.Role = Domain.Role.Owner;
                user.Email = email;
                user.CompanyId = company.Id;
                user.PasswordHash = hasher.HashPassword(user, "KabuorAdmin2026!");
                await db.SaveChangesAsync();
            }
        }
        catch { /* best-effort bootstrap */ }
    }

    public static readonly Guid DemoCompanyId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    static async Task SeedDemoBusiness(ErpDb db)
    {
        try
        {
            var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == DemoCompanyId || c.Name == "Amani Distributors Ltd");
            if (company is null)
            {
                company = new Domain.Company
                {
                    Id = DemoCompanyId,
                    Name = "Amani Distributors Ltd",
                    Email = "accounts@amani.test",
                    Phone = "0712000001",
                    County = "Nairobi",
                    KraPin = "P051234567X",
                    VatRegistered = true,
                    Plan = "growth",
                    Industry = "distribution",
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-60),
                    PaidUntil = DateTimeOffset.UtcNow.AddDays(180)
                };
                db.Companies.Add(company);
                await db.SaveChangesAsync();
            }

            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<Domain.User>();
            var staffDefs = new[]
            {
                ("Grace Wambui", "owner@amani.test", "0712000001", Domain.Role.Owner, "Amani-owner-2026!"),
                ("Peter Otieno", "peter@amani.test", "0712000002", Domain.Role.Accountant, "Amani-peter-2026"),
                ("Mercy Achieng", "mercy@amani.test", "0712000003", Domain.Role.Sales, "Amani-mercy-2026"),
                ("Joseph Mutua", "joseph@amani.test", "0712000004", Domain.Role.Storekeeper, "Amani-joseph-2026"),
                ("Faith Njeri", "faith@amani.test", "0712000005", Domain.Role.HR, "Amani-faith-2026"),
            };

            foreach (var (name, email, phone, role, pass) in staffDefs)
            {
                var u = await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Email == email && x.CompanyId == company.Id);
                if (u is null)
                {
                    u = new Domain.User
                    {
                        CompanyId = company.Id,
                        Name = name,
                        Email = email,
                        Phone = phone,
                        Role = role,
                        Active = true,
                        CreatedAt = DateTimeOffset.UtcNow.AddDays(-55),
                        LastSignInAt = DateTimeOffset.UtcNow.AddHours(-3)
                    };
                    u.PasswordHash = hasher.HashPassword(u, pass);
                    db.Users.Add(u);
                }
            }
            await db.SaveChangesAsync();

            // Sample Customer
            var customer = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.CompanyId == company.Id);
            if (customer is null)
            {
                customer = new Domain.Customer
                {
                    CompanyId = company.Id,
                    Number = "C-0001",
                    Name = "Mama Njeri Supermarket",
                    Phone = "0722100200",
                    Email = "mamanjeri@duka.test",
                    Address = "Ngara Market, Stalls 41-44",
                    CreditLimit = 150_000_00,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-50)
                };
                db.Customers.Add(customer);
                await db.SaveChangesAsync();
            }

            // Sample Invoices
            var hasInvoices = await db.SalesDocs.IgnoreQueryFilters().AnyAsync(d => d.CompanyId == company.Id);
            if (!hasInvoices)
            {
                var doc1 = new Domain.SalesDoc
                {
                    CompanyId = company.Id,
                    Kind = Domain.SalesDocKind.Invoice,
                    Number = "INV-0001",
                    CustomerId = customer.Id,
                    IssueDate = Common.Clock.Today.AddDays(-14),
                    DueDate = Common.Clock.Today.AddDays(16),
                    Net = 120_000_00,
                    Tax = 19_200_00,
                    Total = 139_200_00,
                    Paid = 139_200_00,
                    Status = Domain.SalesDocStatus.Paid,
                    EtimsStatus = Domain.EtimsStatus.Signed,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-14)
                };
                var doc2 = new Domain.SalesDoc
                {
                    CompanyId = company.Id,
                    Kind = Domain.SalesDocKind.Invoice,
                    Number = "INV-0002",
                    CustomerId = customer.Id,
                    IssueDate = Common.Clock.Today.AddDays(-2),
                    DueDate = Common.Clock.Today.AddDays(28),
                    Net = 95_000_00,
                    Tax = 15_200_00,
                    Total = 110_200_00,
                    Paid = 0,
                    Status = Domain.SalesDocStatus.Sent,
                    EtimsStatus = Domain.EtimsStatus.Signed,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-2)
                };
                db.SalesDocs.AddRange(doc1, doc2);
                await db.SaveChangesAsync();
            }

            // Sample Support Issues
            var hasInquiries = await db.Inquiries.IgnoreQueryFilters().AnyAsync(i => i.CompanyId == company.Id);
            if (!hasInquiries)
            {
                var inq1 = new Domain.Inquiry
                {
                    CompanyId = company.Id,
                    Number = "ISS-1001",
                    Name = "Grace Wambui (Owner)",
                    Phone = "0712000001",
                    Email = "owner@amani.test",
                    Subject = "Need assistance integrating KRA eTIMS OSCU device with our physical warehouse barcode scanner",
                    Channel = Domain.Channel.Website,
                    Status = Domain.InquiryStatus.Open,
                    CreatedAt = DateTimeOffset.UtcNow.AddHours(-18)
                };
                inq1.Messages.Add(new Domain.InquiryMessage
                {
                    CompanyId = company.Id,
                    From = "customer",
                    Author = "Grace Wambui",
                    Text = "Hello Kabuor Team, our eTIMS device received KRA validation approval yesterday. How do we test direct print sync with the thermal till receipts?",
                    At = DateTimeOffset.UtcNow.AddHours(-18)
                });

                var inq2 = new Domain.Inquiry
                {
                    CompanyId = company.Id,
                    Number = "ISS-1002",
                    Name = "Peter Otieno (Accountant)",
                    Phone = "0712000002",
                    Email = "peter@amani.test",
                    Subject = "Request to verify M-Pesa B2B bank settlement reconciliation rules",
                    Channel = Domain.Channel.WhatsApp,
                    Status = Domain.InquiryStatus.Answered,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-2),
                    FirstResponseAt = DateTimeOffset.UtcNow.AddDays(-2).AddMinutes(45)
                };
                inq2.Messages.Add(new Domain.InquiryMessage
                {
                    CompanyId = company.Id,
                    From = "customer",
                    Author = "Peter Otieno",
                    Text = "We noticed M-Pesa Paybill statements now show separate utility charges. Are these automatically booked under Bank Charges?",
                    At = DateTimeOffset.UtcNow.AddDays(-2)
                });
                inq2.Messages.Add(new Domain.InquiryMessage
                {
                    CompanyId = company.Id,
                    From = "staff",
                    Author = "Rooney Kabuor (Platform Admin)",
                    Text = "Yes Peter, standard tariff fees are automatically posted to Account 6200 (Bank & M-Pesa Charges) during statement sync.",
                    At = DateTimeOffset.UtcNow.AddDays(-2).AddMinutes(45)
                });

                db.Inquiries.AddRange(inq1, inq2);
                await db.SaveChangesAsync();
            }
        }
        catch { /* best-effort bootstrap */ }
    }

    public static readonly Guid OdhiamboCompanyId = Guid.Parse("c73e0159-264e-4ff6-a640-4cfab9ccf8fa");
    public static readonly Guid OdhiamboUserId = Guid.Parse("44444444-4444-4444-4444-444444444444");

    static async Task SeedOdhiamboBusiness(ErpDb db)
    {
        try
        {
            const string email = "rooneyodhiambo2004@gmail.com";
            var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == OdhiamboCompanyId || c.Email == email || c.Name == "Odhiambo Enterprises" || c.Name.StartsWith("Driver"));
            if (company is null)
            {
                company = new Domain.Company
                {
                    Id = OdhiamboCompanyId,
                    Name = "Driver Logistics Ltd",
                    Email = email,
                    Phone = "0712345678",
                    County = "Nairobi",
                    KraPin = "P059876543Z",
                    VatRegistered = true,
                    Plan = "growth",
                    Industry = "transportation",
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-30),
                    PaidUntil = DateTimeOffset.UtcNow.AddYears(5),
                    TrialEndsAt = DateTimeOffset.UtcNow.AddYears(5)
                };
                db.Companies.Add(company);
                await db.SaveChangesAsync();
            }
            else if (company.Name == "Odhiambo Enterprises")
            {
                company.Name = "Driver Logistics Ltd";
                company.Industry = "transportation";
                await db.SaveChangesAsync();
            }

            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<Domain.User>();
            var user = await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == email || u.Id == OdhiamboUserId);
            if (user is null)
            {
                user = new Domain.User
                {
                    Id = OdhiamboUserId,
                    CompanyId = company.Id,
                    Name = "Rooney Odhiambo",
                    Email = email,
                    Phone = "0712345678",
                    Role = Domain.Role.Owner,
                    TwoFactorEnabled = false,
                    Active = true,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-30),
                    LastSignInAt = DateTimeOffset.UtcNow
                };
                user.PasswordHash = hasher.HashPassword(user, "Password1234!");
                db.Users.Add(user);
                await db.SaveChangesAsync();
            }
            else
            {
                user.Active = true;
                user.Role = Domain.Role.Owner;
                user.CompanyId = company.Id;
                await db.SaveChangesAsync();
            }

            // Starter Accounts
            var hasAccounts = await db.Accounts.IgnoreQueryFilters().AnyAsync(a => a.CompanyId == company.Id);
            if (!hasAccounts)
            {
                db.Accounts.AddRange(Accounting.SystemAccounts.Starter(company.Id));
                await db.SaveChangesAsync();
            }

            // Default Location
            var hasLocation = await db.Locations.IgnoreQueryFilters().AnyAsync(l => l.CompanyId == company.Id);
            if (!hasLocation)
            {
                db.Locations.Add(new Domain.Location { CompanyId = company.Id, Name = "Main store", IsDefault = true });
                await db.SaveChangesAsync();
            }

            // Starter Customer
            var customer = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.CompanyId == company.Id);
            if (customer is null)
            {
                customer = new Domain.Customer
                {
                    CompanyId = company.Id,
                    Number = "C-0001",
                    Name = "Lake Basin Supplies Ltd",
                    Phone = "0722334455",
                    Email = "procurement@lakebasin.co.ke",
                    Address = "Upper Hill, Nairobi",
                    CreditLimit = 200_000_00,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-20)
                };
                db.Customers.Add(customer);
                await db.SaveChangesAsync();
            }

            // Starter Invoice
            var hasInvoices = await db.SalesDocs.IgnoreQueryFilters().AnyAsync(d => d.CompanyId == company.Id);
            if (!hasInvoices)
            {
                var doc = new Domain.SalesDoc
                {
                    CompanyId = company.Id,
                    Kind = Domain.SalesDocKind.Invoice,
                    Number = "INV-1001",
                    CustomerId = customer.Id,
                    IssueDate = Common.Clock.Today.AddDays(-7),
                    DueDate = Common.Clock.Today.AddDays(23),
                    Net = 45_000_00,
                    Tax = 7_200_00,
                    Total = 52_200_00,
                    Paid = 52_200_00,
                    Status = Domain.SalesDocStatus.Paid,
                    EtimsStatus = Domain.EtimsStatus.Signed,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-7)
                };
                db.SalesDocs.Add(doc);
                await db.SaveChangesAsync();
            }
        }
        catch { /* best-effort bootstrap */ }
    }
}
