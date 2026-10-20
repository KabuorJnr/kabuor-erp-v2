// Lets `dotnet ef migrations add` build the model for PostgreSQL (production) without a running database.
// Migrations are PostgreSQL-only; local SQLite files and the tests still use EnsureCreated + SchemaSync.
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Kabuor.Erp.Data;

public sealed class DesignTimeFactory : IDesignTimeDbContextFactory<ErpDb>
{
    public ErpDb CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<ErpDb>().UseNpgsql("Host=localhost;Database=kabuor_design;Username=design;Password=design").Options, new RequestContext());
}
