---
name: Hybrid AI engine
description: Architecture of the dual-model AI system in server/ai-engine.ts
---

- File: `server/ai-engine.ts` — exports `callAI()`, `isAIConfigured()`
- Primary provider: Kimi K2.5 for ALL task types (best Arabic quality)
- Fallback: Gemini cascade — tries `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-2.5-pro` → `gemini-2.0-flash-lite` in order
- Gemini free tier quota exhausts often (429) — cascade handles this automatically
- `callAI(messages, {taskType, maxTokens})` returns `{content, model, provider}`
- Imported in `server/routes.ts` at top: `import { callAI, isAIConfigured } from "./ai-engine"`
- All AI routes updated to use `callAI()` — no more direct fetch to Moonshot API in routes.ts

**Why:** Kimi K2.5 does not support temperature ≠ 1 and has better Arabic reasoning; Gemini is a quota-limited fallback when Kimi fails.
