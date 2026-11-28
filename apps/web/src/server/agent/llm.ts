import "server-only";
import OpenAI, { toFile } from "openai";
import { env } from "@/lib/env";

type LlmConfig = { client: OpenAI; chatModel: string; transcriptionModel: string };

let config: LlmConfig | undefined;

// Lazy so a missing key fails the first AI call (and startup validation), not every import.
export const getLlm = (): LlmConfig => {
  if (config) return config;
  const groqKey = env.llm.GROQ_API_KEY;
  config = groqKey
    ? {
        client: new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1" }),
        chatModel: env.llm.GROQ_MODEL ?? "openai/gpt-oss-120b",
        transcriptionModel: env.llm.GROQ_TRANSCRIPTION_MODEL ?? "whisper-large-v3-turbo",
      }
    : {
        client: new OpenAI({ apiKey: env.llm.OPENAI_API_KEY }),
        chatModel: "gpt-4o-mini",
        transcriptionModel: "whisper-1",
      };
  return config;
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "audio/wav": "wav",
};

export const transcribeAudio = async (bytes: ArrayBuffer, mimeType: string): Promise<string> => {
  const { client, transcriptionModel } = getLlm();
  const baseMime = mimeType.split(";")[0]?.trim() ?? "audio/ogg";
  const file = await toFile(Buffer.from(bytes), `voice.${EXTENSION_BY_MIME[baseMime] ?? "ogg"}`, { type: baseMime });
  const result = await client.audio.transcriptions.create(
    { file, model: transcriptionModel },
    { timeout: 20_000 },
  );
  return result.text.trim();
};
