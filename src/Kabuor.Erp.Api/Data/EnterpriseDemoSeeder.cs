using Kabuor.Erp.Accounting;
using Kabuor.Erp.Common;
using Kabuor.Erp.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Data;

public static class EnterpriseDemoSeeder
{
    const string DefaultPassword = "Password1234!";
    static readonly string PrecomputedPasswordHash = new PasswordHasher<User>().HashPassword(null!, DefaultPassword);

    public static async Task SeedEnterpriseNetwork(ErpDb db)
    {
        try
        {
            // Demo businesses seeded before on "scale", which isn't a plan, so MRR left them out.
            await db.Companies.IgnoreQueryFilters().Where(c => c.Plan == "scale").ExecuteUpdateAsync(s => s.SetProperty(c => c.Plan, "business"));

            // If already seeded at least 50 companies, do not duplicate
            var count = await db.Companies.IgnoreQueryFilters().CountAsync();
            if (count >= 50) return;

            var existingIds = (await db.Companies.IgnoreQueryFilters().Select(c => c.Id).ToListAsync()).ToHashSet();
            var companiesDef = GetCompaniesDefinition();
            var employeeTemplates = GetEmployeeTemplates();

            for (int i = 0; i < companiesDef.Length; i++)
            {
                var def = companiesDef[i];
                var companyId = Guid.Parse($"b0000000-0000-0000-0000-{(i + 1):D12}");

                // Check if this company already exists
                if (existingIds.Contains(companyId)) continue;

                var company = new Company
                {
                    Id = companyId,
                    Name = def.Name,
                    Email = def.Email,
                    Phone = def.Phone,
                    County = def.County,
                    KraPin = def.KraPin,
                    VatRegistered = true,
                    Plan = i % 2 == 0 ? "business" : "growth",
                    Industry = def.Industry,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-120 - (i % 60)),
                    PaidUntil = DateTimeOffset.UtcNow.AddMonths(12 + (i % 6)),
                    TrialEndsAt = DateTimeOffset.UtcNow.AddMonths(12 + (i % 6))
                };
                db.Companies.Add(company);

                // Default Location
                var loc = new Location
                {
                    Id = Guid.Parse($"c0000000-0000-0000-0000-{(i + 1):D12}"),
                    CompanyId = company.Id,
                    Name = def.LocationName,
                    IsDefault = true,
                    Active = true
                };
                db.Locations.Add(loc);

                // 20 Employees and 20 Users each
                for (int j = 0; j < 20; j++)
                {
                    var empTpl = employeeTemplates[j];
                    var empId = Guid.Parse($"e{i + 1:D3}0000-0000-0000-0000-{(j + 1):D12}");
                    var userId = Guid.Parse($"1{i + 1:D3}0000-0000-0000-0000-{(j + 1):D12}");

                    var empEmail = $"{empTpl.FirstName.ToLowerInvariant()}.{empTpl.LastName.ToLowerInvariant()}@{def.Domain}";
                    var empPhone = $"07{((i * 17 + j * 13) % 90 + 10):D2}{((j * 37 + i * 29) % 900000 + 100000):D6}";

                    var emp = new Employee
                    {
                        Id = empId,
                        CompanyId = company.Id,
                        Number = $"E-{(j + 1):D4}",
                        Name = $"{empTpl.FirstName} {empTpl.LastName}",
                        Email = empEmail,
                        Phone = empPhone,
                        KraPin = $"A00{((i * 23 + j * 7) % 900000 + 100000):D6}K",
                        NationalId = $"{((i * 31 + j * 19) % 9000000 + 10000000):D8}",
                        NssfNumber = $"NSSF{((i * 11 + j * 5) % 90000 + 10000):D5}",
                        ShaNumber = $"SHA{((i * 13 + j * 9) % 90000 + 10000):D5}",
                        JobTitle = empTpl.Title,
                        Department = empTpl.Dept,
                        StartDate = Clock.Today.AddDays(-180 - (j * 10)),
                        BasicSalary = empTpl.SalaryCents,
                        TaxableAllowances = empTpl.AllowanceCents,
                        NonTaxableAllowances = 0,
                        PayMethod = j % 3 == 0 ? PayMethod.Bank : PayMethod.Mpesa,
                        PayPhone = empPhone,
                        BankName = j % 3 == 0 ? (j % 2 == 0 ? "KCB Bank Kenya" : "Equity Bank Kenya") : "",
                        BankAccount = j % 3 == 0 ? $"0110{((i * 50 + j * 11) % 90000000 + 10000000):D8}" : "",
                        AnnualLeaveDays = 21,
                        CreatedAt = DateTimeOffset.UtcNow.AddDays(-180 - (j * 10))
                    };
                    db.Employees.Add(emp);

                    var user = new User
                    {
                        Id = userId,
                        CompanyId = company.Id,
                        EmployeeId = emp.Id,
                        Name = emp.Name,
                        Email = empEmail,
                        Phone = empPhone,
                        Role = empTpl.Role,
                        PasswordHash = PrecomputedPasswordHash,
                        Active = true,
                        TwoFactorEnabled = false,
                        CreatedAt = DateTimeOffset.UtcNow.AddDays(-180 - (j * 10)),
                        LastSignInAt = DateTimeOffset.UtcNow.AddHours(-(i * 3 + j * 2) % 48)
                    };
                    db.Users.Add(user);
                }

                // 2 Customers per company
                var cust1 = new Customer
                {
                    Id = Guid.Parse($"d{i + 1:D3}0000-0000-0000-0000-000000000001"),
                    CompanyId = company.Id,
                    Number = "C-0001",
                    Name = $"{def.City} Commercial Outlets",
                    Email = $"orders@{def.City.ToLowerInvariant()}outlets.co.ke",
                    Phone = $"0722{((i * 19) % 900000 + 100000):D6}",
                    KraPin = $"P05{((i * 37) % 9000000 + 1000000):D7}V"
                };
                var cust2 = new Customer
                {
                    Id = Guid.Parse($"d{i + 1:D3}0000-0000-0000-0000-000000000002"),
                    CompanyId = company.Id,
                    Number = "C-0002",
                    Name = "Apex Retail Traders Ltd",
                    Email = $"supply@apextraders.co.ke",
                    Phone = $"0733{((i * 41) % 900000 + 100000):D6}",
                    KraPin = $"P05{((i * 53) % 9000000 + 1000000):D7}W"
                };
                db.Customers.AddRange(cust1, cust2);

                // 2 Items tailored to sector
                var (itemName1, itemPrice1) = def.Item1;
                var (itemName2, itemPrice2) = def.Item2;

                var item1 = new Item
                {
                    Id = Guid.Parse($"f{i + 1:D3}0000-0000-0000-0000-000000000001"),
                    CompanyId = company.Id,
                    Name = itemName1,
                    Price = itemPrice1,
                    Active = true,
                    TaxType = TaxType.B_Standard16
                };
                var item2 = new Item
                {
                    Id = Guid.Parse($"f{i + 1:D3}0000-0000-0000-0000-000000000002"),
                    CompanyId = company.Id,
                    Name = itemName2,
                    Price = itemPrice2,
                    Active = true,
                    TaxType = TaxType.B_Standard16
                };
                db.Items.AddRange(item1, item2);

                // Active Invoices & Payments to generate realistic enterprise transaction volume
                var inv1Total = (long)(itemPrice1 * 15 * 1.16m);
                var inv1Tax = (long)(inv1Total * 0.16m / 1.16m);
                var doc1 = new SalesDoc
                {
                    Id = Guid.Parse($"8{i + 1:D3}0000-0000-0000-0000-000000000001"),
                    CompanyId = company.Id,
                    Kind = SalesDocKind.Invoice,
                    Number = $"INV-{i + 1:D2}01",
                    CustomerId = cust1.Id,
                    IssueDate = Clock.Today.AddDays(-7 - (i % 14)),
                    DueDate = Clock.Today.AddDays(21),
                    Net = inv1Total - inv1Tax,
                    Tax = inv1Tax,
                    Total = inv1Total,
                    Paid = inv1Total,
                    Status = SalesDocStatus.Paid,
                    EtimsStatus = EtimsStatus.Signed,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-7 - (i % 14))
                };
                db.SalesDocs.Add(doc1);

                var paymentId = Guid.Parse($"9{i + 1:D3}0000-0000-0000-0000-000000000001");
                db.Payments.Add(new Payment
                {
                    Id = paymentId,
                    CompanyId = company.Id,
                    CustomerId = cust1.Id,
                    Amount = inv1Total,
                    Allocated = inv1Total,
                    Method = PaymentMethod.Mpesa,
                    Reference = $"QGH{i + 1:D2}987{i * 3:D3}",
                    Status = PaymentStatus.Matched,
                    ReceivedAt = DateTimeOffset.UtcNow.AddDays(-6 - (i % 14)),
                    Allocations =
                    [
                        new PaymentAllocation
                        {
                            CompanyId = company.Id,
                            PaymentId = paymentId,
                            SalesDocId = doc1.Id,
                            Amount = inv1Total
                        }
                    ]
                });

                var inv2Total = (long)(itemPrice2 * 25 * 1.16m);
                var inv2Tax = (long)(inv2Total * 0.16m / 1.16m);
                var doc2 = new SalesDoc
                {
                    Id = Guid.Parse($"8{i + 1:D3}0000-0000-0000-0000-000000000002"),
                    CompanyId = company.Id,
                    Kind = SalesDocKind.Invoice,
                    Number = $"INV-{i + 1:D2}02",
                    CustomerId = cust2.Id,
                    IssueDate = Clock.Today.AddDays(-2),
                    DueDate = Clock.Today.AddDays(28),
                    Net = inv2Total - inv2Tax,
                    Tax = inv2Tax,
                    Total = inv2Total,
                    Paid = 0,
                    Status = SalesDocStatus.Sent,
                    EtimsStatus = EtimsStatus.Signed,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-2)
                };
                db.SalesDocs.Add(doc2);

                // Save in batches of 25 to minimize network roundtrips
                if ((i + 1) % 25 == 0 || i == companiesDef.Length - 1)
                {
                    await db.SaveChangesAsync();
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[EnterpriseDemoSeeder] Seeding notice: {ex.Message}");
        }
    }

    sealed record CompanyDef(string Name, string Email, string Phone, string County, string City, string KraPin, string Industry, string LocationName, string Domain, (string, long) Item1, (string, long) Item2);
    sealed record EmpTpl(string FirstName, string LastName, string Title, string Dept, Role Role, long SalaryCents, long AllowanceCents);

    static CompanyDef[] GetCompaniesDefinition() =>
    [
        // 1-5 Transport & Fleet Logistics
        new("Rift Express Hauliers Ltd", "info@riftexpress.co.ke", "0722100001", "Nakuru", "Nakuru", "P051000001A", "transportation", "Nakuru Transit Depot", "riftexpress.co.ke", ("Container Haulage (Mombasa-Nakuru)", 185_000_00), ("Local Distribution Trip (Medium Van)", 45_000_00)),
        new("Coast Container Haulage Ltd", "dispatch@coasthaulage.co.ke", "0722100002", "Mombasa", "Mombasa", "P051000002B", "transportation", "Kilindini Bonded Yard", "coasthaulage.co.ke", ("40ft Flatbed Transit to Malaba", 240_000_00), ("Port Shunting (Per Container)", 25_000_00)),
        new("Mara Overland Freight Ltd", "fleet@maraoverland.co.ke", "0722100003", "Narok", "Narok", "P051000003C", "transportation", "Narok Logistics Center", "maraoverland.co.ke", ("Refrigerated Meat Transit Trip", 120_000_00), ("Heavy Agri-Machinery Lowbed", 195_000_00)),
        new("Great Lakes Bulk Carriers Ltd", "ops@greatlakescarriers.co.ke", "0722100004", "Kisumu", "Kisumu", "P051000004D", "transportation", "Kisumu Pier Depot", "greatlakescarriers.co.ke", ("Bulk Petroleum Tanker Freight", 210_000_00), ("Inter-County Dry Bulk Cargo", 85_000_00)),
        new("Simba Metro Courier Fleet Ltd", "express@simbacourier.co.ke", "0722100005", "Nairobi", "Nairobi", "P051000005E", "transportation", "Industrial Area Hub", "simbacourier.co.ke", ("Same-Day Metro Dispatch B2B", 8_500_00), ("Dedicated Courier Van Daily Rate", 22_000_00)),

        // 6-10 Wholesale & FMCG Distribution
        new("Lake Basin FMCG Wholesalers Ltd", "sales@lakebasinwholesalers.co.ke", "0722100006", "Kisumu", "Kisumu", "P051000006F", "distribution", "Mega Central Store", "lakebasinwholesalers.co.ke", ("Cooking Oil 20L Jerrycan (Pallet)", 48_000_00), ("Premium Rice 25kg (50 Bags)", 115_000_00)),
        new("Mount Kenya Agro-Vet Supplies Ltd", "orders@mtkenyaagrovet.co.ke", "0722100007", "Nyeri", "Nyeri", "P051000007G", "distribution", "Nyeri Regional Store", "mtkenyaagrovet.co.ke", ("Dairy Meal 50kg (Wholesale Pallet)", 75_000_00), ("Cattle Dip Concentrated 5L (Case)", 32_000_00)),
        new("Athi Distribution Depot Ltd", "supply@athidistribution.co.ke", "0722100008", "Machakos", "Athi River", "P051000008H", "distribution", "Mlolongo FMCG Warehouse", "athidistribution.co.ke", ("Wheat Flour 2kg Bales (100 Bales)", 88_000_00), ("Refined Sugar 50kg Bags", 140_000_00)),
        new("Eldoret Grain & Millers Ltd", "trade@eldoretmillers.co.ke", "0722100009", "Uasin Gishu", "Eldoret", "P051000009I", "distribution", "Silo Gate Warehouse", "eldoretmillers.co.ke", ("Fortified Maize Meal 12x2kg", 24_500_00), ("Wheat Bran 50kg Bags (Bulk)", 42_000_00)),
        new("Savannah Food Provisions Ltd", "orders@savannahprovisions.co.ke", "0722100010", "Nairobi", "Nairobi", "P051000010J", "distribution", "City Food Depot", "savannahprovisions.co.ke", ("Catering Spices & Seasoning Pack", 38_000_00), ("Tomato Paste 3kg Foodservice Cans", 29_500_00)),

        // 11-15 Manufacturing & Processing
        new("Thika Fruit Juices & Canning Ltd", "ops@thikacanning.co.ke", "0722100011", "Kiambu", "Thika", "P051000011K", "manufacturing", "Thika Processing Plant", "thikacanning.co.ke", ("Pineapple Juice Concentrate 200L Drum", 165_000_00), ("Canned Tropical Fruit Slices (100 Ctn)", 92_000_00)),
        new("Naivasha Polymer Packaging Ltd", "plant@naivashapackaging.co.ke", "0722100012", "Nakuru", "Naivasha", "P051000012L", "manufacturing", "Industrial Zone Unit 4", "naivashapackaging.co.ke", ("Biodegradable Retail Bags (10,000 Pcs)", 65_000_00), ("Corrugated Export Cartons (1,000 Pcs)", 85_000_00)),
        new("Athi River Steel Fabricators Ltd", "sales@athiriversteel.co.ke", "0722100013", "Machakos", "Athi River", "P051000013M", "manufacturing", "Heavy Rolling Mill", "athiriversteel.co.ke", ("High-Yield Deformed TMT Bars D16", 185_000_00), ("Galvanized Hollow Steel Sections", 125_000_00)),
        new("Rift Valley Creameries Ltd", "milk@riftvalleycreameries.co.ke", "0722100014", "Uasin Gishu", "Eldoret", "P051000014N", "manufacturing", "Processing & Cold Store", "riftvalleycreameries.co.ke", ("UHT Whole Milk 500ml (50 Crates)", 78_000_00), ("Clarified Ghee 1kg Foodservice Buckets", 95_000_00)),
        new("Highland Tea & Beverage Processors Ltd", "export@highlandteaprocessors.co.ke", "0722100015", "Kericho", "Kericho", "P051000015O", "manufacturing", "Highland Tea Factory", "highlandteaprocessors.co.ke", ("Black CTC Tea BP1 (50kg Paper Sacks)", 145_000_00), ("Specialty Purple Orthodox Tea 10kg", 62_000_00)),

        // 16-20 Retail & Supermarket
        new("QuickMart Highlands Supermarkets Ltd", "hq@quickmarthighlands.co.ke", "0722100016", "Nairobi", "Nairobi", "P051000016P", "retail", "Highlands Central Store", "quickmarthighlands.co.ke", ("Fresh Bakery Bulk Daily Supply", 45_000_00), ("Household Groceries Value Bundle", 18_500_00)),
        new("Apex Hypermarket Kenya Ltd", "admin@apexhypermarket.co.ke", "0722100017", "Mombasa", "Mombasa", "P051000017Q", "retail", "Nyali Main Retail Store", "apexhypermarket.co.ke", ("Home Appliances Corporate Gift Pack", 85_000_00), ("Bulk Dry Provisions Corporate Supply", 62_000_00)),
        new("Victoria Lake Superstores Ltd", "sales@victoriasuperstores.co.ke", "0722100018", "Kisumu", "Kisumu", "P051000018R", "retail", "Kisumu Central Branch", "victoriasuperstores.co.ke", ("Fresh Fish & Cold Cuts Retail Assortment", 38_000_00), ("Consumer Goods Retail Hamper", 24_000_00)),
        new("Central Hardware & Grocers Ltd", "orders@centralhardwaregrocers.co.ke", "0722100019", "Nyeri", "Nyeri", "P051000019S", "retail", "Main Bazaar Store", "centralhardwaregrocers.co.ke", ("Building Paint & Brushes Bundle", 55_000_00), ("Agricultural Hand Tools Assortment", 34_000_00)),
        new("Kilimani Gourmet Fresh Foods Ltd", "store@kilimanigourmet.co.ke", "0722100020", "Nairobi", "Nairobi", "P051000020T", "retail", "Kilimani Deli & Grocer", "kilimanigourmet.co.ke", ("Artisanal Cheese & Cold Cuts Platter", 28_000_00), ("Organic Veg Hamper (Subscription 1mo)", 36_000_00)),

        // 21-25 Healthcare & Pharmaceuticals
        new("Nairobi Central Plaza Chemist Ltd", "pharmacy@nairobiplaza.co.ke", "0722100021", "Nairobi", "Nairobi", "P051000021U", "services", "Central Plaza Dispensary", "nairobiplaza.co.ke", ("Antibiotics & Essential Medicines Batch", 85_000_00), ("Diagnostic Test Kits Bundle (500 Pcs)", 65_000_00)),
        new("Pwani Specialized Diagnostics Ltd", "lab@pwanidiagnostics.co.ke", "0722100022", "Mombasa", "Mombasa", "P051000022V", "services", "Coastal Diagnostic Center", "pwanidiagnostics.co.ke", ("Clinical Lab Reagents Automated Batch", 120_000_00), ("Ultrasound & Imaging Service Pack", 95_000_00)),
        new("Rift Valley Surgical & Pharma Ltd", "sales@rvalleypharma.co.ke", "0722100023", "Nakuru", "Nakuru", "P051000023W", "services", "Nakuru Hospital Supply Depo", "rvalleypharma.co.ke", ("Surgical Consumables & Drapes (Bulk)", 72_000_00), ("Hospital Sterilization Solutions 20L", 48_000_00)),
        new("Lake Victoria Medical Supplies Ltd", "supply@lakevictoriamed.co.ke", "0722100024", "Kisumu", "Kisumu", "P051000024X", "services", "Milimani Medical Store", "lakevictoriamed.co.ke", ("Dialysis Consumables Clinic Kit", 145_000_00), ("PPE & Medical Gloves Pack (100 Bx)", 52_000_00)),
        new("Mount Kenya Regional Laboratories Ltd", "info@mtkenyalabs.co.ke", "0722100025", "Embu", "Embu", "P051000025Y", "services", "Regional Path Lab", "mtkenyalabs.co.ke", ("Blood Chemistry Analyzer Cartridges", 89_000_00), ("Sample Collection Tubes Vacuum (5000)", 35_000_00)),

        // 26-30 Agriculture & Horticulture Export
        new("Naivasha Fresh Cut Flowers Ltd", "export@naivashaflowers.co.ke", "0722100026", "Nakuru", "Naivasha", "P051000026Z", "manufacturing", "Flower Farm Packhouse 1", "naivashaflowers.co.ke", ("Export Grade T-Hybrid Roses (5,000 Stems)", 195_000_00), ("Spray Carnations Export Box (200 Bunches)", 85_000_00)),
        new("Central Highlands Coffee Millers Ltd", "trade@centralcoffeemillers.co.ke", "0722100027", "Murang'a", "Murang'a", "P051000027A", "manufacturing", "Central Coffee Mill", "centralcoffeemillers.co.ke", ("Arabica Grade AA Clean Coffee (60kg Bag)", 135_000_00), ("Arabica Grade AB Screen 16 (Bulk)", 98_000_00)),
        new("Meru Macadamia & Nut Exporters Ltd", "sales@merumacadamia.co.ke", "0722100028", "Meru", "Meru", "P051000028B", "manufacturing", "Meru Processing Factory", "merumacadamia.co.ke", ("Macadamia Kernels Style 1 Vacuum (10kg)", 75_000_00), ("Organic Roasted Macadamia Kernels", 42_000_00)),
        new("Trans-Nzoia Grain Silos & Milling Ltd", "silos@transnzoiagrain.co.ke", "0722100029", "Trans-Nzoia", "Kitale", "P051000029C", "manufacturing", "Kitale Silo Terminal", "transnzoiagrain.co.ke", ("Grade 1 White Maize Cleaned (100 Bags)", 180_000_00), ("Grain Fumigation & Silo Drying Service", 65_000_00)),
        new("Kitengela Livestock & Poultry Farm Ltd", "farm@kitengelalivestock.co.ke", "0722100030", "Kajiado", "Kitengela", "P051000030D", "manufacturing", "Kitengela Holding Yards", "kitengelalivestock.co.ke", ("Commercial Day-Old Chicks (5,000 Pcs)", 115_000_00), ("Table Eggs Grade A (100 Crates)", 48_000_00)),

        // 31-35 Construction & Hardware
        new("Apex Concrete & Quarry Products Ltd", "sales@apexconcrete.co.ke", "0722100031", "Machakos", "Athi River", "P051000031E", "services", "Quarry Plant 2", "apexconcrete.co.ke", ("Ready-Mix Concrete C25 (Transit Mixer 7m3)", 84_000_00), ("Crushed Stone Ballast (30-Ton Tipper)", 42_000_00)),
        new("Mombasa Cement Distributors Ltd", "dispatch@mombasacementdist.co.ke", "0722100032", "Mombasa", "Mombasa", "P051000032F", "distribution", "Port Depot Store", "mombasacementdist.co.ke", ("Portland Cement 32.5R (500 Bags)", 165_000_00), ("Masonry Cement 42.5N High Strength", 195_000_00)),
        new("Nairobi Structural Engineering Ltd", "projects@nairobistructural.co.ke", "0722100033", "Nairobi", "Nairobi", "P051000033G", "services", "Heavy Fabrication Yard", "nairobistructural.co.ke", ("Structural Steel Truss Fabrication (Per Bay)", 220_000_00), ("Roof Sheeting Prepainted Gauge 28 (100 Pcs)", 95_000_00)),
        new("Kisumu Commercial Glazing & Tiles Ltd", "sales@kisumuglazing.co.ke", "0722100034", "Kisumu", "Kisumu", "P051000034H", "retail", "Oginga Odinga St Showroom", "kisumuglazing.co.ke", ("Porcelain Floor Tiles 60x60 (100 Boxes)", 115_000_00), ("Toughened Architectural Glass 10mm", 78_000_00)),
        new("Rift Civil & Road Contractors Ltd", "contracts@riftcivil.co.ke", "0722100035", "Nakuru", "Nakuru", "P051000035I", "services", "Plant & Equipment Yard", "riftcivil.co.ke", ("Road Grader & Roller Wet Hire (Per Week)", 280_000_00), ("Asphalt Premix Concrete (20-Ton Load)", 135_000_00)),

        // 36-40 Hospitality & Catering
        new("Mara Wilderness Safari Lodges Ltd", "reservations@marawilderness.co.ke", "0722100036", "Narok", "Maasai Mara", "P051000036J", "services", "Main Camp Kitchen & Stores", "marawilderness.co.ke", ("Corporate Safari Retreat Package (10 Pax)", 450_000_00), ("Lodge Conference & Bush Dinner Setup", 185_000_00)),
        new("Diani Coastal Beach Resorts Ltd", "bookings@dianicoastalresorts.co.ke", "0722100037", "Kwale", "Diani", "P051000037K", "services", "Beachfront Hospitality Store", "dianicoastalresorts.co.ke", ("Executive Beachfront Suite Full Board (7 Days)", 210_000_00), ("Banquet Hall Corporate Catering (150 Pax)", 165_000_00)),
        new("Lake Naivasha Conference Suites Ltd", "events@lakenaivashasuites.co.ke", "0722100038", "Nakuru", "Naivasha", "P051000038L", "services", "Moi South Lake Rd Suites", "lakenaivashasuites.co.ke", ("Full-Day Conference Package (50 Delegates)", 125_000_00), ("Weekend Team Building Grounds & Buffet", 85_000_00)),
        new("Great Rift Country Hotel Ltd", "stay@greatriftcountry.co.ke", "0722100039", "Nakuru", "Naivasha", "P051000039M", "services", "Main Hotel Stores", "greatriftcountry.co.ke", ("Golf & Accommodation Weekend Package", 75_000_00), ("Corporate Buffet Luncheon (100 Guests)", 95_000_00)),
        new("Nairobi Capital Event Caterers Ltd", "orders@capitalcaterers.co.ke", "0722100040", "Nairobi", "Nairobi", "P051000040N", "services", "Central Commercial Kitchen", "capitalcaterers.co.ke", ("Executive Buffet Catering (200 Guests)", 195_000_00), ("Cocktail Canapes & Beverage Service", 68_000_00)),

        // 41-45 Technology & Professional Services
        new("Kilimani Digital Cloud Solutions Ltd", "hello@kilimanicloud.co.ke", "0722100041", "Nairobi", "Nairobi", "P051000041O", "services", "Lenana Road Tech Lab", "kilimanicloud.co.ke", ("Enterprise Cloud Migration & Setup", 350_000_00), ("Managed Cybersecurity SLA (Monthly)", 120_000_00)),
        new("Upper Hill Financial Advisors Ltd", "consulting@upperhilladvisors.co.ke", "0722100042", "Nairobi", "Nairobi", "P051000042P", "services", "Britam Tower Suite 14", "upperhilladvisors.co.ke", ("Statutory Tax Audit & Advisory Retainer", 180_000_00), ("M&A Due Diligence & Valuation Study", 420_000_00)),
        new("Westlands Enterprise Analytics Ltd", "data@westlandsanalytics.co.ke", "0722100043", "Nairobi", "Nairobi", "P051000043Q", "services", "Delta Corner Floor 7", "westlandsanalytics.co.ke", ("BI Data Warehouse Modeling & Dashboards", 280_000_00), ("Predictive Inventory Forecasting Engine", 195_000_00)),
        new("Mara Fintech Systems Ltd", "support@marafintech.co.ke", "0722100044", "Nairobi", "Nairobi", "P051000044R", "services", "Fintech Hub Nairobi", "marafintech.co.ke", ("Core Payment Gateway Integration Service", 240_000_00), ("Automated Reconciliation Engine License", 145_000_00)),
        new("Portside Marine Automation Ltd", "marine@portsidemarine.co.ke", "0722100045", "Mombasa", "Mombasa", "P051000045S", "services", "Maritime Tech Building", "portsidemarine.co.ke", ("Vessel Telematics & Cargo Sensor Suite", 310_000_00), ("Port Harbor Automation Maintenance SLA", 175_000_00)),

        // 46-50 Energy, Solar & Fuel Distribution
        new("Great Rift Solar & Renewables Ltd", "solar@greatriftsolar.co.ke", "0722100046", "Nakuru", "Nakuru", "P051000046T", "distribution", "Nakuru Solar Yard", "greatriftsolar.co.ke", ("10kVA Commercial Hybrid Solar Inverter", 245_000_00), ("Tier-1 Solar PV Panels 550W (Pallet 36)", 185_000_00)),
        new("Equator Petroleum Logistics Ltd", "fuel@equatorpetroleum.co.ke", "0722100047", "Kisumu", "Kisumu", "P051000047U", "distribution", "Kisumu Pipeline Depot", "equatorpetroleum.co.ke", ("Automotive Low Sulphur Diesel 10,000L", 1_850_000_00), ("Super Petrol 5,000L Commercial Drop", 980_000_00)),
        new("Highland Biomass Energy Ltd", "clean@highlandbiomass.co.ke", "0722100048", "Uasin Gishu", "Eldoret", "P051000048V", "manufacturing", "Biomass Processing Mill", "highlandbiomass.co.ke", ("Industrial Biomass Briquettes (20 Tons)", 140_000_00), ("Compressed Wood Pellets Boiler Fuel", 95_000_00)),
        new("Coast Liquefied Gas Depot Ltd", "lpg@coastgas.co.ke", "0722100049", "Mombasa", "Mombasa", "P051000049W", "distribution", "Shimanzi LPG Terminal", "coastgas.co.ke", ("LPG Bulk Gas 5-Ton Industrial Delivery", 620_000_00), ("Commercial 50kg LPG Cylinders (20 Units)", 135_000_00)),
        new("Nairobi Clean Energy Hub Ltd", "power@cleannairobi.co.ke", "0722100050", "Nairobi", "Nairobi", "P051000050X", "distribution", "Industrial Clean Power Store", "cleannairobi.co.ke", ("Lithium Iron Phosphate Battery 15kWh", 380_000_00), ("Smart Energy Metering & Power Management", 115_000_00))
    ];

    static EmpTpl[] GetEmployeeTemplates() =>
    [
        new("David", "Kariuki", "Managing Director", "Executive", Role.Owner, 185_000_00, 35_000_00),
        new("Sarah", "Wanjiku", "Chief Financial Officer", "Finance", Role.Accountant, 140_000_00, 25_000_00),
        new("Brian", "Kiprono", "Operations Manager", "Operations", Role.Owner, 125_000_00, 20_000_00),
        new("Dennis", "Omwamba", "Head of Procurement", "Procurement", Role.Procurement, 95_000_00, 15_000_00),
        new("Sharon", "Muthoni", "Senior Sales Executive", "Sales", Role.Sales, 85_000_00, 15_000_00),
        new("Kevin", "Korir", "Warehouse & Store Lead", "Warehouse", Role.Storekeeper, 75_000_00, 12_000_00),
        new("Esther", "Nyambura", "Fleet Dispatch Officer", "Logistics", Role.Storekeeper, 70_000_00, 10_000_00),
        new("Daniel", "Mwangi", "Human Resources Specialist", "Human Resources", Role.HR, 85_000_00, 15_000_00),
        new("Christine", "Achieng", "Quality Assurance Lead", "Operations", Role.Viewer, 68_000_00, 10_000_00),
        new("Samuel", "Njuguna", "Field Sales Representative", "Sales", Role.Sales, 65_000_00, 10_000_00),
        new("Faith", "Cherono", "Billing & Cashier Specialist", "Finance", Role.Sales, 55_000_00, 8_000_00),
        new("Victor", "Ochieng", "Store & Inventory Clerk", "Warehouse", Role.Storekeeper, 48_000_00, 8_000_00),
        new("Joy", "Wairimu", "Commercial Dispatch Driver", "Logistics", Role.Viewer, 45_000_00, 7_000_00),
        new("George", "Otieno", "Customer Service Lead", "Commercial", Role.Viewer, 52_000_00, 8_000_00),
        new("Brenda", "Chepkemoi", "Internal Inventory Auditor", "Finance", Role.Accountant, 78_000_00, 12_000_00),
        new("Collins", "Mutiso", "IT Systems & POS Specialist", "Technology", Role.Viewer, 72_000_00, 12_000_00),
        new("Beatrice", "Wambui", "Plant Maintenance Supervisor", "Operations", Role.Viewer, 62_000_00, 10_000_00),
        new("Kennedy", "Kipkemboi", "Senior Procurement Officer", "Procurement", Role.Procurement, 68_000_00, 10_000_00),
        new("Mercy", "Atieno", "Assistant Accountant", "Finance", Role.Viewer, 58_000_00, 8_000_00),
        new("Paul", "Kimani", "Administration Coordinator", "Operations", Role.Viewer, 50_000_00, 8_000_00),
    ];
}
