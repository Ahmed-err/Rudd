import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

const HomePage = async () => {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { auth } = await import("@clerk/nextjs/server");
    const { userId, orgId } = await auth();
    if (userId && orgId) redirect("/dashboard");
    if (userId && !orgId) redirect("/onboarding");
  }

  const t = await getT();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">{t.nav.brand}</h1>
        <p className="text-muted-foreground text-lg">{t.home.tagline}</p>
      </div>
      <div className="flex gap-3">
        <Link href="/sign-in"><Button>{t.home.signIn}</Button></Link>
        <Link href="/sign-up"><Button variant="outline">{t.home.createAccount}</Button></Link>
      </div>
    </main>
  );
};

export default HomePage;
