# Running Kabuor ERP in production

## Where it runs
- **App:** Railway service `kabuor-erp` (Dockerfile), https://kabuor-erp-production.up.railway.app. Every push to
  `main` deploys; Railway switches traffic only once `/api/health/ready` answers (the database is reachable).
- **Database:** Railway Postgres. The schema comes from EF migrations (`src/Kabuor.Erp.Api/Data/Migrations`), applied
  on start. A database made before migrations existed is adopted automatically (`Data/SchemaSync.cs`).
- **Settings:** `DATABASE_URL` (reference to the Postgres service), `JWT__KEY` (random, 32+ characters; changing it
  signs everyone out and makes every sealed secret unreadable: two-step sign-in, KRA eTIMS keys and businesses'
  M-Pesa prompt keys, so don't). Optional `ANTHROPIC__APIKEY`, Africa's Talking keys.
- **Subscriptions** (Settings → Plan & billing): prices are `BILLING__PLANS__STARTER__MONTHLY` (and `BUSINESS`,
  `GROWTH`), in shillings; defaults 1,500 / 4,500 / 9,500. New businesses get 30 days free, then 7 days' grace,
  then read-only until they pay. Without M-Pesa keys every payment is a marked *test* payment (no money moves).
  For real collection set `BILLING__MPESA__CONSUMERKEY`, `__CONSUMERSECRET`, `__PASSKEY`, `__SHORTCODE`,
  `__ENVIRONMENT=production`, `__CALLBACKSECRET` (random), and for a till `__TYPE=CustomerBuyGoodsOnline` with
  `__PARTYB=<till>`. Safaricom calls back to `/api/billing/mpesa/<CALLBACKSECRET>`.
- **Legal pages** (`/privacy`, `/terms`): `LEGAL__EMAIL` (the privacy contact) and `LEGAL__HOSTINGREGION` (where
  Railway runs the database). Until they're set the pages point people to the company website.
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
means no backup that night. Railway's own volume backups (paid plans) are a second copy worth turning on.

### Restore
1. Actions → Backup → the night you want → download the artifact and unzip it.
2. `gpg --decrypt kabuor-erp-<date>.dump.gpg > erp.dump` (asks for the passphrase)
3. Into a new, empty database first, to check it:
   `pg_restore --no-owner --dbname "<new database URL>" erp.dump`
4. To replace production: stop the `kabuor-erp` service, restore with `--clean --if-exists` into the live database
   (DATABASE_PUBLIC_URL), start the service again.

Try a restore into a scratch database once a month; a backup nobody has restored is a hope, not a backup.

## If something goes wrong
- **Bad deploy:** Railway → kabuor-erp → Deployments → the previous one → Redeploy.
- **Leaked password for one person:** they use *Sign-in security → Sign out everywhere*, then change it (or the
  owner removes their login).
- **Leaked `JWT__KEY`:** set a new one; everyone signs in again and anyone using two-step sign-in sets it up again.
