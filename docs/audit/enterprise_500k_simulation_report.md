# Enterprise Load Simulation: 20 Companies & 500,000 Daily Transactions

This benchmark and capacity analysis outlines the execution, write amplification, and cloud topology required to process **500,000 daily commercial transactions across 20 distinct multi-tenant businesses** on Kabuor ERP.

---

## 1. Multi-Tenant Workload Profile (20 Companies)

| Company Name | Sector / Commercial Domain | Tier | Target Daily Tx | Est. Daily GMV |
| :--- | :--- | :--- | :--- | :--- |
| **Nairobi Mega Supermarket Ltd** | Retail & Supermarket POS | Tier-1 | 65,000 | KSh 185M |
| **Amani FMCG Distributors Ltd** | Wholesale Beverages & Dry Goods | Tier-1 | 55,000 | KSh 210M |
| **Equator Pharmaceuticals Ltd** | Pharmacy Chain & Medical Supplies | Tier-1 | 45,000 | KSh 140M |
| **Victoria Grain Millers Ltd** | Maize & Wheat Flour Milling | Tier-1 | 40,000 | KSh 190M |
| **Mount Kenya Dairy Hub Ltd** | Dairy Processing & Packaging | Tier-2 | 32,000 | KSh 85M |
| **Pwani Fresh Seafoods Ltd** | Cold-Chain Wholesale | Tier-2 | 30,000 | KSh 90M |
| **Rift Valley Agrochem Ltd** | Fertilizer & Agrovet Supplies | Tier-2 | 28,000 | KSh 80M |
| **Highland Hardware & Cement Ltd**| Building Materials & Timber | Tier-2 | 25,000 | KSh 120M |
| **Great Lakes Animal Feeds Ltd** | Animal Feeds Manufacturer | Tier-2 | 24,000 | KSh 65M |
| **Thika Fruit Juices & Packaging**| Beverage Bottling & Distribution | Tier-2 | 22,000 | KSh 55M |
| **Apex Auto Spares Wholesale Ltd**| Automotive Parts & Lubricants | Tier-2 | 22,000 | KSh 48M |
| **Metro Stationery & IT Supplies**| Office Supplies & Hardware | Tier-2 | 20,000 | KSh 38M |
| **Eldoret Cereals Trading Hub** | Grain Commodities & Pulses | Tier-3 | 18,000 | KSh 50M |
| **Crown Paints & Coatings Depot** | Industrial & Architectural Paint | Tier-3 | 16,000 | KSh 42M |
| **Lakeview Fish Processors Ltd** | Freshwater Wholesale | Tier-3 | 14,000 | KSh 32M |
| **Savannah Solar & Energy Ltd** | Renewable Solar Systems | Tier-3 | 12,000 | KSh 28M |
| **Mara Safari Provisions Ltd** | Hospitality Supplies & Foodservice | Tier-3 | 12,000 | KSh 25M |
| **Kipevu Logistics & Bonded Store**| Freight & Port Warehousing | Tier-3 | 11,000 | KSh 22M |
| **Kilifi Agro-Exporters Ltd** | Cashew & Coconut Processing | Tier-3 | 10,000 | KSh 18M |
| **Turkana Energy Logistics Ltd** | Industrial Fuel Distribution | Tier-3 | 9,000 | KSh 16M |
| **TOTALS (20 Companies)** | **Multi-Tenant Aggregate** | — | **510,000 tx/day** | **~KSh 1.42 Billion/day** (~$10.9M USD/day) |

---

## 2. Mathematical Throughput & Write-Amplification Analysis

### A. Throughput Requirements
* **Active Business Window**: 11 hours (7:30 AM to 6:30 PM).
* **Average Daytime Throughput**:
  $$\text{Steady TPS} = \frac{500,000 \text{ transactions}}{11 \times 3,600 \text{ seconds}} \approx \mathbf{12.6 \text{ tx / second}}$$
* **Peak Burst Throughput** (Lunchtime 12:30–2:00 PM & Evening rush 5:00–6:30 PM, 3.5x factor):
  $$\text{Peak TPS} \approx \mathbf{44 - 60 \text{ tx / second}}$$

### B. Database Row-Amplification Breakdown
Every 1 business transaction in Kabuor ERP triggers:
1. `1 SalesDoc` (Invoice/Receipt)
2. `2.4 SalesLines` (Itemized products)
3. `1 Payment` (M-Pesa C2B / Cash / Bank)
4. `1 PaymentAllocation` (Automatic invoice settlement)
5. `1 JournalEntry` (Double-entry transaction header)
6. `2 JournalLines` (Balanced Debits to Bank/Cash & Credits to Revenue/Receivables)
7. `1 StockMove` + `StockLevel` update
8. `1 AuditEntry` (Immutable forensic record)

$$\mathbf{500,000 \text{ tx/day}} \times \mathbf{9.4 \text{ rows/tx}} = \mathbf{4,700,000 \text{ database rows written daily!}}$$

* **Daily DB Growth**: **~2.1 GB / day** (data + B-tree indexes).
* **Monthly Storage**: **~65 GB / month**.

---

## 3. Recommended Production Cloud Architecture

To comfortably process 500k tx/day with sub-80ms API response times:

```
[ Clients / POS Terminals / M-Pesa Webhooks ]
                     │
                     ▼
         [ Cloud Load Balancer (HTTPS / TLS) ]
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
  [ API Node 1 ] [ API Node 2 ] [ API Node 3 ]  (3x 4 vCPU, 8GB RAM ASP.NET Core)
       │             │             │
       └─────────────┼─────────────┘
                     ├─── [ Redis / Valkey 4GB ] (JWT Tokens, Rate Limiting & Fast Caching)
                     ▼
          [ PgBouncer Connection Pooler ] (Max Pool: 120-150 connections)
                     │
                     ▼
      [ PostgreSQL 16+ Primary (Managed) ]
        • 8 vCPU, 32GB RAM
        • 3,000+ Provisioned IOPS NVMe SSD
        • Read-Replica for heavy financial / VAT reporting
```

* **Estimated Total Infrastructure Cost**: **$350 – $650 / month** on Render, AWS, or GCP.
* **Cost per Transaction**: **<$0.00004** per transaction (over 99.8% software gross profit margin).
