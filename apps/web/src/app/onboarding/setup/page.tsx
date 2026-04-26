import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SetupForm } from "./setup-form";
import { getT } from "@/lib/i18n/server";

export default async function OnboardingSetupPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding");

  const client = await clerkClient();
  const [org, t] = await Promise.all([
    client.organizations.getOrganization({ organizationId: orgId }),
    getT(),
  ]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold">{t.onboarding.setup.title}</h1>
        <p className="text-muted-foreground text-sm">{t.onboarding.setup.description}</p>
      </div>
      <SetupForm defaultBusinessName={org.name} t={t.onboarding.setup} />
    </div>
  );
}
