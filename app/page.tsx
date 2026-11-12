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
            Dirt Check is the land desk version of a house buy-box. Enter a parcel APN and state,
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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">How it works</p>
          <ol className="mt-4 space-y-4 text-sm leading-6">
            <li>
              <p className="font-medium">1. Enter the parcel</p>
              <p className="text-muted">APN and state for any U.S. county, acreage, and the intake answers from the seller call.</p>
            </li>
            <li>
              <p className="font-medium">2. Pull real sold comps</p>
              <p className="text-muted">Comps come from Land Portal, then get screened for distance, age, size, and outliers.</p>
            </li>
            <li>
              <p className="font-medium">3. Get a range, not a guess</p>
              <p className="text-muted">Target offer, walk-away number, and a confidence level, using your own exit factors and minimum profit.</p>
            </li>
            <li>
              <p className="font-medium">4. Know when to stop</p>
              <p className="text-muted">Thin or messy comps withhold the offer and flag the deal for a human instead of showing a made-up number.</p>
            </li>
          </ol>
        </aside>
      </main>
    </div>
  );
}

