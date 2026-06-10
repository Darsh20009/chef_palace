/**
 * QIROX Hybrid AI Engine
 * Primary: Kimi K2.5 (Moonshot) — deep analysis, Arabic excellence
 * Fallback: Gemini 2.5 Flash (Google) — creative tasks, fast responses
 *
 * Strategy:
 *  - chat / analysis / insights → Kimi K2.5 (primary)
 *  - creative / fast tasks      → Kimi K2.5 first, Gemini fallback
 *  - Automatic fallback if primary fails or rate-limited
 */

export type AIRole = "kimi" | "gemini" | "auto";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: "kimi" | "gemini";
}

// Gemini model cascade — try each in order until one works
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash-lite",
];

// ── Kimi (Moonshot) ──────────────────────────────────────────────────────────
async function callKimi(messages: AIMessage[], maxTokens = 4000, temperature = 0.9): Promise<string> {
  const key = process.env.KIMI_API_KEY;
  if (!key) throw new Error("KIMI_API_KEY not set");

  const response = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "kimi-k2.5",
      messages,
      max_tokens: maxTokens,
      temperature: 1, // Kimi K2.5 only supports temperature=1
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Kimi error ${response.status}: ${err.slice(0, 300)}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ── Gemini (Google) — tries model cascade ────────────────────────────────────
async function callGemini(messages: AIMessage[], maxTokens = 4000, temperature = 1.0): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const systemMsg = messages.find(m => m.role === "system");
  const conversationMsgs = messages.filter(m => m.role !== "system");

  const contents = conversationMsgs.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: any = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens, temperature },
  };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  let lastError = "";
  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );

      if (response.status === 429) {
        // Rate limited on this model, try next
        lastError = `${model}: quota exceeded`;
        continue;
      }

      if (!response.ok) {
        const err = await response.text();
        lastError = `${model}: ${response.status} ${err.slice(0, 150)}`;
        continue;
      }

      const data = await response.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      if (text) return text;
    } catch (e: any) {
      lastError = `${model}: ${e.message}`;
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}

// ── Hybrid call with fallback ─────────────────────────────────────────────────
export async function callAI(
  messages: AIMessage[],
  options: {
    prefer?: AIRole;
    maxTokens?: number;
    temperature?: number;
    taskType?: "chat" | "creative" | "analysis" | "fast";
  } = {}
): Promise<AIResponse> {
  const { maxTokens = 4000, taskType = "chat" } = options;

  // Decide preferred provider based on task
  let prefer = options.prefer;
  if (!prefer || prefer === "auto") {
    // Kimi for everything (best Arabic quality) — Gemini only as fallback
    prefer = "kimi";
  }

  const temp = options.temperature ?? (taskType === "creative" ? 1.0 : 0.9);

  if (prefer === "kimi") {
    try {
      const content = await callKimi(messages, maxTokens, temp);
      return { content, model: "kimi-k2.5", provider: "kimi" };
    } catch (kimiErr) {
      console.warn("[AI] Kimi failed, falling back to Gemini:", (kimiErr as Error).message.slice(0, 100));
      try {
        const content = await callGemini(messages, maxTokens, temp);
        return { content, model: "gemini-2.5-flash", provider: "gemini" };
      } catch (geminiErr) {
        throw new Error(`Both AI providers failed. Kimi: ${(kimiErr as Error).message.slice(0, 100)}. Gemini: ${(geminiErr as Error).message.slice(0, 100)}`);
      }
    }
  } else {
    try {
      const content = await callGemini(messages, maxTokens, temp);
      return { content, model: "gemini-2.5-flash", provider: "gemini" };
    } catch (geminiErr) {
      console.warn("[AI] Gemini failed, falling back to Kimi:", (geminiErr as Error).message.slice(0, 100));
      try {
        const content = await callKimi(messages, maxTokens, temp);
        return { content, model: "kimi-k2.5", provider: "kimi" };
      } catch (kimiErr) {
        throw new Error(`Both AI providers failed. Gemini: ${(geminiErr as Error).message.slice(0, 100)}. Kimi: ${(kimiErr as Error).message.slice(0, 100)}`);
      }
    }
  }
}

export function isAIConfigured(): { kimi: boolean; gemini: boolean; any: boolean } {
  const kimi = !!process.env.KIMI_API_KEY;
  const gemini = !!process.env.GEMINI_API_KEY;
  return { kimi, gemini, any: kimi || gemini };
}
