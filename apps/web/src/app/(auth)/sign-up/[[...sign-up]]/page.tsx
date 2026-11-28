import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { BrandLogo } from "@/components/brand-logo";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-4">
      <Link href="/" aria-label="Rudd home">
        <BrandLogo name="Rudd" />
      </Link>
      <SignUp forceRedirectUrl="/onboarding" />
    </div>
  );
}
