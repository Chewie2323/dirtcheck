import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { safeNext } from "@/lib/next-path";
import { loadWorkspace } from "@/lib/workspace";
import { AuthFrame } from "../login/page";

export const metadata = { title: "Create a workspace" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await loadWorkspace()) redirect(next ?? "/deals");
  return (
    <AuthFrame
      title={next ? "Create your account" : "Create a workspace"}
      lede={
        next
          ? "Create your login, then you can join the workspace you were invited to."
          : "The workspace owns the deals and the buy-box factors. You can invite your team after you sign up."
      }
    >
      <SignupForm next={next} email={next ? params.email : undefined} />
    </AuthFrame>
  );
}
