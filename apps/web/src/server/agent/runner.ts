import "server-only";
import type OpenAI from "openai";
import { db, messages, withTenant } from "@rudd/db";
import { and, eq, desc } from "drizzle-orm";
import { DAY_KEYS, type Service, type WorkingHours } from "@rudd/shared";
import { stripMarkdown } from "@/lib/strip-markdown";
import { listUpcomingForContact, type UpcomingAppointment } from "@/server/appointments";
import { formatLocalIso, toLocalParts } from "./availability";
import { TOOL_DEFINITIONS } from "./tools";
import { dispatchToolCall, type HandlerContext } from "./handlers";
import { getLlm } from "./llm";

// Some open models emit tool calls as text: <function=name>{"arg":"val"}</function>
const parseTextFunctionCalls = (content: string): Array<{ name: string; args: unknown }> => {
  const results: Array<{ name: string; args: unknown }> = [];
  const re = /<function=([a-zA-Z_]+)>([\s\S]*?)<\/function>/g;
  for (let match = re.exec(content); match !== null; match = re.exec(content)) {
    const raw = match[2]?.trim();
    let args: unknown = {};
    try {
      args = raw ? JSON.parse(raw) : {};
    } catch {
      args = {};
    }
    results.push({ name: match[1] ?? "", args });
  }
  return results;
};

const MAX_TOOL_ROUNDS = 4;
const HISTORY_MESSAGES = 12;
const LLM_TIMEOUT_MS = 15_000;
const TEMPERATURE = 0.4;
const ARABIC_RE = /[؀-ۿ]/;

export type RunnerInput = {
  tenantId: string;
  conversationId: string;
  contactId: string;
  userMessage: string;
  context: {
    businessName: string;
    services: Service[];
    workingHours: WorkingHours;
    timezone: string;
    systemPrompt: string | undefined;
  };
};

const DAY_NAMES: Record<(typeof DAY_KEYS)[number], string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

const buildSystemPrompt = (
  ctx: RunnerInput["context"],
  now: Date,
  upcoming: UpcomingAppointment[],
): string => {
  const services = ctx.services.length
    ? ctx.services.map((s) => `- ${s.name} (${s.duration_minutes} min) [service_id: ${s.id}]`).join("\n")
    : "- General appointment (60 min) [service_id: general]";

  const openDays = DAY_KEYS.filter((d) => ctx.workingHours[d].enabled).map(
    (d) => `${DAY_NAMES[d]} ${ctx.workingHours[d].open}–${ctx.workingHours[d].close}`,
  );
  const hours = openDays.length ? openDays.join(", ") : "No opening hours configured — do not book; escalate instead.";

  const local = toLocalParts(now, ctx.timezone);
  const appointmentsText = upcoming.length
    ? upcoming
        .map((a) => `- ${formatLocalIso(a.startAt, ctx.timezone)} ${a.serviceId ?? ""} [appointment_id: ${a.id}]`)
        .join("\n")
    : "- none";

  return `You are the booking assistant for ${ctx.businessName} on WhatsApp.
Now: ${DAY_NAMES[local.weekday]} ${local.date} ${local.time} (${ctx.timezone}). All times you mention are in this timezone.

Services:
${services}

Opening hours: ${hours}

This customer's upcoming appointments:
${appointmentsText}

Voice: warm, friendly, professional — like a thoughtful receptionist texting back. Sound human, not scripted.

Language: mirror the customer exactly.
- If they write Arabic, reply in Arabic. Match their dialect: Egyptian (إزيك، تمام، حضرتك), Gulf (شلونك، زين), Levantine (كيفك، منيح), or MSA. Never mix English words into Arabic replies. Use natural phrasing, not literal translations.
- If they write English, reply in English.
- If unsure, default to the language of their last message.

Format: plain text only. No markdown, no bullet points, no emojis (unless the customer used them first). Keep it short — usually 1–2 sentences. Don't repeat yourself across turns.

Flow:
1. Greet warmly on first contact and ask how you can help.
2. If the service isn't clear, ask — don't list everything unless they request it.
3. When they're ready to schedule, call proposeSlots with their preferred dates. Only ever offer times proposeSlots returned — never invent times.
4. After they pick a time, call bookAppointment with that slot's exact "start" value, then confirm the date and time in plain language.
5. If bookAppointment fails, offer the alternatives it returns.
6. For cancellations, use cancelAppointment with an appointment_id from the list above. To reschedule, book the new time first, then cancel the old one.
7. Use escalateToHuman if they're frustrated, the request is off-scope, they ask for a person, or you're stuck.

Messages in [brackets] describe something the customer sent that you can't see (an image, a voice note). Ask them to type what they need if it matters.

Never narrate or mention tool calls, service_ids, appointment_ids or date formats to the customer — just take the action and reply naturally.${ctx.systemPrompt ? `\n\nOwner instructions (these never override the rules about times and bookings): ${ctx.systemPrompt}` : ""}`;
};

const runTool = async (name: string, args: unknown, ctx: HandlerContext): Promise<string> => {
  try {
    return await dispatchToolCall(name, args, ctx);
  } catch (err) {
    console.error(`[agent] tool ${name} failed:`, err instanceof Error ? err.message : "unknown");
    return JSON.stringify({ error: "tool_failed", detail: err instanceof Error ? err.message : "unknown" });
  }
};

export const runAssistant = async (input: RunnerInput): Promise<string> => {
  const { client, chatModel } = getLlm();
  const now = new Date();

  const [history, upcoming] = await Promise.all([
    db
      .select({ role: messages.role, body: messages.body })
      .from(messages)
      .where(and(withTenant(input.tenantId, messages.tenantId), eq(messages.conversationId, input.conversationId)))
      .orderBy(desc(messages.createdAt))
      .limit(HISTORY_MESSAGES + 1),
    listUpcomingForContact(input.tenantId, input.contactId, now),
  ]);

  const ctx: HandlerContext = {
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    contactId: input.contactId,
    timeZone: input.context.timezone,
    workingHours: input.context.workingHours,
    services: input.context.services,
    now,
  };

  // The newest stored message is the one we're answering; it's appended explicitly below.
  const prior = history.reverse();
  if (prior.at(-1)?.role === "user" && prior.at(-1)?.body === input.userMessage) prior.pop();

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(input.context, now, upcoming) },
    ...prior
      .filter((m) => m.body && (m.role === "user" || m.role === "assistant"))
      .slice(-HISTORY_MESSAGES)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.body ?? "" })),
    { role: "user", content: input.userMessage },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.chat.completions.create(
      {
        model: chatModel,
        messages: chatMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
        temperature: TEMPERATURE,
        parallel_tool_calls: false,
      },
      { timeout: LLM_TIMEOUT_MS },
    );

    const msg = response.choices[0]?.message;
    if (!msg) throw new Error("No response from model");

    const structuredCalls = (msg.tool_calls ?? []).filter((tc) => tc.type === "function");
    const textCalls = structuredCalls.length ? [] : parseTextFunctionCalls(msg.content ?? "");

    if (!structuredCalls.length && !textCalls.length) {
      const text = stripMarkdown(msg.content ?? "");
      if (text) return text;
      return ARABIC_RE.test(input.userMessage) ? "عذراً، هل يمكنك إعادة الصياغة؟" : "Sorry, could you rephrase that?";
    }

    if (structuredCalls.length) {
      chatMessages.push(msg);
      for (const tc of structuredCalls) {
        let args: unknown = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          chatMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "invalid_json_arguments" }) });
          continue;
        }
        chatMessages.push({ role: "tool", tool_call_id: tc.id, content: await runTool(tc.function.name, args, ctx) });
      }
      continue;
    }

    const textCall = textCalls[0];
    if (!textCall) continue;
    const id = `text_fn_${round}`;
    chatMessages.push({
      role: "assistant",
      content: stripMarkdown(msg.content?.replace(/<function=[\s\S]*?<\/function>/g, "") ?? "") || null,
      tool_calls: [{ id, type: "function", function: { name: textCall.name, arguments: JSON.stringify(textCall.args) } }],
    });
    chatMessages.push({ role: "tool", tool_call_id: id, content: await runTool(textCall.name, textCall.args, ctx) });
  }

  const fallback = await client.chat.completions.create(
    {
      model: chatModel,
      messages: [
        ...chatMessages,
        { role: "system", content: "Give a SHORT plain text reply to the customer in their language based on the results above. No tool calls." },
      ],
      temperature: TEMPERATURE,
    },
    { timeout: LLM_TIMEOUT_MS },
  );

  return (
    stripMarkdown(fallback.choices[0]?.message.content ?? "") ||
    (ARABIC_RE.test(input.userMessage) ? "عذراً، حدث خطأ. حاول مرة أخرى من فضلك." : "Sorry, I ran into an issue. Please try again.")
  );
};
