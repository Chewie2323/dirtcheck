import { DealForm } from "@/components/deal-form";
import { defaultProvider, demoMode } from "@/lib/features";
import { blankIntake, sampleById } from "@/lib/samples";

export const metadata = { title: "New deal" };

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string }>;
}) {
  const params = await searchParams;
  const demo = demoMode();
  const sample = demo ? sampleById(params.sample) : undefined;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Intake</p>
        <h1 className="font-serif text-4xl tracking-tight">New deal</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Parcel APN and state, acreage, and the qualifying questions. Works for any U.S. county. Offer
          math uses your workspace settings.
        </p>
      </div>
      <DealForm initial={sample?.intake ?? { ...blankIntake, provider: defaultProvider() }} demo={demo} />
    </div>
  );
}
