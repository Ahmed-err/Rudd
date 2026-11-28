import { serve } from "inngest/next";
import { inngest } from "@/server/inngest/client";
import { handleIncomingMessage } from "@/server/inngest/handle-incoming-message";
import { sendAppointmentReminders } from "@/server/inngest/send-reminders";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [handleIncomingMessage, sendAppointmentReminders],
});
