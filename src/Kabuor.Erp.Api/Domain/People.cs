// People: employees, their pay, leave and payroll runs. Salaries are sensitive, so every endpoint that reads
// these needs the "people" policy (owner, accountant, HR), never just a sign-in.
namespace Kabuor.Erp.Domain;

public enum PayMethod
{
    Mpesa,
    Bank,
    Cash,
}

public sealed class Employee : ICompanyOwned
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CompanyId { get; set; }
    public required string Number { get; set; } // E-0001
    public required string Name { get; set; }
    public string Phone { get; set; } = "";
    public string Email { get; set; } = "";
    public string KraPin { get; set; } = "";
    public string NationalId { get; set; } = "";
    public string NssfNumber { get; set; } = "";
    public string ShaNumber { get; set; } = ""; // Social Health Authority (SHIF) number
    public string JobTitle { get; set; } = "";
    public string Department { get; set; } = "";
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    /// <summary>Monthly basic salary, in cents.</summary>
    public long BasicSalary { get; set; }
    /// <summary>Regular monthly allowances that are taxed (house, transport…), in cents.</summary>
    public long TaxableAllowances { get; set; }
    /// <summary>Monthly amounts paid but not taxed (e.g. reimbursements), in cents.</summary>
    public long NonTaxableAllowances { get; set; }
    public PayMethod PayMethod { get; set; } = PayMethod.Mpesa;
    public string PayPhone { get; set; } = "";
    public string BankName { get; set; } = "";
    public string BankAccount { get; set; } = "";
    public decimal AnnualLeaveDays { get; set; } = 21; // the Employment Act minimum
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool Active(DateOnly on) => StartDate <= on && (EndDate is null || EndDate >= on);
}

public enum LeaveType
{
    Annual,
    Sick,
    Maternity,
    Paternity,
    Compassionate,
    Unpaid,
}

public enum LeaveStatus
{
    Pending,
    Approved,
    Rejected,
    Cancelled,
}

public sealed class LeaveRequest : ICompanyOwned
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CompanyId { get; set; }
    public Guid EmployeeId { get; set; }
    public Employee? Employee { get; set; }
    public LeaveType Type { get; set; }
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    /// <summary>Working days (Monday to Friday) in the range.</summary>
    public decimal Days { get; set; }
    public LeaveStatus Status { get; set; } = LeaveStatus.Pending;
    public string Note { get; set; } = "";
    public string DecidedBy { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum PayrollStatus
{
    Draft,
    Approved, // posted to the books
    Paid,     // net pay sent
}

public sealed class PayrollRun : ICompanyOwned
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CompanyId { get; set; }
    /// <summary>First day of the month paid, e.g. 2026-10-01.</summary>
    public DateOnly Period { get; set; }
    public PayrollStatus Status { get; set; } = PayrollStatus.Draft;
    public List<Payslip> Payslips { get; set; } = [];
    public string ApprovedBy { get; set; } = "";
    public DateTimeOffset? PaidAt { get; set; }
    public string PaidReference { get; set; } = "";
    /// <summary>Statutory payments made for this month, e.g. "PAYE,NSSF".</summary>
    public string Remitted { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>One employee's pay for one month. Every amount in cents.</summary>
public sealed class Payslip : ICompanyOwned
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CompanyId { get; set; }
    public Guid PayrollRunId { get; set; }
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = "";
    public long Basic { get; set; }
    public long TaxableAllowances { get; set; }
    /// <summary>One-off taxable pay this month: overtime, bonus, commission.</summary>
    public long ExtraEarnings { get; set; }
    public long NonTaxableAllowances { get; set; }
    public long Gross { get; set; }
    public long NssfEmployee { get; set; }
    public long NssfEmployer { get; set; }
    public long Shif { get; set; }
    public long HousingLevyEmployee { get; set; }
    public long HousingLevyEmployer { get; set; }
    public long Taxable { get; set; }
    public long PayeBeforeRelief { get; set; }
    public long PersonalRelief { get; set; }
    public long Paye { get; set; }
    public long Nita { get; set; }
    /// <summary>After-tax deductions: salary advance, loan repayment, SACCO.</summary>
    public long OtherDeductions { get; set; }
    public string Note { get; set; } = "";
    public long Net { get; set; }
}
