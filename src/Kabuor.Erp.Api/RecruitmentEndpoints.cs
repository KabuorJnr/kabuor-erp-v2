// Candidate applications, vetting, and interview scheduling.
using System.Text.Json;
using Kabuor.Erp.Auth;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;

namespace Kabuor.Erp;

public sealed record JobApplicationSubmission(
    string FullName,
    string Email,
    string Phone,
    string RoleTitle,
    string Department,
    string LinkedIn,
    string? Portfolio,
    string ExperienceYears,
    string CoverNote
);

public sealed record UpdateStatusInput(
    string Status,
    string? VettingNotes,
    int? Rating
);

public sealed record ScheduleInterviewInput(
    string InterviewType,
    string ScheduledAt,
    string? MeetUrl,
    string? Notes,
    string? Interviewer
);

public sealed class JobApplicationRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string RefCode { get; set; } = $"KBR-APP-{Random.Shared.Next(100000, 999999)}";
    public required string FullName { get; set; }
    public required string Email { get; set; }
    public required string Phone { get; set; }
    public required string RoleTitle { get; set; }
    public required string Department { get; set; }
    public required string LinkedIn { get; set; }
    public string Portfolio { get; set; } = "";
    public string ExperienceYears { get; set; } = "";
    public string CoverNote { get; set; } = "";
    public string Status { get; set; } = "New"; // New, Shortlisted, InterviewScheduled, OfferExtended, Rejected
    public string VettingNotes { get; set; } = "";
    public int Rating { get; set; } = 0; // 0 - 5
    public string? InterviewType { get; set; } // GoogleMeet, Phone, InPerson
    public string? InterviewScheduledAt { get; set; }
    public string? MeetUrl { get; set; }
    public string? InterviewNotes { get; set; }
    public string? Interviewer { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public static class RecruitmentStore
{
    private static readonly object Sync = new();
    private static readonly string StoragePath = Path.Combine(AppContext.BaseDirectory, "recruitment_applications.json");
    private static List<JobApplicationRecord>? _cache;

    private static List<JobApplicationRecord> Load()
    {
        lock (Sync)
        {
            if (_cache != null) return _cache;
            if (!File.Exists(StoragePath))
            {
                _cache = SeedApplications();
                Save(_cache);
                return _cache;
            }

            try
            {
                var json = File.ReadAllText(StoragePath);
                _cache = JsonSerializer.Deserialize<List<JobApplicationRecord>>(json) ?? SeedApplications();
            }
            catch
            {
                _cache = SeedApplications();
            }
            return _cache;
        }
    }

    private static void Save(List<JobApplicationRecord> list)
    {
        lock (Sync)
        {
            _cache = list;
            var json = JsonSerializer.Serialize(list, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(StoragePath, json);
        }
    }

    public static List<JobApplicationRecord> GetAll() => Load().OrderByDescending(x => x.CreatedAt).ToList();

    public static JobApplicationRecord? Get(Guid id) => Load().FirstOrDefault(x => x.Id == id);

    public static JobApplicationRecord Add(JobApplicationSubmission sub)
    {
        var record = new JobApplicationRecord
        {
            FullName = sub.FullName.Trim(),
            Email = sub.Email.Trim().ToLowerInvariant(),
            Phone = sub.Phone.Trim(),
            RoleTitle = sub.RoleTitle.Trim(),
            Department = sub.Department.Trim(),
            LinkedIn = sub.LinkedIn.Trim(),
            Portfolio = sub.Portfolio?.Trim() ?? "",
            ExperienceYears = sub.ExperienceYears.Trim(),
            CoverNote = sub.CoverNote.Trim(),
            Status = "New",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };

        lock (Sync)
        {
            var list = Load();
            list.Insert(0, record);
            Save(list);
        }
        return record;
    }

    public static JobApplicationRecord UpdateStatus(Guid id, UpdateStatusInput input)
    {
        lock (Sync)
        {
            var list = Load();
            var item = list.FirstOrDefault(x => x.Id == id) ?? throw new AppException("Application not found.", 404);
            item.Status = input.Status;
            if (input.VettingNotes != null) item.VettingNotes = input.VettingNotes;
            if (input.Rating.HasValue) item.Rating = Math.Clamp(input.Rating.Value, 0, 5);
            item.UpdatedAt = DateTimeOffset.UtcNow;
            Save(list);
            return item;
        }
    }

    public static JobApplicationRecord ScheduleInterview(Guid id, ScheduleInterviewInput input)
    {
        lock (Sync)
        {
            var list = Load();
            var item = list.FirstOrDefault(x => x.Id == id) ?? throw new AppException("Application not found.", 404);
            item.Status = "InterviewScheduled";
            item.InterviewType = input.InterviewType;
            item.InterviewScheduledAt = input.ScheduledAt;
            item.MeetUrl = !string.IsNullOrWhiteSpace(input.MeetUrl) ? input.MeetUrl.Trim() : $"https://meet.google.com/kbr-{(item.RefCode.ToLowerInvariant().Replace("kbr-app-", ""))}";
            item.InterviewNotes = input.Notes ?? "";
            item.Interviewer = input.Interviewer ?? "Founder / Hiring Committee";
            item.UpdatedAt = DateTimeOffset.UtcNow;
            Save(list);
            return item;
        }
    }

    private static List<JobApplicationRecord> SeedApplications()
    {
        return new List<JobApplicationRecord>
        {
            new()
            {
                RefCode = "KBR-APP-842190",
                FullName = "Brian Kiprono Mutai",
                Email = "brian.mutai@techkenya.co.ke",
                Phone = "0722 415 890",
                RoleTitle = "Lead Platform Architect (.NET 10 / Cloud)",
                Department = "Engineering",
                LinkedIn = "https://linkedin.com/in/briankiprono-arch",
                Portfolio = "https://github.com/kiprono-systems",
                ExperienceYears = "6-9 years",
                CoverNote = "Scaled fintech ledger at Cellulant handling 200 TPS. Passionate about low-allocation C# and distributed transactions for East African trade.",
                Status = "Shortlisted",
                Rating = 5,
                VettingNotes = "Exceptional concurrency knowledge. Built custom memory pools. Recommended for Founder Interview.",
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-2),
            },
            new()
            {
                RefCode = "KBR-APP-631024",
                FullName = "Wanjiku Brenda Njeri",
                Email = "wanjiku.njeri@growthke.com",
                Phone = "0715 892 341",
                RoleTitle = "Head of Growth & Performance Marketing",
                Department = "Marketing & Growth",
                LinkedIn = "https://linkedin.com/in/wanjiku-njeri-growth",
                Portfolio = "https://wanjikunjerigrowth.sub量tack.com",
                ExperienceYears = "6-9 years",
                CoverNote = "Scaled Wasoko merchant acquisition funnels across 4 counties with payback under 45 days. Ready to lead Kabuor ERP across 1.5M Kenyan SMEs.",
                Status = "InterviewScheduled",
                Rating = 5,
                InterviewType = "GoogleMeet",
                InterviewScheduledAt = DateTimeOffset.UtcNow.AddDays(1).ToString("yyyy-MM-ddTHH:mm:00Z"),
                MeetUrl = "https://meet.google.com/kbr-growth-lead",
                Interviewer = "Founder & CEO",
                InterviewNotes = "Final deep dive on trade corridor marketing and accountant affiliate incentives.",
                VettingNotes = "Deep mastery of Kenyan B2B acquisition channels and paid search attribution.",
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-3),
            },
            new()
            {
                RefCode = "KBR-APP-294711",
                FullName = "Kevin Omondi Otieno",
                Email = "kevin.omondi@etims-experts.ke",
                Phone = "0701 563 812",
                RoleTitle = "Head of Tax Compliance & eTIMS Architecture",
                Department = "Engineering",
                LinkedIn = "https://linkedin.com/in/kevin-omondi-tax",
                Portfolio = "",
                ExperienceYears = "10+ years",
                CoverNote = "Former fiscal device specialist and VSCU middleware developer. Directly authored eTIMS cryptographic integration for large supermarket chains in Kenya.",
                Status = "New",
                Rating = 4,
                VettingNotes = "Strong regulatory background. Need to verify C# fluency.",
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-5),
            }
        };
    }
}

public static class RecruitmentEndpoints
{
    public static void Map(RouteGroupBuilder api, IEndpointRouteBuilder app)
    {
        // Public candidate application submission
        api.MapPost("/careers/apply", (JobApplicationSubmission input) =>
        {
            if (string.IsNullOrWhiteSpace(input.FullName)) throw new AppException("Full name is required.");
            if (string.IsNullOrWhiteSpace(input.Email)) throw new AppException("Email address is required.");
            if (string.IsNullOrWhiteSpace(input.Phone)) throw new AppException("Phone number is required.");
            if (string.IsNullOrWhiteSpace(input.RoleTitle)) throw new AppException("Role is required.");
            if (string.IsNullOrWhiteSpace(input.LinkedIn)) throw new AppException("LinkedIn profile URL is required.");

            var record = RecruitmentStore.Add(input);
            return Results.Ok(new
            {
                ok = true,
                id = record.Id,
                refCode = record.RefCode,
                message = "Application submitted successfully to Kabuor ERP Talent Desk."
            });
        });

        // Protected Admin/People vetting and interview scheduling
        var admin = api.MapGroup("/recruitment").RequireAuthorization(Policies.People);

        admin.MapGet("/applications", (string? status, string? department, string? q) =>
        {
            var all = RecruitmentStore.GetAll();
            var counts = new
            {
                all = all.Count,
                newCount = all.Count(x => x.Status == "New"),
                shortlisted = all.Count(x => x.Status == "Shortlisted"),
                scheduled = all.Count(x => x.Status == "InterviewScheduled"),
                offered = all.Count(x => x.Status == "OfferExtended"),
                rejected = all.Count(x => x.Status == "Rejected"),
            };

            var filtered = all.AsEnumerable();

            if (!string.IsNullOrWhiteSpace(status) && status != "All")
            {
                filtered = filtered.Where(x => string.Equals(x.Status, status, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(department) && department != "All")
            {
                filtered = filtered.Where(x => string.Equals(x.Department, department, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(q))
            {
                var query = q.Trim().ToLowerInvariant();
                filtered = filtered.Where(x =>
                    x.FullName.ToLowerInvariant().Contains(query) ||
                    x.Email.ToLowerInvariant().Contains(query) ||
                    x.Phone.Contains(query) ||
                    x.RoleTitle.ToLowerInvariant().Contains(query) ||
                    x.RefCode.ToLowerInvariant().Contains(query) ||
                    x.CoverNote.ToLowerInvariant().Contains(query)
                );
            }

            return Results.Ok(new { counts, items = filtered.ToList() });
        });

        admin.MapGet("/applications/{id:guid}", (Guid id) =>
        {
            var appItem = RecruitmentStore.Get(id);
            if (appItem == null) return Results.NotFound(new { error = "Candidate application not found." });
            return Results.Ok(appItem);
        });

        admin.MapPost("/applications/{id:guid}/status", (Guid id, UpdateStatusInput input) =>
        {
            var updated = RecruitmentStore.UpdateStatus(id, input);
            return Results.Ok(updated);
        });

        admin.MapPost("/applications/{id:guid}/schedule", (Guid id, ScheduleInterviewInput input) =>
        {
            var scheduled = RecruitmentStore.ScheduleInterview(id, input);
            return Results.Ok(scheduled);
        });
    }
}
