import { DealForm } from "@/components/deal-form";
import { blankIntake, sampleById } from "@/lib/samples";

export const metadata = { title: "New deal" };

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string }>;
}) {
  const params = await searchParams;
  const sample = sampleById(params.sample);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Intake</p>
        <h1 className="font-serif text-4xl tracking-tight">New deal</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Address or APN, acreage, and the qualifying questions. The pilot market is Coshocton County,
          Ohio (FIPS 39031). Exit factors and minimum profit start at the workspace defaults; other
          factors are still labeled EXAMPLE.
        </p>
      </div>
      <DealForm initial={sample?.intake ?? blankIntake} />
    </div>
  );
}
