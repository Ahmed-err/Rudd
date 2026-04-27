import "server-only";
import OpenAI from "openai";
import { db, messages } from "@rudd/db";
import { and, eq, desc } from "drizzle-orm";
import { stripMarkdown } from "@/lib/strip-markdown";
import { TOOL_DEFINITIONS } from "./tools";
import { dispatchToolCall } from "./handlers";

// Llama models sometimes output tool calls as text instead of structured tool_calls.
// Pattern: <function=name>{"arg":"val"}</function>  or  <function=name></function>
const parseTextFunctionCalls = (content: string): Array<{ name: string; args: unknown }> => {
  const results: Array<{ name: string; args: unknown }> = [];
  const re = /<function=([a-z_]+)>([\s\S]*?)<\/function>/g;
  for (let match = re.exec(content); match !== null; match = re.exec(content)) {
    const name = match[1] ?? "";
    const raw = match[2]?.trim();
    let args: unknown = {};
    try { args = raw ? JSON.parse(raw) : {}; } catch { args = {}; }
    results.push({ name, args });
  }
  return results;
};

const apiKey = process.env.GROQ_API_KEY ?? process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("Missing LLM API key: set GROQ_API_KEY or OPENAI_API_KEY");

const client = new OpenAI({
  apiKey,
  baseURL: process.env.GROQ_API_KEY
    ? "https://api.groq.com/openai/v1"
    : "https://api.openai.com/v1",
});

const MODEL = process.env.GROQ_API_KEY ? "llama-3.3-70b-versatile" : "gpt-4o-mini";

const MAX_TOOL_ROUNDS = 4;
const HISTORY_MESSAGES = 10;

type RunnerInput = {
  tenantId: string;
  conversationId: string;
  contactId: string;
  userMessage: string;
  context: {
    businessName: string;
    services: unknown;
    workingHours: unknown;
    timezone: string;
    systemPrompt: string | undefined;
  };
};

type DaySchedule = { enabled: boolean; open: string; close: string };
const DAY_NAMES: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

const buildSystemPrompt = (ctx: RunnerInput["context"]): string => {
  const services = Array.isArray(ctx.services) && ctx.services.length
    ? (ctx.services as Array<{ id: string; name: string; duration_minutes?: number }>)
        .map(s => `• ${s.name}${s.duration_minutes ? ` (${s.duration_minutes} min)` : ""}`)
        .join("\n")
    : "• General appointment";

  let hours = "Monday–Friday 09:00–17:00";
  if (ctx.workingHours && typeof ctx.workingHours === "object") {
    const entries = Object.entries(ctx.workingHours as Record<string, DaySchedule>)
      .filter(([, v]) => v?.enabled)
      .map(([k, v]) => `${DAY_NAMES[k] ?? k} ${v.open}–${v.close}`);
    if (entries.length) hours = entries.join(", ");
  }

  return `
You are a professional booking assistant for **${ctx.businessName}** on WhatsApp.
Today is ${new Date().toISOString().split("T")[0]}. Timezone: ${ctx.timezone}.

SERVICES OFFERED:
${services}

WORKING HOURS: ${hours}
IMPORTANT: Never propose or book slots outside these working hours. If a customer requests a time outside working hours, politely inform them and offer the next available slot within working hours.

YOUR GOAL: Guide the customer from their first message to a confirmed appointment in as few messages as possible.

CONVERSATION FLOW:
1. If this is the first message, greet warmly and ask which service they need (if not already stated).
2. Once you know the service, immediately call propose_slots to offer 2–3 specific date/time options. Never ask open-ended "when are you free?".
3. When the customer picks a slot, call book_appointment right away and confirm with the details.
4. If they ask to cancel an existing appointment, call cancel_appointment.
5. If the customer seems frustrated or the issue is outside your scope, call escalate_to_human.

STRICT RULES:
- Reply in the EXACT SAME LANGUAGE the customer uses. Arabic → Arabic, English → English. Never switch.
- PLAIN TEXT ONLY. Zero markdown. No *, **, _, #, -, bullets, numbered lists, or colons introducing lists. Write in flowing sentences only.
- WhatsApp style: short and warm. Maximum 3 sentences per reply.
- Never say you are an AI or a bot unless the customer directly asks.
- Never make up appointment times — always use propose_slots first.
- Call only ONE tool per reply. Wait for the result before deciding the next step.
${ctx.systemPrompt ? `\nOWNER INSTRUCTIONS (follow these above all):\n${ctx.systemPrompt}` : ""}
`.trim();
};

export const runAssistant = async (input: RunnerInput): Promise<string> => {
  const handlerCtx = {
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    contactId: input.contactId,
  };

  // Load recent history — only user/assistant turns, skip tool messages
  const history = await db
    .select({ role: messages.role, body: messages.body })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, input.conversationId),
        eq(messages.tenantId, input.tenantId),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(HISTORY_MESSAGES);

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(input.context) },
    ...history
      .reverse()
      .filter((m) => m.body && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.body ?? "" })),
    { role: "user", content: input.userMessage },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: chatMessages,
      tools: TOOL_DEFINITIONS as OpenAI.Chat.ChatCompletionTool[],
      tool_choice: "auto",
      // Prevent the model calling multiple tools at once — keeps flow predictable
      parallel_tool_calls: false,
    });

    const choice = response.choices[0];
    if (!choice) throw new Error("No response from model");

    const msg = choice.message;
    chatMessages.push(msg);

    // Detect Llama text-format tool calls: <function=name>{"arg":"val"}</function>
    const textFnCalls = parseTextFunctionCalls(msg.content ?? "");

    // Final text reply — no tool calls of any kind
    if (!msg.tool_calls?.length && !textFnCalls.length) {
      const text = stripMarkdown(msg.content ?? "");
      if (!text) {
        return input.userMessage.match(/[؀-ۿ]/)
          ? "عذراً، هل يمكنك إعادة الصياغة؟"
          : "Sorry, could you rephrase that?";
      }
      return text;
    }

    // Handle text-format tool calls by re-injecting them as proper tool_calls
    if (textFnCalls.length && !msg.tool_calls?.length) {
      const cleanContent = stripMarkdown(msg.content ?? "");
      const fakeTc = textFnCalls[0];
      if (!fakeTc) continue;
      const fakeId = `text_fn_${round}`;
      chatMessages[chatMessages.length - 1] = {
        ...msg,
        content: cleanContent || null,
        tool_calls: [{
          id: fakeId,
          type: "function",
          function: { name: fakeTc.name, arguments: JSON.stringify(fakeTc.args) },
        }],
      };
      let output: string;
      try {
        console.log(`[agent] text-format tool call: ${fakeTc.name}(${JSON.stringify(fakeTc.args)})`);
        output = await dispatchToolCall(fakeTc.name, fakeTc.args, handlerCtx);
        console.log(`[agent] tool result: ${output}`);
      } catch (err) {
        output = JSON.stringify({ error: String(err) });
      }
      chatMessages.push({ role: "tool", tool_call_id: fakeId, content: output });
      continue;
    }

    // Execute structured tool calls sequentially
    for (const tc of msg.tool_calls ?? []) {
      let output: string;
      try {
        const fnName = "function" in tc ? tc.function.name : "";
        const fnArgs = "function" in tc ? tc.function.arguments : "{}";
        console.log(`[agent] tool call: ${fnName}(${fnArgs})`);
        const args = JSON.parse(fnArgs) as unknown;
        output = await dispatchToolCall(fnName, args, handlerCtx);
        console.log(`[agent] tool result: ${output}`);
      } catch (err) {
        console.error("[agent] tool error:", err);
        output = JSON.stringify({ error: String(err) });
      }
      chatMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: output,
      });
    }
  }

  // Exceeded rounds — ask the model for a plain text reply with no tools
  const fallback = await client.chat.completions.create({
    model: MODEL,
    messages: [
      ...chatMessages,
      { role: "system", content: "Summarise what you know and give a SHORT plain text reply. No tool calls." },
    ],
  });

  return stripMarkdown(fallback.choices[0]?.message.content ?? "")
    || "Sorry, I ran into an issue. Please try again.";
};
