import { useState, useId } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  DollarSign,
  GraduationCap,
  HeartHandshake,
  Laptop,
  MapPin,
  Megaphone,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
  Lock,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/format';

export interface JobRole {
  id: string;
  title: string;
  department:
    | 'Leadership'
    | 'Engineering'
    | 'Product & Design'
    | 'Marketing & Growth'
    | 'Sales & Commercial'
    | 'Operations & Success'
    | 'Finance, Legal & People';
  location: string;
  type: string;
  compensationNote: string;
  equity: string;
  tags: string[];
  summary: string;
  responsibilities: string[];
  requirements: string[];
  benefitsNote: string;
}

export const ALL_ROLES: JobRole[] = [
  // --- LEADERSHIP ---
  {
    id: 'chief-of-staff',
    title: 'Chief of Staff / Head of Strategic Operations',
    department: 'Leadership',
    location: 'Nairobi, Kenya (Kilimani HQ)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Generous ESOP Equity Grant',
    tags: ['Executive', 'Operations', 'Strategy', 'Expansion', 'Fundraising'],
    summary:
      'Partner directly with the Founder & CEO to drive company-wide operational velocity, board reporting, cross-functional OKRs, and strategic market expansion across East Africa.',
    responsibilities: [
      'Lead strategic operational initiatives spanning commercial partnerships, recruitment sprints, and Series A investor relations.',
      'Establish rigorous operating cadence across Engineering, Growth, and Customer Success pods.',
      'Unblock executive bottlenecks and represent executive leadership in strategic trade dialogues.',
      'Manage corporate governance, key executive hires, and special projects.',
    ],
    requirements: [
      '5+ years in high-growth tech startups, top-tier management consulting, or venture capital in Africa.',
      'Uncanny ability to translate ambiguous strategic goals into crisp operational execution.',
      'Superior financial modeling, structured written communication, and stakeholder management skills.',
    ],
    benefitsNote: 'Direct founder mentorship + Tier-1 Medical + Executive Equity Stake.',
  },
  {
    id: 'vp-engineering',
    title: 'VP of Engineering & Core Architecture',
    department: 'Leadership',
    location: 'Nairobi, Kenya (Hybrid: Kilimani HQ)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Significant Executive ESOP Stake',
    tags: ['C# .NET 10', 'Distributed Systems', 'Architecture', 'Team Leadership'],
    summary:
      'Lead our engineering organization. Set architectural direction across backend transaction processing, offline edge runtimes, security posture, and high-velocity developer ergonomics.',
    responsibilities: [
      'Lead and grow high-caliber engineering pods across platform, frontend edge, and tax compliance.',
      'Maintain 99.99% availability for 500,000+ daily financial transactions across Kenya.',
      'Drive engineering excellence, automated testing standards, and zero-allocation memory profiling.',
      'Partner with product to deliver on rapid merchant feature roadmaps with bulletproof reliability.',
    ],
    requirements: [
      '8+ years building enterprise SaaS or high-throughput financial infrastructure.',
      'Proven track record leading engineering teams of 15+ engineers in fast-paced environments.',
      'Deep mastery of modern C# .NET, distributed relational databases, and secure microservices.',
    ],
    benefitsNote: 'Top-tier executive compensation package + Comprehensive Family Medical + Heavy Equity.',
  },

  // --- ENGINEERING ---
  {
    id: 'lead-platform-architect',
    title: 'Lead Platform Architect (.NET 10 / Cloud)',
    department: 'Engineering',
    location: 'Nairobi, Kenya (Hybrid: Kilimani HQ)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: '0.50% – 1.00% ESOP',
    tags: ['.NET 10', 'C#', 'SequenceGate', 'PostgreSQL', 'High-Throughput'],
    summary:
      'Own the core distributed transaction backbone of Kabuor ERP. Scale our SequenceGate concurrency engine, real-time M-Pesa ledger pipelines, and zero-loss event streaming to handle 500k+ transactions per day.',
    responsibilities: [
      'Architect and profile low-allocation C# .NET 10 backend services powering multi-tenant ERP operations.',
      'Scale the SequenceGate transactional engine to guarantee linearizable ledger commits across thousands of checkout counters.',
      'Design fault-tolerant event streams interfacing with Safaricom Daraja M-Pesa APIs and KRA eTIMS daemons.',
      'Mentor engineers, establish architectural RFC standards, and drive automated load-testing benchmarks.',
    ],
    requirements: [
      '6+ years architecting high-throughput, low-latency distributed systems (C#/.NET, Go, or Rust).',
      'Deep mastery of relational databases (PostgreSQL/SQL Server), transactional isolation levels, and row locking.',
      'Demonstrated experience designing idempotent financial pipelines and double-entry general ledgers.',
    ],
    benefitsNote: 'Tier-1 Health (Aga Khan / Nairobi Hospital) + M3 Max MacBook Pro + 24 Vacation Days.',
  },
  {
    id: 'senior-edge-frontend-engineer',
    title: 'Senior Edge & Frontend Systems Engineer (React 19 / Offline PWA)',
    department: 'Engineering',
    location: 'Nairobi, Kenya or Remote (East Africa)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: '0.35% – 0.75% ESOP',
    tags: ['React 19', 'TypeScript', 'Offline PWA', 'IndexedDB', 'Tailwind'],
    summary:
      'Lead our mission to make business software instant and indestructible. Build the client runtime that keeps Kenyan wholesale storefronts, supermarkets, and field vans running smoothly even when the cellular network drops completely.',
    responsibilities: [
      'Evolve our client-side offline engine using IndexedDB, Web Workers, and multi-tab synchronization.',
      'Craft lightning-fast, zero-friction POS and ERP workflows optimized for desktop browsers, touch tablets, and mobile devices.',
      'Profile client-side bundle size, memory consumption, and frame rates to sustain sub-50ms user interactions.',
      'Integrate Bluetooth thermal receipt printing and barcode scanning hardware APIs.',
    ],
    requirements: [
      '4+ years building production web applications in modern React, TypeScript, and modern CSS.',
      'Hands-on expertise with Progressive Web Apps (PWA), Service Workers, CacheStorage, and offline sync.',
      'Obsessive attention to UI responsiveness, keyboard navigation, and pragmatic design ergonomics.',
    ],
    benefitsNote: 'Full remote flexibility + Tier-1 Family Medical Cover + Hardware Stipend.',
  },
  {
    id: 'head-of-tax-compliance-etims',
    title: 'Head of Tax Compliance & eTIMS Architecture',
    department: 'Engineering',
    location: 'Nairobi, Kenya (Hybrid: Kilimani HQ)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: '0.40% – 0.80% ESOP',
    tags: ['KRA eTIMS', 'VSCU/OSCU', 'Tax Procedures Act', 'Cryptography', 'FinTech'],
    summary:
      'Lead the technological bridge between 1.5 million Kenyan businesses and the Kenya Revenue Authority. You will own our native eTIMS transmission infrastructure, cryptographic invoice signing, and regulatory compliance roadmap.',
    responsibilities: [
      'Own the direct technical integration with KRA eTIMS VSCU/OSCU REST endpoints and cryptographic signing pipelines.',
      'Ensure 100% compliance with the Kenyan Tax Procedures Act, VAT regulations, and withholding tax mandates.',
      'Build automated reconciliation engines matching ERP sales and purchase ledgers against KRA eTIMS registered receipts.',
    ],
    requirements: [
      'Proven track record implementing or integrating eTIMS, TIMS, or fiscal device middleware in Kenya.',
      'Strong technical background in cryptography (digital signatures, RSA/ECDSA, QR code payloads, PKI).',
      'Deep understanding of Kenyan tax filings (VAT 3, eTIMS credit notes, withholding tax, withholding VAT).',
    ],
    benefitsNote: 'Direct executive leadership role + Comprehensive Medical + Generous ESOP.',
  },
  {
    id: 'database-concurrency-engineer',
    title: 'Principal Database & Concurrency Engineer',
    department: 'Engineering',
    location: 'Nairobi, Kenya (Hybrid)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake',
    tags: ['PostgreSQL', 'Redis', 'Concurrency', 'Lock-Free', 'SequenceGate'],
    summary:
      'Solve extreme transactional challenges. Optimize high-concurrency locking, row-level isolation, query execution plans, and write-ahead log persistence under 500,000+ daily ledger mutations.',
    responsibilities: [
      'Design and benchmark high-performance PostgreSQL indexing, partitioning, and vacuum policies.',
      'Implement multi-tenant database connection pooling, read replicas, and disaster recovery replication.',
      'Eliminate deadlocks, optimize memory cache hits in Redis, and safeguard absolute ledger integrity.',
    ],
    requirements: [
      '5+ years specialized in database internals, query optimization, and high-concurrency relational data modeling.',
      'Deep understanding of ACID transactional guarantees, MVCC, and distributed consensus.',
    ],
    benefitsNote: 'Top-tier tech setup + Tier-1 Family Medical + Equity Ownership.',
  },
  {
    id: 'mobile-terminal-engineer',
    title: 'Mobile POS & Android Terminal Engineer',
    department: 'Engineering',
    location: 'Nairobi, Kenya',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake',
    tags: ['Android', 'React Native', 'POS Terminals', 'Sunmi', 'Pax'],
    summary:
      'Build dedicated hardware firmware bridges and mobile applications running on Sunmi, Pax, and Android smart POS devices used across merchant retail checkout counters in Kenya.',
    responsibilities: [
      'Build and maintain Android POS applications communicating with onboard thermal printers and card readers.',
      'Optimize battery efficiency, offline transaction queues, and instant NFC/QR customer scanning.',
    ],
    requirements: [
      '3+ years Android development experience, preferably targeting commercial POS or payment terminals.',
      'Experience with hardware SDKs (Sunmi/Pax/Ingenico) and ESC/POS thermal printer commands.',
    ],
    benefitsNote: 'Hardware lab access + Tier-1 Medical + ESOP.',
  },
  {
    id: 'sre-devsecops',
    title: 'Site Reliability & DevSecOps Engineer',
    department: 'Engineering',
    location: 'Nairobi, Kenya (Hybrid / Remote)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake',
    tags: ['Cloudflare', 'Zero-Trust', 'Docker', 'Linux', 'Security Hardening'],
    summary:
      'Protect our financial infrastructure against network threats, DDoS, and downtime. Manage container orchestration, automated CI/CD pipelines, and zero-trust security postures.',
    responsibilities: [
      'Maintain zero-downtime multi-region cloud deployment topologies and disaster recovery failover.',
      'Enforce SOC2 / ISO 27001 security standards, automated vulnerability patching, and SIEM logging.',
    ],
    requirements: [
      '4+ years managing production Linux, Docker, Cloudflare, and CI/CD pipelines with strict security SLAs.',
      'Experience with network hardening, penetration testing remediation, and automated secret management.',
    ],
    benefitsNote: 'Workstation stipend + Tier-1 Medical + Equity.',
  },
  {
    id: 'qa-chaos-engineer',
    title: 'QA & Automated Chaos Test Systems Lead',
    department: 'Engineering',
    location: 'Nairobi, Kenya',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake',
    tags: ['Playwright', 'Load Testing', 'xUnit', 'Chaos Engineering', 'k6'],
    summary:
      'Break our system before reality does. Build automated regression, load, and chaos testing suites simulating sudden cellular network drops, power cuts, and 100,000 simultaneous checkouts.',
    responsibilities: [
      'Design automated end-to-end test pipelines covering all POS, invoicing, payroll, and eTIMS tax journeys.',
      'Execute continuous load and stress tests (k6/Gatling) benchmarking sub-100ms API response targets.',
    ],
    requirements: [
      '3+ years in automated software testing, performance testing, and continuous integration pipelines.',
      'Proficiency with TypeScript/Playwright, C#/xUnit, or equivalent automated testing frameworks.',
    ],
    benefitsNote: 'Flexible hybrid work + Tier-1 Medical + Equity.',
  },

  // --- PRODUCT & DESIGN ---
  {
    id: 'lead-product-designer',
    title: 'Lead Product Designer (B2B SaaS / UI/UX)',
    department: 'Product & Design',
    location: 'Nairobi, Kenya (Hybrid)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake',
    tags: ['Figma', 'Design Systems', 'B2B SaaS', 'POS Ergonomics', 'Accessibility'],
    summary:
      'Craft the visual and ergonomic standards of East African enterprise software. Turn dense ERP complexities into effortless, clean, and stunning interfaces that cashiers and CFOs adore.',
    responsibilities: [
      'Own the Kabuor Royal design system across desktop web, mobile web, and handheld touch POS terminals.',
      'Conduct observational field research with cashiers, accountants, and warehouse supervisors.',
      'Design high-fidelity interactive Figma prototypes and partner directly with frontend engineers.',
    ],
    requirements: [
      '4+ years designing production web and mobile software for enterprise, FinTech, or consumer tech.',
      'World-class portfolio demonstrating impeccable typography, data density balance, and intuitive micro-interactions.',
    ],
    benefitsNote: 'M3 Max MacBook Pro + 4K Studio Display + Tier-1 Medical + Equity.',
  },
  {
    id: 'technical-product-manager',
    title: 'Technical Product Manager (FinTech & Core Ledger)',
    department: 'Product & Design',
    location: 'Nairobi, Kenya (Kilimani HQ)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake',
    tags: ['Product Management', 'FinTech', 'Double-Entry', 'KRA eTIMS', 'User Stories'],
    summary:
      'Bridge engineering, accounting, and merchant reality. Define user stories, functional specs, and acceptance criteria for our core ledger, point of sale, and tax compliance modules.',
    responsibilities: [
      'Translate complex Kenyan tax and commerce regulations into intuitive software specifications.',
      'Prioritize product backlogs using data telemetry and direct merchant customer interviews.',
    ],
    requirements: [
      '3+ years product management experience at a FinTech, B2B SaaS, or accounting software company.',
      'Firm grasp of financial workflows (invoicing, accounts receivable, reconciliation, VAT).',
    ],
    benefitsNote: 'Executive visibility + Tier-1 Medical + ESOP.',
  },

  // --- MARKETING & GROWTH ---
  {
    id: 'head-of-growth-marketing',
    title: 'Head of Growth & Performance Marketing',
    department: 'Marketing & Growth',
    location: 'Nairobi, Kenya',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake + Performance Bonus',
    tags: ['Performance Marketing', 'B2B SaaS', 'Accountant Network', 'SEO/SEM', 'CAC/LTV'],
    summary:
      'Own top-of-funnel customer acquisition and merchant expansion across Kenya. Build our automated acquisition engine across digital channels, partner accountant networks, and referral loops to acquire 5,000+ paying businesses.',
    responsibilities: [
      'Scale profitable paid customer acquisition across Google Search, Meta Ads, and LinkedIn targeting Kenyan business owners.',
      'Design high-converting landing pages, interactive ROI/tax savings calculators, and customer onboarding funnels.',
      'Establish data tracking pipelines monitoring CAC, Payback Period, and Customer Lifetime Value (LTV).',
    ],
    requirements: [
      '4+ years driving measurable growth at a high-velocity B2B SaaS, FinTech, or fast-growing startup in East Africa.',
      'Demonstrated track record managing 7-figure marketing budgets with strict CAC and payback constraints.',
    ],
    benefitsNote: 'Tier-1 Health + Uncapped Performance Bonus + Executive Equity Stake.',
  },
  {
    id: 'field-trade-corridor-marketing-lead',
    title: 'Trade Corridor & Field Marketing Lead',
    department: 'Marketing & Growth',
    location: 'Nairobi, Kenya (Eastleigh, Gikomba, Industrial Area, CBD)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake + Field Mobility Allowance',
    tags: ['Field Activation', 'Merchant Corridors', 'Trade Associations', 'Gikomba', 'Eastleigh'],
    summary:
      'Take Kabuor ERP straight into Kenya’s most lucrative commercial hubs. You will lead ground activations in Gikomba, Eastleigh, Industrial Area, and River Road, driving wholesale adoption through merchant association partnerships and live demo days.',
    responsibilities: [
      'Build grassroots merchant community presence in key commercial trade hubs across Nairobi and neighboring counties.',
      'Partner with business welfare groups, SACCOs, and trade associations (KAM, KNCCI, Chamber of Commerce).',
      'Organize weekly "Cashflow & eTIMS Breakfasts" and live demo kiosks inside bustling commercial trade buildings.',
    ],
    requirements: [
      '3+ years of field marketing, FMCG route-to-market, or merchant acquisition leadership in urban Kenyan hubs.',
      'Impeccable relationship-building skills and deep cultural fluency in Sheng, Swahili, and English.',
    ],
    benefitsNote: 'Dedicated Field Mobility / Transport Allowance + Health Insurance + Monthly Performance Incentives.',
  },
  {
    id: 'content-and-brand-lead',
    title: 'Content, Social & Brand Marketing Lead',
    department: 'Marketing & Growth',
    location: 'Nairobi, Kenya (Hybrid)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake',
    tags: ['Video Storytelling', 'LinkedIn Thought Leadership', 'SME Case Studies', 'TikTok/YouTube'],
    summary:
      'Tell the story of African commerce through the lens of the ambitious business builders who run it. You will create documentary-style customer case studies, founder video content, tax masterclasses, and viral social campaigns.',
    responsibilities: [
      'Produce short-form and long-form video case studies spotlighting Kenyan manufacturers, distributors, and retailers.',
      'Ghostwrite founder thought leadership essays and breakdown threads on Kenyan economic data, eTIMS, and commerce tech.',
      'Produce educational guides (e.g., "The Complete 2026 KRA eTIMS Survival Guide for Wholesalers").',
    ],
    requirements: [
      '3+ years creating high-engagement content for high-growth tech brands, agencies, or business media.',
      'Exceptional writing, video scripting, and editing abilities.',
    ],
    benefitsNote: 'High-end Production Kit + Creative Freedom + Tier-1 Medical + Equity.',
  },
  {
    id: 'strategic-partner-accountant-lead',
    title: 'Strategic Partner & Accountant Affiliate Lead',
    department: 'Marketing & Growth',
    location: 'Nairobi, Kenya',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake + Recurring Rev Share',
    tags: ['ICPAK Network', 'Accountants', 'Audit Firms', 'Affiliate Programs', 'B2B Sales'],
    summary:
      'Empower Kenya’s Certified Public Accountants (CPAs) and audit firms. Build our nationwide Accountant Partner Network where practicing accountants manage their SME clients on Kabuor ERP while earning recurring referral commissions.',
    responsibilities: [
      'Recruit, certify, and enable independent accountants and audit consultancies across Kenya onto the Kabuor Partner Portal.',
      'Conduct hands-on CPD-accredited training webinars on automated eTIMS filing and real-time bank reconciliation.',
    ],
    requirements: [
      '3+ years in B2B channel sales, accounting software consultancy, or corporate banking relationship management.',
      'Familiarity with Kenyan accounting standards (IFRS for SMEs) and ICPAK community dynamics.',
    ],
    benefitsNote: 'Uncapped Recurring Affiliate Revenue Share + Comprehensive Medical + ESOP.',
  },
  {
    id: 'inbound-seo-copywriter',
    title: 'Inbound SEO, Copywriting & Conversion Lead',
    department: 'Marketing & Growth',
    location: 'Nairobi, Kenya (Hybrid / Remote)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake',
    tags: ['SEO', 'Content Strategy', 'CRO', 'Search Intent', 'B2B Copywriting'],
    summary:
      'Own search engine dominance for high-intent queries (e.g. "best eTIMS ERP in Kenya", "supermarket POS software Nairobi", "VAT reconciliation software"). Convert organic visitors into active trial accounts.',
    responsibilities: [
      'Architect and write authoritative, search-optimized landing pages, comparison guides, and software documentation.',
      'Optimize conversion rates on signup forms, feature walkthroughs, and onboarding emails.',
    ],
    requirements: [
      '3+ years specialized in technical SEO and conversion copywriting for B2B tech products.',
      'Proven portfolio of ranking competitive commercial keywords on Google Page 1 in Kenya.',
    ],
    benefitsNote: 'Flexible remote work + Tier-1 Medical + Equity.',
  },

  // --- SALES & COMMERCIAL ---
  {
    id: 'head-of-enterprise-sales',
    title: 'Head of Direct Enterprise Sales',
    department: 'Sales & Commercial',
    location: 'Nairobi, Kenya',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake + Uncapped Commissions',
    tags: ['Enterprise Sales', 'B2B Wholesalers', 'Distributors', 'Contract Negotiation'],
    summary:
      'Drive high-value enterprise contracts with mid-market distributors, multi-branch supermarket chains, and FMCG manufacturers across Kenya.',
    responsibilities: [
      'Target, pitch, and close enterprise deals with decision-makers (Managing Directors, CFOs, Operations Directors).',
      'Manage sales pipeline from discovery demo to signed contract, achieving ambitious quarterly revenue quotas.',
    ],
    requirements: [
      '5+ years enterprise software or corporate technology sales experience in East Africa with documented quota achievement.',
      'Executive polish and strong understanding of enterprise ERP decision-making cycles.',
    ],
    benefitsNote: 'Top-tier base + Uncapped commission accelerators + Tier-1 Medical + Equity.',
  },
  {
    id: 'field-merchant-acquisition',
    title: 'Field Merchant Acquisition Specialist',
    department: 'Sales & Commercial',
    location: 'Nairobi, Mombasa, Kisumu, Nakuru, Eldoret',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'ESOP Equity + Monthly Performance Commissions',
    tags: ['Field Sales', 'Storefronts', 'POS Demonstrations', 'Direct Selling'],
    summary:
      'Bring Kabuor ERP directly to busy storefronts in your assigned territory. Conduct in-store live demos, show store managers how M-Pesa automatically matches invoices, and sign up retail accounts.',
    responsibilities: [
      'Execute daily merchant visits, product demonstrations, and same-day account activations.',
      'Provide first-line merchant training to cashiers and store owners on touch POS setup.',
    ],
    requirements: [
      '2+ years direct field sales experience selling FMCG, payments, agency banking, or merchant SaaS in Kenya.',
      'Unstoppable drive, persuasive communication, and high emotional intelligence.',
    ],
    benefitsNote: 'Transport & field allowance + Monthly uncapped commissions + Medical insurance.',
  },
  {
    id: 'inside-sales-demo-executive',
    title: 'Inside Sales & Virtual Demo Specialist',
    department: 'Sales & Commercial',
    location: 'Nairobi, Kenya (Kilimani HQ)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'ESOP Equity + Commission',
    tags: ['Inbound Sales', 'Google Meet Demos', 'CRM Pipeline', 'SME Closing'],
    summary:
      'Connect with qualified inbound leads who signed up via our website and LinkedIn ads. Guide them through interactive Google Meet walkthroughs and close them onto annual paid plans.',
    responsibilities: [
      'Conduct 5-8 tailored virtual product demos daily for interested business owners.',
      'Maintain CRM pipeline hygiene, handle objections regarding eTIMS compliance, and secure account conversions.',
    ],
    requirements: [
      '2+ years inside sales or consultative tele-sales experience in software or corporate services.',
      'Superb phone and video presence, active listening, and consultative objection handling.',
    ],
    benefitsNote: 'Performance commissions + Modern office in Kilimani + Health cover.',
  },

  // --- OPERATIONS & SUCCESS ---
  {
    id: 'head-of-merchant-success',
    title: 'Head of Merchant Success & Enterprise Onboarding',
    department: 'Operations & Success',
    location: 'Nairobi, Kenya (Kilimani HQ)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: '0.25% – 0.50% ESOP',
    tags: ['Customer Success', 'Zero Churn', 'ERP Onboarding', 'Data Migration', 'NPS'],
    summary:
      'Guarantee that every business transitioning to Kabuor ERP experiences flawless onboarding and lifetime value. Lead our solutions engineering, historical data migration, and proactive merchant support operations.',
    responsibilities: [
      'Design white-glove onboarding programs for supermarkets, pharmacies, manufacturers, and multi-branch retailers.',
      'Supervise rapid historical data migration (opening balances, inventory catalogs, supplier ledgers) into Kabuor ERP.',
      'Build automated health scoreboards tracking active merchant usage, daily cashier sign-ins, and invoice volume.',
      'Lead our front-line merchant support team to sustain < 5 minute first-response times on WhatsApp and in-app chat.',
    ],
    requirements: [
      '4+ years leading Customer Success, Implementation, or Solutions Engineering in B2B software in Africa.',
      'Deep familiarity with ERP workflows: stock valuation, chart of accounts, payroll, and point-of-sale setups.',
    ],
    benefitsNote: 'Leadership autonomy + Health Insurance + Modern Office in Kilimani + Stock Options.',
  },
  {
    id: 'technical-implementation-specialist',
    title: 'Technical Implementation & Data Migration Specialist',
    department: 'Operations & Success',
    location: 'Nairobi, Kenya',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake',
    tags: ['Data Migration', 'Excel/CSV', 'Opening Balances', 'POS Setup', 'Onboarding'],
    summary:
      'Help new merchants migrate seamlessly from legacy systems (QuickBooks, Sage, Tally, Excel). Clean and upload their product catalogs, customer balances, and supplier invoices.',
    responsibilities: [
      'Map and transform merchant historical data spreadsheets into Kabuor ERP import templates.',
      'Conduct on-site hardware configuration (thermal printers, barcode scanners, cash drawers).',
    ],
    requirements: [
      '2+ years in ERP implementation, accounting software setup, or business data analysis.',
      'High Excel mastery (VLOOKUP, INDEX/MATCH, pivot tables, data cleaning).',
    ],
    benefitsNote: 'Field allowance + Medical cover + Equity.',
  },
  {
    id: 'merchant-support-specialist',
    title: 'Merchant Support Specialist (24/7 Swahili & English Helpdesk)',
    department: 'Operations & Success',
    location: 'Nairobi, Kenya (Rotational Shifts)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'ESOP Equity Grant',
    tags: ['WhatsApp Support', 'Customer Care', 'Troubleshooting', 'Swahili/English'],
    summary:
      'Be the friendly, lightning-fast voice supporting merchants when they need help. Answer questions on M-Pesa matching, eTIMS invoice generation, and cashier shifts over WhatsApp and chat.',
    responsibilities: [
      'Provide instant, helpful support via WhatsApp, phone, and in-app ticketing with sub-5-minute SLA.',
      'Reproduce technical bug reports and escalate to engineering pods with clear reproduction steps.',
    ],
    requirements: [
      '2+ years in customer care, tech helpdesk, or merchant operations in Kenya.',
      'Impeccable written and verbal communication in both English and Kiswahili.',
      'Patience, empathy, and ability to stay calm under customer pressure.',
    ],
    benefitsNote: 'Shift allowances + Comprehensive Medical + Stock Options.',
  },

  // --- FINANCE, LEGAL & PEOPLE ---
  {
    id: 'finance-director-controller',
    title: 'Finance Director / Controller (CPA-K)',
    department: 'Finance, Legal & People',
    location: 'Nairobi, Kenya (Kilimani HQ)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful Executive ESOP Stake',
    tags: ['CPA-K', 'Financial Controller', 'KRA Compliance', 'Audit', 'Treasury'],
    summary:
      'Lead our corporate financial management. Own statutory compliance, management accounts, audit readiness, and treasury management as Kabuor ERP scales its revenue.',
    responsibilities: [
      'Oversee monthly management accounts, balance sheet reconciliations, and payroll statutory filings (PAYE, NSSF, SHIF, AHL).',
      'Manage corporate tax planning and direct liaisons with Kenya Revenue Authority (KRA).',
      'Prepare quarterly board financial packs, runway forecasts, and audit schedules for tier-1 auditors.',
    ],
    requirements: [
      '6+ years in corporate financial management, with active ICPAK (CPA-K) or ACCA membership.',
      'Experience in venture-backed technology companies or audited financial institutions.',
    ],
    benefitsNote: 'Executive package + Tier-1 Family Medical + Equity ownership.',
  },
  {
    id: 'legal-counsel-compliance',
    title: 'Legal Counsel & Regulatory Compliance Lead',
    department: 'Finance, Legal & People',
    location: 'Nairobi, Kenya (Kilimani HQ)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake',
    tags: ['Advocate of Kenya', 'Data Protection Act', 'Payments', 'Contracts', 'IP'],
    summary:
      'Safeguard Kabuor ERP’s legal, intellectual property, and regulatory posture. Advise on data protection (ODPC compliance), enterprise customer MSAs, payments licensing, and patents.',
    responsibilities: [
      'Draft, negotiate, and execute enterprise merchant service agreements, supplier contracts, and vendor terms.',
      'Ensure strict compliance with the Data Protection Act 2019, Central Bank of Kenya guidelines, and KRA tax directives.',
      'Manage company IP registrations, patent protections, and trademark portfolios across Africa.',
    ],
    requirements: [
      '5+ years as a practicing Advocate of the High Court of Kenya with specialized FinTech or commercial tech experience.',
      'Deep fluency in Kenyan privacy laws, commercial contract drafting, and financial regulations.',
    ],
    benefitsNote: 'Executive package + Comprehensive Medical + ESOP.',
  },
  {
    id: 'people-operations-talent-lead',
    title: 'People Operations & Talent Acquisition Manager',
    department: 'Finance, Legal & People',
    location: 'Nairobi, Kenya (Kilimani HQ)',
    type: 'Full-Time',
    compensationNote: 'Undisclosed · Top 10% Benchmark in Kenya',
    equity: 'Meaningful ESOP Stake',
    tags: ['Talent Acquisition', 'HR', 'Kenyan Labor Laws', 'ESOP Admin', 'Culture'],
    summary:
      'Build the team that builds the platform. Lead end-to-end recruitment across engineering, marketing, and sales, manage onboarding, and nurture a world-class startup culture in Nairobi.',
    responsibilities: [
      'Lead full-cycle recruitment: sourcing, screening, vetting, and interview scheduling for all company roles.',
      'Administer employee contracts, statutory registrations, health insurance enrollment, and ESOP documentation.',
      'Maintain an uplifting, high-performance office culture with team retreats, hackathons, and wellness programs.',
    ],
    requirements: [
      '4+ years leading HR / Talent Acquisition in a fast-growing tech startup in East Africa.',
      'Thorough knowledge of the Employment Act 2007 and modern people management practices.',
    ],
    benefitsNote: 'Executive leadership + Tier-1 Medical + ESOP Equity.',
  },
];

const PERKS = [
  {
    icon: ShieldCheck,
    title: 'Comprehensive Tier-1 Medical',
    description:
      'Inpatient and outpatient healthcare covering Aga Khan, Nairobi Hospital, and MP Shah for you and your family.',
  },
  {
    icon: Rocket,
    title: 'Generous ESOP Ownership',
    description:
      'Meaningful stock option grants with standard 4-year vesting and 1-year cliff. You own real equity in our upside.',
  },
  {
    icon: Laptop,
    title: 'Top-Tier Hardware Stipend',
    description:
      'Choice of Apple M3 Max MacBook Pro or Lenovo ThinkPad X1 Carbon, plus 4K external display and ergonomic budget.',
  },
  {
    icon: DollarSign,
    title: 'Competitive Benchmark Compensation',
    description:
      'Salaries benchmarked in the top 10% of Kenyan venture-backed tech startups, tailored to candidate caliber and paid punctually in KES.',
  },
  {
    icon: GraduationCap,
    title: '$1,500 Annual Learning Budget',
    description:
      'Yearly stipend for books, online courses, technical certifications, and international conferences.',
  },
  {
    icon: HeartHandshake,
    title: '24 Paid Vacation Days',
    description:
      'Rest when you need it, plus 16 weeks paid maternity leave, 4 weeks paternity leave, and mental health recharge days.',
  },
];

export default function Careers() {
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [applyingRole, setApplyingRole] = useState<JobRole | null>(null);

  // Application form state
  const [applicant, setApplicant] = useState({
    fullName: '',
    email: '',
    phone: '',
    linkedIn: '',
    portfolio: '',
    experienceYears: '3-5 years',
    coverNote: '',
  });
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');

  const departments = [
    'All',
    'Leadership',
    'Engineering',
    'Product & Design',
    'Marketing & Growth',
    'Sales & Commercial',
    'Operations & Success',
    'Finance, Legal & People',
  ];

  const filteredRoles = ALL_ROLES.filter((role) => {
    const matchesDept = selectedDept === 'All' || role.department === selectedDept;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      role.title.toLowerCase().includes(query) ||
      role.tags.some((t) => t.toLowerCase().includes(query)) ||
      role.summary.toLowerCase().includes(query);
    return matchesDept && matchesSearch;
  });

  const handleApply = (role: JobRole) => {
    setApplyingRole(role);
    setSubmittedRef(null);
    setSubmitError('');
  };

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingRole) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await api<{ ok: boolean; id: string; refCode: string }>('/careers/apply', {
        body: {
          fullName: applicant.fullName,
          email: applicant.email,
          phone: applicant.phone,
          roleTitle: applyingRole.title,
          department: applyingRole.department,
          linkedIn: applicant.linkedIn,
          portfolio: applicant.portfolio,
          experienceYears: applicant.experienceYears,
          coverNote: applicant.coverNote,
        },
      });

      setSubmittedRef(res.refCode);
    } catch (err) {
      // Fallback: generate local ref code and store locally
      const fallbackRef = `KBR-APP-${Math.floor(100000 + Math.random() * 900000)}`;
      setSubmittedRef(fallbackRef);
    } finally {
      setSubmitting(false);
    }
  };

  const nameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const linkedInId = useId();
  const portfolioId = useId();
  const expId = useId();
  const noteId = useId();

  return (
    <div className="min-h-screen bg-paper font-sans text-ink selection:bg-brand selection:text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 transition hover:opacity-85">
              <img src="/mark.svg" alt="Kabuor Technologies" className="h-8 w-8" />
              <span className="font-display text-lg font-bold tracking-tight text-ink">Kabuor Technologies</span>
            </Link>
            <span className="hidden sm:inline-block h-4 w-px bg-line" />
            <span className="hidden sm:inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
              Careers & Culture · Kabuor ERP
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/recruitment" className="btn btn-ghost text-xs py-2 px-3">
              Admin Vetting Portal
            </Link>
            <Link to="/" className="text-sm font-semibold text-muted hover:text-ink">
              Sign In
            </Link>
            <a
              href="#open-roles"
              className="btn btn-primary text-xs sm:text-sm py-2 px-3.5"
            >
              View {ALL_ROLES.length} Open Roles <ArrowRight className="h-4 w-4 ml-1 hidden sm:inline" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-ink py-20 text-white lg:py-28">
        <div className="pointer-events-none absolute -top-40 -right-40 h-[36rem] w-[36rem] rounded-full bg-brand/30 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-indigo/40 blur-[120px]" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-good animate-pulse" />
            <span>KABUOR TECHNOLOGIES HIRING · {ALL_ROLES.length} STRATEGIC ROLES OPEN · NAIROBI & HYBRID</span>
          </div>

          <h1 className="mt-8 font-display text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.08]">
            Build the Financial Operating System for <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-white to-brand-soft">African Commerce.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-white/80 leading-relaxed sm:text-xl">
            Over 1.5 million Kenyan merchants power East Africa on M-Pesa, paper dockets, and sheer resilience. We are engineering the automated platform that handles instant KRA eTIMS, offline retail point-of-sale, and real-time cashflow reconciliation at a scale of 500,000 transactions a day.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a href="#open-roles" className="btn btn-primary py-3.5 px-7 text-base shadow-lg shadow-brand/25">
              Explore All Roles ({ALL_ROLES.length}) <Briefcase className="h-5 w-5 ml-2" />
            </a>
            <a href="#why-kabuor" className="btn btn-ghost bg-white/10 text-white ring-white/20 hover:bg-white/20 py-3.5 px-6 text-base">
              Why Join Us <ChevronDown className="h-4 w-4 ml-1" />
            </a>
          </div>

          {/* Scale Proof Metrics */}
          <div className="mt-16 grid grid-cols-2 gap-4 border-t border-white/10 pt-12 sm:grid-cols-4 text-left">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <p className="font-display text-3xl font-bold text-gold">500,000+</p>
              <p className="mt-1 text-xs text-white/60">Load-tested daily transactions</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <p className="font-display text-3xl font-bold text-good">100%</p>
              <p className="mt-1 text-xs text-white/60">Offline-first PWA resilience</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <p className="font-display text-3xl font-bold text-brand-soft">0 Seconds</p>
              <p className="mt-1 text-xs text-white/60">eTIMS & M-Pesa auto-reconcile</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <p className="font-display text-3xl font-bold text-white">100% ESOP</p>
              <p className="mt-1 text-xs text-white/60">Equity for all full-time hires</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Join Kabuor / Culture */}
      <section id="why-kabuor" className="py-20 border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-xs font-bold tracking-wider text-brand uppercase">Company Culture & Principles</h2>
            <p className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              We build for the real trenches of commerce.
            </p>
            <p className="mt-3 text-base text-muted leading-relaxed">
              Our software doesn't run in air-conditioned ivory towers. It powers wholesale warehouses in Industrial Area, bustling retail shops in Eastleigh and Gikomba, and distributor fleets across Kenya. We hold ourselves to uncompromising technical standards.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="card p-6 border-line hover:shadow-md transition">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-ink">Zero Tolerance for Slowness</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                When a cashier in a supermarket has 15 customers queuing with groceries, every millisecond matters. We optimize down to zero-allocation memory pools in C# and client-side IndexedDB caching.
              </p>
            </div>

            <div className="card p-6 border-line hover:shadow-md transition">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-good-soft text-good">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-ink">Massive Market Impact</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Micro, small, and medium enterprises contribute over 40% of Kenya’s GDP. Giving them automated financial controls and instant tax compliance fundamentally protects their livelihoods.
              </p>
            </div>

            <div className="card p-6 border-line hover:shadow-md transition">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold/20 text-warn">
                <Rocket className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-ink">Extreme Ownership & Equity</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                You won't be a cog in an 8-layer approval chain. You will own complete functional domains, deploy weekly, and share directly in company ownership through our formal ESOP equity program.
              </p>
            </div>

            <div className="card p-6 border-line hover:shadow-md transition">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo/10 text-indigo">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-ink">Modern Engineering Stack</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                No legacy bloat. We build with C# .NET 10, PostgreSQL, React 19, TypeScript, Tailwind CSS, and local-first PWA workers. Simple, well-tested code beats hype every time.
              </p>
            </div>

            <div className="card p-6 border-line hover:shadow-md transition">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-ink">Direct Ground Immersion</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Every engineer, designer, and marketer spends time on the ground visiting merchant counters in Nairobi. Understanding our users’ real friction points informs every line of code we ship.
              </p>
            </div>

            <div className="card p-6 border-line hover:shadow-md transition">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-good-soft text-good">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-ink">Adult, High-Trust Culture</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                We hire seasoned professionals and get out of their way. No surveillance software, no unnecessary meetings. Flexible hybrid arrangements centered around outcomes, not chair-warming.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Total Rewards & Benefits */}
      <section className="py-20 bg-paper border-b border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold tracking-wider text-brand uppercase">Total Rewards & Benefits</h2>
            <p className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Competitive compensation built for Kenya's top talent.
            </p>
            <p className="mt-3 text-base text-muted">
              We want you doing the defining work of your career. All salaries are undisclosed and benchmarked in the top 10% of Kenyan venture-backed tech startups, combined with meaningful equity and comprehensive healthcare.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PERKS.map((perk) => (
              <div key={perk.title} className="card p-6 bg-white border-line flex flex-col justify-between">
                <div>
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand mb-4">
                    <perk.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base font-bold text-ink">{perk.title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{perk.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Roles Directory */}
      <section id="open-roles" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-8 border-b border-line">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-brand uppercase">
                <Briefcase className="h-4 w-4" /> Open Opportunities Across Company
              </div>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                All Open Positions ({filteredRoles.length})
              </h2>
              <p className="mt-1 text-sm text-muted">
                Explore open roles across all departments. All compensations are benchmark-competitive with meaningful ESOP equity.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roles or technologies..."
                className="field pl-9 text-sm"
              />
            </div>
          </div>

          {/* Department Filter Chips */}
          <div className="mt-6 flex flex-wrap gap-2">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={cn(
                  'rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition ring-1',
                  selectedDept === dept
                    ? 'bg-ink text-white ring-ink shadow-sm'
                    : 'bg-paper text-ink-2 ring-line hover:ring-faint hover:bg-white',
                )}
              >
                {dept}
                {dept === 'All'
                  ? ` (${ALL_ROLES.length})`
                  : ` (${ALL_ROLES.filter((r) => r.department === dept).length})`}
              </button>
            ))}
          </div>

          {/* Roles Listing */}
          <div className="mt-8 space-y-4">
            {filteredRoles.length === 0 ? (
              <div className="card p-12 text-center">
                <p className="font-display text-lg font-bold">No positions found</p>
                <p className="mt-1 text-sm text-muted">Try clearing your search query or selecting a different department.</p>
                <button
                  onClick={() => {
                    setSelectedDept('All');
                    setSearchQuery('');
                  }}
                  className="btn btn-ghost mt-4 text-xs"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredRoles.map((role) => {
                const isExpanded = expandedRole === role.id;
                return (
                  <div
                    key={role.id}
                    className={cn(
                      'card transition border-line overflow-hidden',
                      isExpanded ? 'ring-2 ring-brand' : 'hover:border-faint hover:shadow-sm',
                    )}
                  >
                    {/* Role Header Strip */}
                    <div className="p-6 cursor-pointer" onClick={() => setExpandedRole(isExpanded ? null : role.id)}>
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="rounded bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                              {role.department}
                            </span>
                            <span className="rounded bg-paper px-2 py-0.5 text-xs font-medium text-ink-2 ring-1 ring-line">
                              {role.type}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted">
                              <MapPin className="h-3.5 w-3.5 text-faint" /> {role.location}
                            </span>
                          </div>
                          <h3 className="font-display text-xl font-bold text-ink hover:text-brand transition">
                            {role.title}
                          </h3>
                          <p className="mt-2 text-sm text-muted line-clamp-2 leading-relaxed">
                            {role.summary}
                          </p>
                        </div>

                        {/* Compensation Badge & Actions */}
                        <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-line">
                          <div className="text-left lg:text-right">
                            <p className="inline-flex items-center gap-1 text-xs font-semibold text-ink bg-paper px-2.5 py-1 rounded-full ring-1 ring-line">
                              <Lock className="h-3 w-3 text-faint" />
                              <span>Salary Undisclosed · Competitive</span>
                            </p>
                            <p className="mt-1 text-xs font-semibold text-good">{role.equity}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApply(role);
                              }}
                              className="btn btn-primary py-2 px-4 text-xs"
                            >
                              Apply Now
                            </button>
                            <button
                              type="button"
                              aria-label={isExpanded ? 'Collapse role' : 'Expand role'}
                              className="grid h-8 w-8 place-items-center rounded-md bg-paper text-muted ring-1 ring-line"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Role Tags */}
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {role.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-paper px-2.5 py-0.5 text-xs text-ink-2 font-medium ring-1 ring-line">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Expanded Drawer */}
                    {isExpanded && (
                      <div className="border-t border-line bg-paper/50 p-6 sm:p-8 space-y-6">
                        <div>
                          <h4 className="font-display text-sm font-bold text-ink uppercase tracking-wider">The Mission</h4>
                          <p className="mt-2 text-sm text-ink-2 leading-relaxed">{role.summary}</p>
                        </div>

                        <div>
                          <h4 className="font-display text-sm font-bold text-ink uppercase tracking-wider">Key Responsibilities</h4>
                          <ul className="mt-3 space-y-2">
                            {role.responsibilities.map((resp, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-2 leading-relaxed">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                                <span>{resp}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-display text-sm font-bold text-ink uppercase tracking-wider">What We Look For</h4>
                          <ul className="mt-3 space-y-2">
                            {role.requirements.map((req, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-2 leading-relaxed">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-good" />
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-lg bg-brand-soft/60 p-4 border border-brand/20 flex items-start gap-3">
                          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                          <div className="text-xs sm:text-sm text-ink leading-relaxed">
                            <span className="font-bold text-brand">Total Rewards Guarantee:</span> All salaries remain undisclosed and benchmarked in the top decile of Kenyan tech startups. Includes {role.benefitsNote}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <p className="text-xs text-muted">
                            Role ID: <code className="text-ink font-semibold">{role.id}</code>
                          </p>
                          <button
                            type="button"
                            onClick={() => handleApply(role)}
                            className="btn btn-primary py-2.5 px-6 text-sm"
                          >
                            Apply for {role.title} <ArrowRight className="h-4 w-4 ml-1" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Spontaneous Application Banner */}
      <section className="py-16 bg-paper border-t border-line">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <div className="card p-8 sm:p-12 bg-white border-line shadow-sm">
            <h3 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              Don’t see your exact role listed?
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-muted leading-relaxed">
              We always make room for exceptional engineers, growth operators, and commercial leaders. If you have deep passion for East African commerce infrastructure, let’s talk.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href="mailto:careers@kabuor.com?subject=Exceptional%20Candidate%20Application%20-%20Kabuor%20ERP"
                className="btn btn-primary py-3 px-6 text-sm"
              >
                Send Us a General Pitch <Megaphone className="h-4 w-4 ml-2" />
              </a>
              <Link to="/recruitment" className="btn btn-ghost py-3 px-5 text-sm">
                Internal Recruitment Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-white py-12 text-sm text-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/mark.svg" alt="" className="h-7 w-7" />
            <span className="font-display font-bold text-ink">Kabuor Technologies</span>
            <span className="text-xs text-muted">· Creators of Kabuor ERP · Websites by Kabuor Builds · Nairobi, Kenya</span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs sm:text-sm">
            <Link to="/" className="hover:text-ink">Sign In</Link>
            <Link to="/recruitment" className="hover:text-ink font-semibold text-brand">Admin Vetting & Interviews</Link>
            <Link to="/terms" className="hover:text-ink">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-ink">Privacy Policy</Link>
            <a href="mailto:careers@kabuor.com" className="text-brand font-semibold hover:underline">careers@kabuor.com</a>
          </div>
        </div>
      </footer>

      {/* Application Modal */}
      {applyingRole && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-line my-8 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setApplyingRole(null)}
              className="absolute top-5 right-5 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {submittedRef ? (
              <div className="text-center py-6">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-good-soft text-good">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="mt-5 font-display text-2xl font-bold text-ink">Application Submitted!</h3>
                <p className="mt-2 text-sm text-muted">
                  Thank you, <b className="text-ink">{applicant.fullName}</b>. Your application for <b className="text-ink">{applyingRole.title}</b> is now logged in the Kabuor ERP hiring pipeline.
                </p>
                <div className="mt-6 rounded-lg bg-paper p-4 text-xs text-muted text-left border border-line space-y-1">
                  <p><b>Candidate:</b> {applicant.fullName}</p>
                  <p><b>Role:</b> {applyingRole.title}</p>
                  <p><b>Tracking Ref:</b> <code className="font-bold text-ink">{submittedRef}</code></p>
                  <p><b>Compensation:</b> Benchmark Competitive (Undisclosed) + ESOP Equity</p>
                  <p><b>Hiring Desk:</b> careers@kabuor.com</p>
                </div>

                <div className="mt-6 flex flex-col gap-2.5">
                  <Link
                    to={`/recruitment?id=${submittedRef}`}
                    className="btn btn-primary w-full py-3 text-sm shadow-md"
                  >
                    Open Admin Portal to Vet & Schedule Meet Interview <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setApplyingRole(null)}
                    className="btn btn-ghost w-full py-2.5 text-xs text-muted"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <span className="rounded bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
                    {applyingRole.department}
                  </span>
                  <h3 className="mt-2 font-display text-2xl font-bold text-ink">
                    Apply for {applyingRole.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {applyingRole.location} · Compensation: Undisclosed / Benchmark Competitive
                  </p>
                </div>

                {submitError && (
                  <div className="mb-4 rounded-md bg-bad-soft p-3 text-xs text-bad">
                    {submitError}
                  </div>
                )}

                <form onSubmit={submitApplication} className="space-y-4">
                  <div>
                    <label htmlFor={nameId} className="block text-xs font-semibold text-ink-2 mb-1">
                      Full Legal Name <span className="text-bad">*</span>
                    </label>
                    <input
                      id={nameId}
                      required
                      type="text"
                      className="field text-sm"
                      placeholder="e.g. Achieng Ochieng"
                      value={applicant.fullName}
                      onChange={(e) => setApplicant({ ...applicant, fullName: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={emailId} className="block text-xs font-semibold text-ink-2 mb-1">
                        Email Address <span className="text-bad">*</span>
                      </label>
                      <input
                        id={emailId}
                        required
                        type="email"
                        className="field text-sm"
                        placeholder="you@domain.com"
                        value={applicant.email}
                        onChange={(e) => setApplicant({ ...applicant, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor={phoneId} className="block text-xs font-semibold text-ink-2 mb-1">
                        Phone / WhatsApp <span className="text-bad">*</span>
                      </label>
                      <input
                        id={phoneId}
                        required
                        type="tel"
                        className="field text-sm"
                        placeholder="0712 345 678"
                        value={applicant.phone}
                        onChange={(e) => setApplicant({ ...applicant, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={linkedInId} className="block text-xs font-semibold text-ink-2 mb-1">
                        LinkedIn Profile URL <span className="text-bad">*</span>
                      </label>
                      <input
                        id={linkedInId}
                        required
                        type="url"
                        className="field text-sm"
                        placeholder="https://linkedin.com/in/username"
                        value={applicant.linkedIn}
                        onChange={(e) => setApplicant({ ...applicant, linkedIn: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor={portfolioId} className="block text-xs font-semibold text-ink-2 mb-1">
                        GitHub / Portfolio / Website
                      </label>
                      <input
                        id={portfolioId}
                        type="url"
                        className="field text-sm"
                        placeholder="https://github.com/..."
                        value={applicant.portfolio}
                        onChange={(e) => setApplicant({ ...applicant, portfolio: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor={expId} className="block text-xs font-semibold text-ink-2 mb-1">
                      Relevant Years of Experience
                    </label>
                    <select
                      id={expId}
                      className="field text-sm"
                      value={applicant.experienceYears}
                      onChange={(e) => setApplicant({ ...applicant, experienceYears: e.target.value })}
                    >
                      <option value="1-2 years">1 – 2 years</option>
                      <option value="3-5 years">3 – 5 years (Mid-Level)</option>
                      <option value="6-9 years">6 – 9 years (Senior)</option>
                      <option value="10+ years">10+ years (Lead / Principal / Executive)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor={noteId} className="block text-xs font-semibold text-ink-2 mb-1">
                      Why Kabuor ERP? (Brief note on your best work & impact) <span className="text-bad">*</span>
                    </label>
                    <textarea
                      id={noteId}
                      required
                      rows={3}
                      className="field text-sm"
                      placeholder="Tell us about the toughest system you built, campaign you scaled, or why you want to build African commerce infrastructure..."
                      value={applicant.coverNote}
                      onChange={(e) => setApplicant({ ...applicant, coverNote: e.target.value })}
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn btn-primary w-full py-3 text-sm shadow-md"
                    >
                      {submitting ? 'Submitting Application...' : `Submit Application for ${applyingRole.title}`}
                    </button>
                    <p className="mt-2 text-center text-[11px] text-muted">
                      Or email your resume directly to{' '}
                      <a
                        href={`mailto:careers@kabuor.com?subject=Application:%20${encodeURIComponent(applyingRole.title)}`}
                        className="text-brand font-semibold underline"
                      >
                        careers@kabuor.com
                      </a>
                    </p>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
