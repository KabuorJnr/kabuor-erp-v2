using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Kabuor.Erp.Sales;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Auth;

/// <summary>
/// Streamlines onboarding and quick-start self-service for newly registered organizations.
/// Allows a business owner to configure payment collection, add first client & item,
/// and issue their first invoice in under 5 minutes.
/// </summary>
public sealed class OnboardingService(
    ErpDb db,
    SalesService sales,
    Numbers numbers)
{
    public async Task<OnboardingStatus> GetStatus()
    {
        var company = await db.Companies.SingleOrDefaultAsync(c => c.Id == db.CompanyId)
            ?? throw new AppException("Company not found.", 404);

        var hasCompanyProfile = !string.IsNullOrWhiteSpace(company.Name) &&
            (!string.IsNullOrWhiteSpace(company.Email) || !string.IsNullOrWhiteSpace(company.Phone));

        var hasPaymentConfigured = !string.IsNullOrWhiteSpace(company.MpesaShortcode) ||
                                   !string.IsNullOrWhiteSpace(company.StkConsumerKey) ||
                                   !string.IsNullOrWhiteSpace(company.StkShortcode);

        var hasCustomer = await db.Customers.AnyAsync();
        var hasItem = await db.Items.AnyAsync();
        var hasInvoice = await db.SalesDocs.AnyAsync(s => s.Kind == SalesDocKind.Invoice);

        int total = 4;
        int completed = 0;
        if (hasPaymentConfigured) completed++;
        if (hasCustomer) completed++;
        if (hasItem) completed++;
        if (hasInvoice) completed++;

        int percentage = (int)Math.Round((double)completed / total * 100);

        string nextAction = !hasPaymentConfigured
            ? "Connect your M-Pesa Paybill/Till number to start collecting money."
            : !hasCustomer
                ? "Add your first client or buyer."
                : !hasItem
                    ? "Add a product or service to your catalog."
                    : !hasInvoice
                        ? "Create and send your first invoice."
                        : "You're all set! Ready to transact and grow.";

        return new OnboardingStatus(
            CompanyProfileCompleted: hasCompanyProfile,
            PaymentConfigured: hasPaymentConfigured,
            FirstCustomerAdded: hasCustomer,
            FirstItemAdded: hasItem,
            FirstInvoiceCreated: hasInvoice,
            TotalSteps: total,
            CompletedSteps: completed,
            CompletionPercentage: percentage,
            IsReadyToTransact: hasPaymentConfigured && hasInvoice,
            NextRecommendedAction: nextAction
        );
    }

    public async Task<QuickstartSetupResult> Quickstart(QuickstartSetupInput input)
    {
        var company = await db.Companies.SingleOrDefaultAsync(c => c.Id == db.CompanyId)
            ?? throw new AppException("Company not found.", 404);

        // 1. Configure payments if provided
        if (!string.IsNullOrWhiteSpace(input.MpesaShortcode))
        {
            company.MpesaShortcode = input.MpesaShortcode.Trim();
            if (!string.IsNullOrWhiteSpace(input.StkEnvironment))
                company.StkEnvironment = input.StkEnvironment.Trim();
        }

        // 2. Add Customer if provided
        Customer? customer = null;
        if (input.Customer is not null && !string.IsNullOrWhiteSpace(input.Customer.Name))
        {
            customer = new Customer
            {
                CompanyId = company.Id,
                Number = await numbers.Next("CUST"),
                Name = input.Customer.Name.Trim(),
                Phone = Phones.ToMsisdn(input.Customer.Phone) ?? (input.Customer.Phone ?? "").Trim(),
                Email = (input.Customer.Email ?? "").Trim(),
            };
            db.Customers.Add(customer);
            await db.SaveChangesAsync();
        }
        else
        {
            customer = await db.Customers.FirstOrDefaultAsync();
        }

        // 3. Add Item if provided
        Item? item = null;
        if (input.Item is not null && !string.IsNullOrWhiteSpace(input.Item.Name))
        {
            item = new Item
            {
                CompanyId = company.Id,
                Name = input.Item.Name.Trim(),
                Price = Math.Max(0, input.Item.UnitPriceCents),
                Unit = string.IsNullOrWhiteSpace(input.Item.Unit) ? "pc" : input.Item.Unit.Trim(),
                Kind = ItemKind.Service,
                TaxType = TaxType.B_Standard16,
            };
            db.Items.Add(item);
            await db.SaveChangesAsync();
        }
        else
        {
            item = await db.Items.FirstOrDefaultAsync();
        }

        // 4. Generate first invoice if requested
        Guid? invoiceId = null;
        string? invoiceNumber = null;
        long totalCents = 0;

        if (input.CreateFirstInvoice && customer is not null)
        {
            var lines = new List<LineInput>();
            decimal qty = Math.Max(1, input.Quantity ?? 1);

            if (item is not null)
            {
                lines.Add(new LineInput(item.Id, item.Name, qty, item.Price, TaxType.B_Standard16));
            }
            else
            {
                lines.Add(new LineInput(null, "Starter Service / Product", qty, 100000, TaxType.B_Standard16));
            }

            var doc = await sales.Create(new SalesDocInput(
                Kind: SalesDocKind.Invoice,
                CustomerId: customer.Id,
                IssueDate: Clock.Today,
                DueInDays: 7,
                Notes: "Thank you for your business!",
                Lines: lines
            ));

            // Issue invoice to post ledger and calculate balances
            doc = await sales.Issue(doc.Id);

            invoiceId = doc.Id;
            invoiceNumber = doc.Number;
            totalCents = doc.Total;

            ErpTelemetry.RecordInvoice("invoice", doc.Total, company.Id);
        }

        await db.SaveChangesAsync();

        return new QuickstartSetupResult(
            CustomerId: customer?.Id,
            ItemId: item?.Id,
            InvoiceId: invoiceId,
            InvoiceNumber: invoiceNumber,
            TotalCents: totalCents,
            Status: "Ready",
            Message: invoiceId is not null
                ? $"Onboarding complete! First invoice {invoiceNumber} issued for {Money.Ksh(totalCents)}."
                : "Settings and catalog updated successfully."
        );
    }
}
