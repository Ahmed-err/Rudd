import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CreateOrganization } from "@clerk/nextjs";
import { getT } from "@/lib/i18n/server";

export default async function OnboardingPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (orgId) redirect("/onboarding/setup");

  const t = await getT();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold">{t.onboarding.welcome}</h1>
        <p className="text-muted-foreground text-sm">{t.onboarding.createWorkspace}</p>
      </div>
      <CreateOrganization afterCreateOrganizationUrl="/onboarding/setup" />
    </div>
  );
}
