import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@rudd/db", "@rudd/shared"],
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  disableLogger: true,
  // Source maps only uploaded when SENTRY_AUTH_TOKEN is set
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
