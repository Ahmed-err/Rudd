import "server-only";
import { Inngest } from "inngest";

// In local dev, INNGEST_DEV=1 makes the client send events to the local
// Inngest Dev Server at http://localhost:8288 instead of Inngest cloud.
export const inngest = new Inngest({
  id: "rudd",
  ...(process.env.INNGEST_EVENT_KEY ? { eventKey: process.env.INNGEST_EVENT_KEY } : {}),
  ...(process.env.INNGEST_DEV === "1" ? { baseUrl: "http://localhost:8288" } : {}),
});
