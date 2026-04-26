import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist, Noto_Sans_Arabic } from "next/font/google";
import { cn } from "@/lib/utils";
import { getLocale } from "@/lib/i18n/server";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const notoArabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arabic" });

export const metadata: Metadata = {
  title: "Rudd — WhatsApp AI Appointment Agent",
  description: "Let AI handle your WhatsApp bookings and lead qualification.",
};

const RootLayout = async ({ children }: { children: ReactNode }) => {
  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const htmlClass = cn("font-sans", geist.variable, notoArabic.variable);

  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { ClerkProvider } = await import("@clerk/nextjs");
    return (
      <ClerkProvider>
        <html lang={locale} dir={dir} className={htmlClass}>
          <body>{children}</body>
        </html>
      </ClerkProvider>
    );
  }

  return (
    <html lang={locale} dir={dir} className={htmlClass}>
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;
