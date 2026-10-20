// Until the project moves to EF migrations: EnsureCreated builds a new database in full, but does nothing to one
// that already exists. This adds any table or index the model has gained since (a new module), on SQLite and
// PostgreSQL alike. It never alters or drops what is there; new columns on old tables still need a migration.
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Data;

public static partial class SchemaSync
{
    public static async Task AddMissingTables(ErpDb db)
    {
        await db.Database.EnsureCreatedAsync();
        var script = db.Database.GenerateCreateScript();
        foreach (var raw in script.Split(";", StringSplitOptions.RemoveEmptyEntries))
        {
            var sql = raw.Trim();
            if (sql.StartsWith("CREATE TABLE ", StringComparison.Ordinal)) sql = "CREATE TABLE IF NOT EXISTS " + sql["CREATE TABLE ".Length..];
            else if (Index().IsMatch(sql)) sql = Index().Replace(sql, "$1 IF NOT EXISTS ", 1);
            else continue;
            await db.Database.ExecuteSqlRawAsync(sql.Replace("{", "{{").Replace("}", "}}"));
        }
    }

    [GeneratedRegex(@"^(CREATE (?:UNIQUE )?INDEX) ")]
    private static partial Regex Index();
}
