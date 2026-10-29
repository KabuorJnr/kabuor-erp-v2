# Running Kabuor ERP in production

## Where it runs
- **Live today:** https://erp.kabuor-technologies.company is served by Vercel from `vercel.json` (the API as a
  container, the web app beside it), with the database on Neon. Vercel adds the security headers in `vercel.json`
  on top of the app's own, so a header the app needs (geolocation for the driver's link, map tiles) has to be
  allowed in both. An idle Vercel app is scaled down, so `.github/workflows/keep-warm.yml` asks it every 10 minutes.
  The privacy notice names the host from `LEGAL__HOSTING` (default "Vercel (United States)"): change it if the app
  moves. The Render blueprint below is the always-on alternative.
- **App:** Render web service `kabuor-erp` from the Dockerfile (`render.yaml` is the blueprint). Every push to `main`
  deploys; Render switches traffic only once `/api/health/ready` answers (the database is reachable). Use an
  always-on instance (Starter or above): free instances sleep, which stops agents, webhooks, M-Pesa callbacks and
  eTIMS retries until the next visitor wakes it.
- **Database:** Neon PostgreSQL. Use Neon's **direct** connection string (not the "pooled" one) as `DATABASE_URL`;
  it's always encrypted and certificate-checked. The schema comes from EF migrations
  (`src/Kabuor.Erp.Api/Data/Migrations`), applied on start. A database made before migrations existed is adopted
  automatically (`Data/SchemaSync.cs`).
- **Settings (Render → Environment):** `DATABASE_URL` (Neon), `JWT__KEY` (random, 32+ characters; the app refuses to
  start without it; changing it signs everyone out and makes every sealed secret unreadable: two-step sign-in, KRA
  eTIMS keys and businesses' M-Pesa prompt keys, so don't). Optional `SENTRY__DSN`, `ANTHROPIC__APIKEY`, Africa's
  Talking keys.

### Moving from Railway (once)
1. In GitHub → Settings → Secrets → Actions set `OLD_DATABASE_URL` (Railway's `DATABASE_PUBLIC_URL`) and
   `ERP_DATABASE_URL` (Neon's direct connection string, for an empty database).
2. Actions → **Move database** → Run workflow, type `MOVE`. It copies everything and checks every table's row count.
3. On Render set `DATABASE_URL` to the same Neon string and `JWT__KEY` to **the value Railway had** (Railway →
   kabuor-erp → Variables), then deploy. Sign in and check a few invoices.
4. Point Safaricom's C2B confirmation URLs and any webhooks at the new address, then delete the Railway services.
   The nightly backup already reads `ERP_DATABASE_URL`, so it now backs up Neon.

- **Subscriptions** (Settings → Plan & billing): prices are `BILLING__PLANS__STARTER__MONTHLY` (and `BUSINESS`,
  `GROWTH`), in shillings; defaults 1,500 / 4,500 / 9,500. New businesses get 30 days free, then 7 days' grace,
  then read-only until they pay. Without M-Pesa keys every payment is a marked *test* payment (no money moves).
  For real collection set `BILLING__MPESA__CONSUMERKEY`, `__CONSUMERSECRET`, `__PASSKEY`, `__SHORTCODE`,
  `__ENVIRONMENT=production`, `__CALLBACKSECRET` (random), and for a till `__TYPE=CustomerBuyGoodsOnline` with
  `__PARTYB=<till>`. Safaricom calls back to `/api/billing/mpesa/<CALLBACKSECRET>`.
- **Legal pages** (`/privacy`, `/terms`): `LEGAL__EMAIL` (the privacy contact) and `LEGAL__HOSTINGREGION` (where
  Neon keeps the database). Until they're set the pages point people to the company website.
- **Webhooks** are sent by a background worker every 10 seconds; `WEBHOOKS__DISABLED=true` stops it.

## Each business's own connections
- **M-Pesa prompts from invoices:** the business enters its own Daraja app (Settings → Business & M-Pesa).
  Safaricom calls `/api/mpesa/stk/<company key>`; payments land on the invoice and are deduplicated by receipt.
- **Public API and webhooks:** Settings → Connections. See `docs/API.md`.

## Changing the data model
1. Change the entities.
2. `dotnet ef migrations add <WhatChanged> --project src/Kabuor.Erp.Api --output-dir Data/Migrations`
3. Read the generated migration. Renames show up as drop + add: edit them into a rename before committing.
4. CI fails if the model and the migrations disagree, and runs every test on PostgreSQL with the migrations.

## Backups
`.github/workflows/backup.yml` runs every night at 01:00 Nairobi time: `pg_dump` of the live database, encrypted
with AES-256 (`BACKUP_PASSPHRASE`), kept 30 days as a workflow artifact. Check the Actions tab weekly: a red run
means no backup that night. Neon's own point-in-time restore is a second copy worth keeping on.

### Restore
1. Actions → Backup → the night you want → download the artifact and unzip it.
2. `gpg --decrypt kabuor-erp-<date>.dump.gpg > erp.dump` (asks for the passphrase)
3. Into a new, empty database first, to check it:
   `pg_restore --no-owner --dbname "<new database URL>" erp.dump`
4. To replace production: suspend the `kabuor-erp` service on Render, restore with `--clean --if-exists` into the live database
   (Neon's direct connection string), start the service again.

Try a restore into a scratch database once a month; a backup nobody has restored is a hope, not a backup.

## If something goes wrong
- **Bad deploy:** Render → kabuor-erp → Events → the previous deploy → Rollback.
- **Leaked password for one person:** they use *Sign-in security → Sign out everywhere*, then change it (or the
  owner removes their login).
- **Leaked `JWT__KEY`:** set a new one; everyone signs in again and anyone using two-step sign-in sets it up again.
