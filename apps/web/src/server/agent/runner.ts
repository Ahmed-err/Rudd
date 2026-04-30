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
  const re = /<function=([a-zA-Z_]+)>([\s\S]*?)<\/function>/g;
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

// gpt-oss-120b: 120B-param open model, strong reasoning + tool calls, ~1-2s on Groq.
// Override via GROQ_MODEL env var (e.g. qwen/qwen3-32b for Arabic, llama-3.1-8b-instant for speed).
const MODEL = process.env.GROQ_API_KEY
  ? (process.env.GROQ_MODEL ?? "openai/gpt-oss-120b")
  : "gpt-4o-mini";

const MAX_TOOL_ROUNDS = 3;
const HISTORY_MESSAGES = 6;
const LLM_TIMEOUT_MS = 12_000;
const TEMPERATURE = 0.5;

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
        .map(s => `- ${s.name}${s.duration_minutes ? ` (${s.duration_minutes} min)` : ""} [service_id: ${s.id}]`)
        .join("\n")
    : "- General appointment [service_id: general]";

  let hours = "Monday–Friday 09:00–17:00";
  if (ctx.workingHours && typeof ctx.workingHours === "object") {
    const entries = Object.entries(ctx.workingHours as Record<string, DaySchedule>)
      .filter(([, v]) => v?.enabled)
      .map(([k, v]) => `${DAY_NAMES[k] ?? k} ${v.open}–${v.close}`);
    if (entries.length) hours = entries.join(", ");
  }

  return `You are the booking assistant for ${ctx.businessName} on WhatsApp. Today is ${new Date().toISOString().split("T")[0]}. Timezone: ${ctx.timezone}.

Services:
${services}

Hours: ${hours}. Never book outside these hours.

Voice: warm, friendly, professional — like a thoughtful receptionist texting back. Sound human, not scripted.

Language: mirror the customer exactly.
- If they write Arabic, reply in Arabic. Match their dialect: Egyptian (إزيك، تمام، حضرتك), Gulf (شلونك، زين), Levantine (كيفك، منيح), or MSA. Never mix English words into Arabic replies. Use natural phrasing, not literal translations.
- If they write English, reply in English.
- If unsure, default to the language of their last message.

Format: plain text only. No markdown, no bullet points, no emojis (unless the customer used them first). Keep it short — usually 1–2 sentences. Don't repeat yourself across turns.

Flow:
1. Greet warmly on first contact and ask how you can help.
2. If the service isn't clear, ask — don't list everything unless they request it.
3. When they're ready to schedule, call proposeSlots with their preferred date range.
4. After they pick a slot, call bookAppointment, then confirm with the date/time in plain language.
5. Use cancelAppointment for cancellations.
6. Use escalateToHuman if they're frustrated, the request is off-scope, or you're stuck.

One tool call per turn. Never narrate or mention the tool call (or service_ids, date formats, etc.) to the customer — just take the action and reply naturally.

When calling proposeSlots/bookAppointment, always pass the exact [service_id: ...] shown above for the chosen service. Use YYYY-MM-DD for dates and ISO 8601 for datetimes.${ctx.systemPrompt ? `\n\nOwner instructions: ${ctx.systemPrompt}` : ""}`.trim();
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
    const response = await client.chat.completions.create(
      {
        model: MODEL,
        messages: chatMessages,
        tools: TOOL_DEFINITIONS as OpenAI.Chat.ChatCompletionTool[],
        tool_choice: "auto",
        temperature: TEMPERATURE,
        // Prevent the model calling multiple tools at once — keeps flow predictable
        parallel_tool_calls: false,
      },
      { timeout: LLM_TIMEOUT_MS },
    );

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
  const fallback = await client.chat.completions.create(
    {
      model: MODEL,
      messages: [
        ...chatMessages,
        { role: "system", content: "Summarise what you know and give a SHORT plain text reply in the customer's language. No tool calls." },
      ],
      temperature: TEMPERATURE,
    },
    { timeout: LLM_TIMEOUT_MS },
  );

  return stripMarkdown(fallback.choices[0]?.message.content ?? "")
    || "Sorry, I ran into an issue. Please try again.";
};
