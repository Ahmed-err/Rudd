export const register = async (): Promise<void> => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    if (process.env.NODE_ENV === "production") {
      const { validateEnvAtStartup } = await import("./lib/env");
      validateEnvAtStartup();
    }
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
};

export { captureRequestError as onRequestError } from "@sentry/nextjs";
