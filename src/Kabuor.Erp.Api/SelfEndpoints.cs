// Employee self-service ("me"): their own leave, payslips and P9, nothing else. Every query is pinned to the
// signed-in person's employee record; a login without one gets nothing. Until someone sets their own password
// (after HR created or reset it), only the password change works.
using Kabuor.Erp.Auth;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Kabuor.Erp.Payroll;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp;

public sealed record MyLeaveInput(LeaveType Type, DateOnly From, DateOnly To, string? Note);

public static class SelfEndpoints
{
    /// <summary>The caller's employee record, after checking they're allowed to use self-service right now.</summary>
    static async Task<Employee> Me(ErpDb db, RequestContext ctx)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == ctx.UserId) ?? throw new AppException("Please sign in again.", 401);
        if (user.MustChangePassword) throw new AppException("Set your own password first.", 403);
        if (user.EmployeeId is not { } eid) throw new AppException("Your login isn't linked to an employee record. Ask HR.", 404);
        return await db.Employees.SingleOrDefaultAsync(e => e.Id == eid) ?? throw new AppException("Your employee record wasn't found. Ask HR.", 404);
    }

    static bool Visible(PayrollStatus s) => s != PayrollStatus.Draft; // drafts can still change

    public static void Map(WebApplication app)
    {
        app.MapPost("/api/auth/password", (PasswordInput input, AuthService auth) => auth.ChangePassword(input)).RequireAuthorization();

        var me = app.MapGroup("/api/me").RequireAuthorization();
        me.MapGet("", async (ErpDb db, RequestContext ctx, PeopleService people) =>
        {
            var e = await Me(db, ctx);
            var company = await db.Companies.SingleAsync(c => c.Id == db.CompanyId);
            var leave = await db.LeaveRequests.Where(l => l.EmployeeId == e.Id).OrderByDescending(l => l.From).Take(50).ToListAsync();
            var payslips = await db.Payslips.Join(db.PayrollRuns, s => s.PayrollRunId, r => r.Id, (s, r) => new { s, r })
                .Where(x => x.s.EmployeeId == e.Id && x.r.Status != PayrollStatus.Draft)
                .OrderByDescending(x => x.r.Period).Take(24)
                .Select(x => new { runId = x.r.Id, period = x.r.Period, x.s.Gross, x.s.Net, paid = x.r.Status == PayrollStatus.Paid })
                .ToListAsync();
            var today = Clock.Today;
            return new
            {
                company = company.Name,
                employee = new { e.Name, e.Number, e.JobTitle, e.Department, e.StartDate, e.Phone, e.KraPin, e.NssfNumber, e.ShaNumber, e.PayMethod, e.AnnualLeaveDays },
                leaveBalance = await people.LeaveBalance(e),
                leave,
                upcoming = leave.Where(l => l.Status is LeaveStatus.Approved or LeaveStatus.Pending && l.To >= today).OrderBy(l => l.From),
                payslips,
            };
        });
        me.MapPost("/leave", async (MyLeaveInput input, ErpDb db, RequestContext ctx, PeopleService people) =>
        {
            var e = await Me(db, ctx);
            if (input.From < Clock.Today.AddDays(-30)) throw new AppException("That's too far in the past; ask HR to record it.");
            return Results.Created("", await people.RequestLeave(new LeaveInput(e.Id, input.Type, input.From, input.To, input.Note)));
        });
        me.MapPost("/leave/{id:guid}/cancel", async (Guid id, ErpDb db, RequestContext ctx) =>
        {
            var e = await Me(db, ctx);
            var l = await db.LeaveRequests.SingleOrDefaultAsync(x => x.Id == id && x.EmployeeId == e.Id) ?? throw new AppException("Not found.", 404);
            if (l.Status != LeaveStatus.Pending) throw new AppException("Only a request that hasn't been decided can be withdrawn. Ask HR to change approved leave.");
            l.Status = LeaveStatus.Cancelled;
            await db.SaveChangesAsync();
            return l;
        });
        me.MapGet("/payslips/{runId:guid}", async (Guid runId, ErpDb db, RequestContext ctx) =>
        {
            var e = await Me(db, ctx);
            var run = await db.PayrollRuns.SingleOrDefaultAsync(r => r.Id == runId) ?? throw new AppException("Not found.", 404);
            if (!Visible(run.Status)) throw new AppException("Not found.", 404);
            var slip = await db.Payslips.SingleOrDefaultAsync(s => s.PayrollRunId == runId && s.EmployeeId == e.Id) ?? throw new AppException("Not found.", 404);
            return new { period = run.Period, paid = run.Status == PayrollStatus.Paid, slip };
        });
        me.MapGet("/p9", async (int? year, ErpDb db, RequestContext ctx, PeopleService people) => await people.P9((await Me(db, ctx)).Id, year ?? Clock.Today.Year));

        // HR side: give or take away an employee's self-service login.
        var hr = app.MapGroup("/api/employees/{id:guid}/access").RequireAuthorization(Policies.People);
        hr.MapGet("", async (Guid id, ErpDb db) =>
        {
            var u = await db.Users.SingleOrDefaultAsync(x => x.EmployeeId == id);
            return new { hasAccess = u is { Active: true }, mustChangePassword = u?.MustChangePassword ?? false, phone = u?.Phone };
        });
        hr.MapPost("", (Guid id, AuthService auth) => auth.GrantAccess(id));
        hr.MapDelete("", async (Guid id, AuthService auth) =>
        {
            await auth.RevokeAccess(id);
            return Results.NoContent();
        });
    }
}
