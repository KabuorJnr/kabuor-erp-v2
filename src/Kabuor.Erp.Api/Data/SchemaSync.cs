// Getting the database to the shape of the model at start-up.
//  - PostgreSQL (production): EF migrations (Data/Migrations). A database first made by EnsureCreated, before
//    migrations existed, is recognised and marked as being at the first migration, then brought up to date.
//  - SQLite (development files and the tests): EnsureCreated, then any table or column the model has gained
//    since the file was made is added. Columns are only ever added, never changed or dropped.
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Kabuor.Erp.Data;

public static partial class SchemaSync
{
    public static async Task Prepare(ErpDb db)
    {
        if (db.Database.IsNpgsql()) await Migrate(db);
        else await SyncSqlite(db);
    }

    static async Task Migrate(ErpDb db)
    {
        var first = db.Database.GetMigrations().First();
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
    }

    static async Task SyncSqlite(ErpDb db)
    {
        await db.Database.EnsureCreatedAsync();
        foreach (var raw in db.Database.GenerateCreateScript().Split(";", StringSplitOptions.RemoveEmptyEntries))
        {
            var sql = raw.Trim();
            if (sql.StartsWith("CREATE TABLE ", StringComparison.Ordinal)) sql = "CREATE TABLE IF NOT EXISTS " + sql["CREATE TABLE ".Length..];
            else if (Index().IsMatch(sql)) sql = Index().Replace(sql, "$1 IF NOT EXISTS ", 1);
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
                    var fallback = type.Contains("TEXT", StringComparison.OrdinalIgnoreCase) ? "''" : "0";
                    await db.Database.ExecuteSqlRawAsync($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {type}{(notNull ? $" NOT NULL DEFAULT {fallback}" : "")}");
                }
            }
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    [GeneratedRegex(@"^(CREATE (?:UNIQUE )?INDEX) ")]
    private static partial Regex Index();
}
