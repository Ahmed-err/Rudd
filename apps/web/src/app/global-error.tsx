"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, type ReactElement } from "react";

const GlobalError = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }): ReactElement => {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
};

export default GlobalError;
