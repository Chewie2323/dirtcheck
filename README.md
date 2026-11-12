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

The Land Portal choice on the form is a stub. It records the calls it would make and does not send HTTP or invent a report.

## Scripts

```bash
npm test     # buy-box math and the comps screens
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
| `DATABASE_URL` | Postgres connection string. Required. Neon URLs use `@neondatabase/serverless`. Other URLs, including local Postgres, use `pg`. |
| `LAND_PORTAL_API_KEY` | Optional. The stub checks whether it is set and still does not call the API. |
| `LAND_PORTAL_BASE_URL` | Optional. Defaults to `https://landportal.com/wp-json/lp-rest-api/v1`. |

## Deploy on Vercel

Dirt Check expects [Neon](https://neon.tech) Postgres. `better-sqlite3` is not used.

1. Create a Neon project and copy the pooled connection string.
2. Import the repo in Vercel. Set these environment variables for Production and Preview:
   - `DATABASE_URL` — the Neon connection string (`sslmode=require`).
   - `BETTER_AUTH_SECRET` — a long random string.
   - `BETTER_AUTH_URL` — the public `https://` origin of the deployment.
   - `LAND_PORTAL_API_KEY` — leave empty until a live Land Portal client is wired.
3. Build command: `npm run build`. The database client does not connect while the module is imported, so the build does not need a live query.
4. Apply the schema once the database exists:

```bash
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" npm run db:migrate
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" npm run seed
```

`drizzle/` holds the SQL migrations. `npm run seed` loads `demo@dirtcheck.local` / `dirtcheck-demo` and the Example Land Co. deals. Running it again updates that workspace instead of inserting a second copy.

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

A user belongs to a workspace through `membership`. Deals and factor settings are stored on `organizationId` and every query checks that id. Sign-up creates the user, the workspace, and the default settings together.

`lib/db/index.ts` is the only connection point. Tables are `user`, `session`, `account`, `verification`, `organization`, `membership`, `org_settings`, and `deal`. The buy-box engine and comps providers do not import the database.

## What this build does not do

Live Land Portal calls, PropStream, Regrid, county scrapers, Stripe, CRM sync, PDF export, and mobile apps.
