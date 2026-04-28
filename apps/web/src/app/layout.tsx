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
  description: "Let AI handle your WhatsApp bookings and lead qualification. Automated appointment booking, customer follow-up, and escalation — all through WhatsApp.",
  keywords: ["WhatsApp", "AI", "appointment booking", "chatbot", "business automation"],
  openGraph: {
    title: "Rudd — WhatsApp AI Appointment Agent",
    description: "Automate your WhatsApp appointments with AI. Book, reschedule, and manage customer conversations without lifting a finger.",
    type: "website",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://rudd-web.vercel.app",
  },
  verification: {
    google: "0VD6NXatzINZ1sTog_Cj8ZlTYQwUcPeRHzPSWAy56gI",
  },
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
