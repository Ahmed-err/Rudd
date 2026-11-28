import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rudd.sarmadax.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy"],
        disallow: ["/dashboard", "/onboarding", "/sign-in", "/sign-up", "/api"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
