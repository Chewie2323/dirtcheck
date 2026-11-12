# Dirt Check

Vacant-land comps and buy-box underwriting. A signed-in workspace can take a parcel, run a comps screen, and save an offer range: target, walk-away, confidence, and the sales behind the math.

This is for a lead who is already interested. Offer prices do not belong in cold texts, mailers, or dialer scripts.

Exit factors and minimum profit ship as workspace defaults: wholesale 50%, retail flip 60%, seller finance 75%, subdivide 55%, and $3,000 minimum profit on every exit. Due-diligence costs, the size curve, and feature adjustments are still **EXAMPLE** figures from a Nov 4, 2026 draft. All of them stay editable in Settings. The pilot market is Coshocton County, Ohio (FIPS 39031).

## Run it

```bash
npm install
```

Create a Postgres database and point `DATABASE_URL` at it (copy `.env.example` to `.env`). Local Postgres does not need a Neon account. A Neon host (`*.neon.tech`) uses the Neon serverless driver; any other URL uses a normal Postgres connection.

```bash
npm run db:migrate
npm run seed
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

No paid API keys are required. `npm run seed` is idempotent: it creates or refreshes the demo workspace.

| | |
| --- | --- |
| Email | `demo@dirtcheck.local` |
| Password | `dirtcheck-demo` |
| Workspace | Example Land Co. |

That login already has three Ohio fixture deals. You can also create your own workspace from the sign-up page. Each workspace has its own deals and factors.

### Try a buy box

On **New deal**, use one of the fixture parcels:

- `4120 Township Road 215, Coshocton, OH 43812` or APN `012-000345-00` — 5 acres, dirt road, 20% flood, Coshocton County (FIPS 39031). With the workspace defaults: median **$10,750/acre**, market value **$38,700**, after costs **$15,850**, walk-away **$12,850**, target **$10,923**, confidence **Low** because the search widens six steps before three comps survive.
- `8800 State Route 56, Athens, OH 45701` — tighter recent sales, high confidence.
- `15 Creek Bottom Lane, Pomeroy, OH 45769` — thin market, low confidence.

Any other address still runs, using synthetic demo comps that are labeled as such. They are not a market opinion.

The Land Portal choice on the form calls Land Portal's REST API (APN + state lookup, then an async comp report). The response mapper is tolerant but unverified against live data until a real report has been run; unreadable responses produce an error, never made-up comps.

## Scripts

```bash
npm test     # buy-box math, comps screens, and multi-tenant behavior (runs on an in-memory Postgres)
npm run lint
npm run build
npm start    # production, same port 3847
```

## Environment

Copy `.env.example` to `.env` and set `DATABASE_URL` before `npm run dev`. Session signing falls back to a dev secret when `BETTER_AUTH_SECRET` is unset.

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Signs session cookies. A dev default is used when this is unset. Set a long random value before anyone else can reach the app. |
| `BETTER_AUTH_URL` | Public origin. Defaults to `http://127.0.0.1:3847`. |
| `DATABASE_URL` | Postgres connection string. Required. Neon URLs use `@neondatabase/serverless`. Other URLs, including Supabase and local Postgres, use `pg`. Hosted URLs use TLS. |
| `DATABASE_SSL_CA` | Optional. A PEM certificate to verify the database TLS chain. Without it TLS is on but the chain is not verified. |
| `SHOW_DEMO_LOGIN` | Optional. Set to `1` to show the demo login on the sign-in page in production. |
| `LAND_PORTAL_API_KEY` | Land Portal API key. Required for the Land Portal comps provider (set in Vercel env vars; never commit it). |
| `LAND_PORTAL_BASE_URL` | Optional. Defaults to `https://landportal.com/wp-json/lp-rest-api/v1`. |

## Deploy on Vercel

Dirt Check runs on any Postgres. Supabase and Neon are both supported; Neon hosts (`*.neon.tech`) use the Neon serverless driver and everything else uses `pg`.

1. Create the database.
   - **Supabase:** create a project. Copy the **transaction pooler** string (port 6543) for `DATABASE_URL` on Vercel, and the **session or direct** string (port 5432) for running migrations.
   - **Neon:** copy the pooled connection string.
2. Import the repo in Vercel and set these variables for Production and Preview:
   - `DATABASE_URL`: the pooled connection string.
   - `BETTER_AUTH_SECRET`: a random string of at least 32 characters. Production refuses to start without it (`openssl rand -base64 32`).
   - `BETTER_AUTH_URL`: the public `https://` origin. Optional on Vercel, which falls back to its own deployment domain.
   - `LAND_PORTAL_API_KEY`: your Land Portal API key. Deals using the Land Portal provider need the parcel APN and state; reports build asynchronously, so a first run can show "pending" — run it again after a minute.
3. Build command: `npm run build`. The database client does not connect while the module is imported, so the build does not need a live query.
4. Apply the schema once, from your machine, with the direct (port 5432) string:

```bash
DATABASE_URL="postgresql://…:5432/postgres" npm run db:migrate
```

The migrations add the tables, lookup indexes, and, for Supabase, enable row-level security on every table so the public anon key cannot read them through Supabase's REST API. The app talks to Postgres directly, so it is unaffected.

The shared demo login is hidden in production. To show it on a deploy, set `SHOW_DEMO_LOGIN=1`, then run `npm run seed`. Seed only a throwaway environment, because the demo password is public.

## Buy-box formula

Workspace settings drive every factor. The engine, in order:

1. Keep same-county vacant arm's-length sales inside the tight window (5 miles, 12 months, ±20% acreage). Landlocked sales never comp against road frontage. Nominal deeds, improved sales, and bundles are dropped.
2. If fewer than 3 verified comps survive, widen one step at a time: distance first (5 → 15 → 30 miles), then time (12 → 24 → 36 months), then acreage (±20% → ±35% → ±50%). The report lists each step. Confidence drops one level per step. If the widest window is still under 3 comps, the result is `Insufficient comps — needs human review` and there is no offer.
3. Drop price-per-acre outliers outside 1.5×IQR.
4. Median price per acre.
5. Size adjustment: `−(subject acres ÷ average comp acres − 1) × elasticity`. EXAMPLE elasticity `0.15`.
6. Add feature adjustments (access, flood share, utilities, HOA, unclear title) and clamp the total.
7. Market value = adjusted $/acre × subject acres.
8. Exit value = market value × the exit factor (wholesale 50%, retail flip 60%, seller finance 75%, subdivide 55%).
9. Subtract back taxes, liens, mortgage, closing/title, survey (unless a survey is on file), and holding.
10. Walk-away = that remainder − minimum profit ($3,000 on every exit). Target = walk-away × (1 − opening discount).
11. Confidence starts at High, Medium, or Low from comp count, price spread, distance, and sale age, then drops one level for each widening step. Medium and Low ask for a human review. A landlocked tract or a non-positive walk-away produces no offer.

On the Coshocton fixture the after-cost line is still $15,850. Minimum profit of $3,000 makes the walk-away $12,850 and the target $10,923.

## Comps providers

`lib/comps/index.ts` picks a provider from the deal.

- `DemoCompsProvider` (`lib/comps/demo-provider.ts`) returns the Ohio fixtures, or synthetic filler.
- `LandPortalCompsProvider` (`lib/comps/land-portal.ts`) is the seam for later. The intended live sequence, from Land Portal's public API docs, is:
  1. Resolve a parcel number with `GET /search?type=parcelnumb`, or load a record with `GET /property-data?propertyid=&fips=` (or `lat` + `lng`). That yields `propertyid` and county FIPS.
  2. Queue a comp report with `POST /reports` `{ propertyid, fips }`, then read it with `GET /reports?propertyid=&fips=`.
  3. Send `Authorization: Bearer <token>`.

  Wire those methods inside `resolveSubject`, `requestCompReport`, and `readCompReport`. Do not scrape Land Portal, PropStream, or county sites from this app. Map the real report into `LandComp[]` and return `{ ok: true }` from `fetch` only when you have an actual response.

## Auth and tenancy

Email and password use [Better Auth](https://better-auth.com) with its Drizzle adapter (`provider: "pg"`). Sessions are httpOnly cookies. There is no third-party login service.

A user belongs to a workspace through `membership`, with a role: `owner`, `admin`, or `member`. Deals and factor settings are stored on `organizationId`, and `lib/deals.ts` is the only place deals are read or deleted, so every query is scoped to the workspace in one spot. A test proves one workspace cannot list, open, or delete another's deals.

| Role | Can do |
| --- | --- |
| owner | Everything, including removing admins and members. |
| admin | Change factors, invite members, remove members. |
| member | Create and run deals, delete their own. |

**Team.** Owners and admins invite people from the Team page. There is no email service yet, so the invite is a one-time link you send yourself. It works once, only for the invited email, and expires in 7 days. Only a hash of the link is stored. A person in more than one workspace gets a switcher in the header.

**Abuse limits.** Sign-in is limited per IP and per email, and sign-up per IP, with counters in Postgres (`rateLimit` table) so they hold across serverless instances. The public `/api/auth` routes use the same table.

**Health.** `GET /api/health` runs `select 1` and returns `{"ok":true}` or a 503. Point an uptime monitor at it.

`lib/db/index.ts` is the only connection point. Tables are `user`, `session`, `account`, `verification`, `organization`, `membership`, `org_settings`, and `deal`. The buy-box engine and comps providers do not import the database.

## What this build does not do

Live Land Portal calls, PropStream, Regrid, county scrapers, Stripe or any billing and plan limits, transactional email (invites are links, and there is no password reset or email verification), audit logs, data export or workspace deletion, CRM sync, PDF export, and mobile apps. Those are the next steps before charging customers.
