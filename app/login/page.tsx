import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo-account";
import { loadWorkspace } from "@/lib/workspace";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await loadWorkspace()) redirect("/deals");
  return (
    <AuthFrame title="Sign in" lede="Open the workspace that holds your land files.">
      <LoginForm demoEmail={DEMO_EMAIL} demoPassword={DEMO_PASSWORD} />
    </AuthFrame>
  );
}

export function AuthFrame({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 font-semibold tracking-tight">
        Dirt Check
      </Link>
      <div className="rounded-xl border border-line bg-card p-6">
        <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{lede}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
