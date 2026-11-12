import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Missing</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">That deal is not in this workspace.</h1>
      <Link href="/deals" className="mt-6 text-sm font-medium text-pine">
        Back to deals
      </Link>
    </div>
  );
}
