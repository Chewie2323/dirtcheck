export function ComplianceNote({ compact = false }: { compact?: boolean }) {
  return (
    <aside className="rounded-md border border-copper/30 bg-copper-soft px-4 py-3 text-sm leading-6 text-copper">
      <p className="font-semibold tracking-tight">Offers stay out of cold outreach.</p>
      {compact ? null : (
        <p className="mt-1">
          Dirt Check is for underwriting a lead who is already interested. Do not paste these
          numbers into texts, mailers, voicemails, or dialer scripts. A person signs off before
          anyone quotes an offer.
        </p>
      )}
    </aside>
  );
}
