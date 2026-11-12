import Link from "next/link";
import { ComplianceNote } from "@/components/compliance-note";
import { currentSession } from "@/lib/workspace";

export default async function HomePage() {
  // The landing page only needs to know whether someone is signed in, so it
  // checks the session and skips the workspace queries.
  const workspace = await currentSession();
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-8 w-8 rounded-md bg-pine" aria-hidden="true" />
          <span className="font-semibold tracking-tight">Dirt Check</span>
        </div>
        <div className="flex gap-2 text-sm">
          {workspace ? (
            <Link href="/deals" className="rounded-md bg-pine px-3 py-2 text-paper">
              Open deals
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-3 py-2">
                Sign in
              </Link>
              <Link href="/signup" className="rounded-md bg-pine px-3 py-2 text-paper">
                Create a workspace
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pine">Vacant land underwriting</p>
          <h1 className="mt-3 max-w-xl font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Price the dirt before you price the offer.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
            Dirt Check is the land desk version of a house buy-box. Enter an address or APN,
            answer the intake, and get a range: target, walk-away, confidence, and the comps
            behind the math.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={workspace ? "/deals/new" : "/signup"} className="inline-flex h-12 items-center rounded-md bg-pine px-5 text-paper">
              {workspace ? "New deal" : "Start a workspace"}
            </Link>
            <Link href="/login" className="inline-flex h-12 items-center rounded-md border border-line bg-card px-5">
              Sign in
            </Link>
          </div>
          <div className="mt-8 max-w-xl">
            <ComplianceNote />
          </div>
        </div>

        <aside className="rounded-xl border border-line bg-card p-5 shadow-[0_20px_50px_rgba(28,25,21,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Pilot worksheet</p>
            <span className="rounded-full bg-moss px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-pine">
              Coshocton
            </span>
          </div>
          <h2 className="mt-3 font-serif text-2xl tracking-tight">4120 Township Road 215</h2>
          <p className="text-sm text-muted">Coshocton County, OH · 5 acres · wholesale · dirt road · 20% flood</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-paper p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Target</p>
              <p className="font-serif text-3xl">$10,923</p>
            </div>
            <div className="rounded-lg bg-paper p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Walk-away</p>
              <p className="font-serif text-3xl">$12,850</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <Row k="Median of verified comps" v="$10,750/ac" />
            <Row k="After size and features" v="$7,740/ac" />
            <Row k="Market value" v="$38,700" />
            <Row k="50% wholesale, then costs" v="$15,850" />
            <Row k="Minus $3,000 minimum profit" v="$12,850 walk-away" />
            <Row k="Confidence" v="Low · search widened" />
          </dl>
          <p className="mt-4 text-xs leading-5 text-muted">
            Wholesale 50% and the $3,000 minimum profit are the workspace defaults. Size and feature
            adjustments still use the draft curve. The comps are fixtures, not a live appraisal. The
            search has to widen past the tight acreage band, so confidence drops one level per step.
          </p>
        </aside>
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/80 py-1.5">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium tabular-nums">{v}</dd>
    </div>
  );
}
