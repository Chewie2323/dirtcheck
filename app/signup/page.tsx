import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { loadWorkspace } from "@/lib/workspace";
import { AuthFrame } from "../login/page";

export const metadata = { title: "Create a workspace" };

export default async function SignupPage() {
  if (await loadWorkspace()) redirect("/deals");
  return (
    <AuthFrame
      title="Create a workspace"
      lede="Email and password stay on this machine. The workspace owns the deals and the buy-box factors."
    >
      <SignupForm />
    </AuthFrame>
  );
}
