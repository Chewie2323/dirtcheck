"use client";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-lg border border-stop/30 bg-stop-soft p-6">
      <h1 className="font-serif text-3xl text-stop">This page did not load</h1>
      <p className="mt-2 text-sm text-stop">The deal or the database call failed. Try it again.</p>
      <button className="mt-4 h-10 rounded-md bg-pine px-4 text-sm text-paper" onClick={() => reset()} type="button">
        Retry
      </button>
    </div>
  );
}
