// Wakes every few minutes and runs each switched-on agent whose turn has come, company by company.
// Each run gets its own scope: the company, the agent as the actor, and the role of whoever switched it on.
using Kabuor.Erp.Data;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Agents;

public sealed class AgentScheduler(IServiceScopeFactory scopes, IConfiguration config, ILogger<AgentScheduler> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        if (config.GetValue("Agents:Disabled", false)) return; // tests and one-off tools
        var tick = TimeSpan.FromMinutes(config.GetValue("Agents:TickMinutes", 5));
        await Task.Delay(TimeSpan.FromSeconds(30), stop);
        while (!stop.IsCancellationRequested)
        {
            try { await RunDue(stop); }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogError(e, "Agent scheduler tick failed"); }
            await Task.Delay(tick, stop);
        }
    }

    public async Task RunDue(CancellationToken stop = default)
    {
        List<(Guid Id, Guid Company, string Key)> due;
        using (var scope = scopes.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ErpDb>();
            var now = DateTimeOffset.UtcNow;
            var on = await db.AgentSetups.IgnoreQueryFilters().Where(s => s.Enabled).ToListAsync(stop);
            due = on.Where(s => s.LastRunAt is null || now - s.LastRunAt >= AgentService.Info(s.Key).Every - TimeSpan.FromMinutes(1))
                .Select(s => (s.Id, s.CompanyId, s.Key)).ToList();
        }
        foreach (var (id, company, key) in due)
        {
            using var scope = scopes.CreateScope();
            var ctx = scope.ServiceProvider.GetRequiredService<RequestContext>();
            var db = scope.ServiceProvider.GetRequiredService<ErpDb>();
            ctx.CompanyId = company;
            var setup = await db.AgentSetups.SingleAsync(s => s.Id == id, stop);
            (ctx.Role, ctx.UserId, ctx.Actor) = (setup.EnabledByRole, null, AgentService.Info(key).Name);
            var summary = await scope.ServiceProvider.GetRequiredService<AgentService>().Run(setup);
            log.LogInformation("Agent {Agent} for {Company}: {Summary}", key, company, summary);
        }
    }
}
