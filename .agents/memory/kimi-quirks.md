---
name: Kimi K2.5 model quirks
description: Non-obvious behaviors when calling Moonshot/Kimi AI API
---

- Model name: `kimi-k2.5` (not `kimi-k2-0711-preview` or `kimi-k2.6` for production use)
- `temperature` must be exactly `1` — any other value returns HTTP 400 "invalid temperature"
- Small `max_tokens` (< 200) can return empty `content` with all output in `reasoning_content` — always use ≥ 500 tokens for real tasks
- Response has both `content` (final answer) and `reasoning_content` (chain-of-thought); extract from `content` only
- API base: `https://api.moonshot.ai/v1/chat/completions`

**Why:** Kimi K2.5 is a reasoning model — it spends tokens on internal reasoning first, so short token limits cut off before the answer.
