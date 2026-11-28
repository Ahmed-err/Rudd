import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@rudd/db", "@rudd/shared"],
  // pg is only used for local databases; keep it out of the server bundle.
  serverExternalPackages: ["pg"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  webpack: { treeshake: { removeDebugLogging: true } },
  // Source maps only uploaded when SENTRY_AUTH_TOKEN is set
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
