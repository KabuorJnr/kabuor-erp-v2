// Agents: their setup (the owner switches them on), "run now", and the task inbox people approve from.
using Kabuor.Erp.Agents;
using Kabuor.Erp.Auth;

namespace Kabuor.Erp;

public static class AgentEndpoints
{
    public static void Map(RouteGroupBuilder api)
    {
        var g = api.MapGroup("/agents");
        g.MapGet("", (AgentService s) => s.List());
        g.MapPut("/{key}", (string key, AgentConfigInput input, AgentService s) => s.Configure(key, input)).RequireAuthorization(Policies.Admin);
        g.MapPost("/{key}/run", (string key, AgentService s) => s.RunNow(key));
        g.MapGet("/tasks", (string? status, AgentService s) => s.Tasks(status));
        g.MapPost("/tasks/{id:guid}/approve", (Guid id, AgentDecision? input, AgentService s) => s.Decide(id, true, input ?? new(null, null)));
        g.MapPost("/tasks/{id:guid}/dismiss", (Guid id, AgentDecision? input, AgentService s) => s.Decide(id, false, input ?? new(null, null)));
    }
}
