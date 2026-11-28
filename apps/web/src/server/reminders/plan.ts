import type { TemplateInput } from "@/server/whatsapp/client";

const HOUR = 60 * 60_000;
const SERVICE_WINDOW_MS = 24 * HOUR;
const MIN_LEAD_MS = 60 * 60_000;
const ARABIC_RE = /[؀-ۿ]/;

export type ReminderInput = {
  startAt: Date;
  createdAt: Date;
  now: Date;
  hoursBefore: number;
  lastInboundAt: Date | null;
  lastInboundBody: string | null;
  customerName: string | null;
  businessName: string;
  serviceName: string;
  timeZone: string;
  template: { name: string; language: string } | null;
};

export type ReminderPlan =
  | { kind: "text"; body: string }
  | { kind: "template"; template: TemplateInput; body: string }
  | { kind: "skip"; reason: "not_due" | "too_late" | "booked_inside_window" | "no_template_outside_window" };

export const isReminderDue = (i: Pick<ReminderInput, "startAt" | "createdAt" | "now" | "hoursBefore">) => {
  const opensAt = i.startAt.getTime() - i.hoursBefore * HOUR;
  if (i.now.getTime() < opensAt) return "not_due" as const;
  if (i.startAt.getTime() - i.now.getTime() < MIN_LEAD_MS) return "too_late" as const;
  // A customer who booked after the window opened just got a confirmation; don't remind them instantly.
  if (i.createdAt.getTime() >= opensAt) return "booked_inside_window" as const;
  return "due" as const;
};

const formatWhen = (startAt: Date, timeZone: string, arabic: boolean): string =>
  new Intl.DateTimeFormat(arabic ? "ar-EG" : "en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(startAt);

export const planReminder = (i: ReminderInput): ReminderPlan => {
  const due = isReminderDue(i);
  if (due !== "due") return { kind: "skip", reason: due };

  const arabic = ARABIC_RE.test(i.lastInboundBody ?? "") || i.template?.language.startsWith("ar") === true;
  const when = formatWhen(i.startAt, i.timeZone, arabic);
  const body = arabic
    ? `تذكير: موعدك (${i.serviceName}) لدى ${i.businessName} يوم ${when}. ردّ على هذه الرسالة إذا أردت تغيير الموعد أو إلغاءه.`
    : `Reminder: your ${i.serviceName} appointment at ${i.businessName} is on ${when}. Reply here if you need to reschedule or cancel.`;

  const windowOpen = !!i.lastInboundAt && i.now.getTime() - i.lastInboundAt.getTime() < SERVICE_WINDOW_MS;
  if (windowOpen) return { kind: "text", body };

  if (!i.template) return { kind: "skip", reason: "no_template_outside_window" };
  const fallbackName = arabic ? "عميلنا العزيز" : "there";
  return {
    kind: "template",
    body,
    template: {
      name: i.template.name,
      language: i.template.language,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: i.customerName?.trim() || fallbackName },
            { type: "text", text: i.businessName },
            { type: "text", text: when },
          ],
        },
      ],
    },
  };
};
