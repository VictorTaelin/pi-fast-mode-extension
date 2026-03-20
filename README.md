# pi fast mode extension

Adds a `/fast` command to pi for:

- Anthropic Claude Opus 4.6
- OpenAI models on the `openai` provider
- OpenAI Codex models on the `openai-codex` provider

## What it does

- registers `anthropic-fast/claude-opus-4-6`
- adds the header `anthropic-beta: fast-mode-2026-02-01`
- injects `speed: "fast"` into Anthropic fast requests
- injects `service_tier: "priority"` into OpenAI and OpenAI Codex requests when `/fast` is on
- `/fast on` enables fast mode globally for the current session
- `/fast off` disables fast mode globally for the current session
- `/fast status` shows current status
- if fast mode is on and you select `anthropic/claude-opus-4-6`, it auto-switches to `anthropic-fast/claude-opus-4-6`
- fast mode state is persisted in the session via a custom entry

## Install locally

Add the extension directory to `~/.pi/agent/settings.json`:

```json
{
  "extensions": [
    "/Users/v/t/work/pi-fast-mode-extension"
  ]
}
```

Then run `/reload` inside pi.

## Commands

- `/fast`
- `/fast on`
- `/fast off`
- `/fast status`

## Notes

- Anthropic fast mode targets `anthropic/claude-opus-4-6` only.
- OpenAI fast mode targets the built-in `openai` and `openai-codex` providers by adding `service_tier: "priority"`.
- It reads the Anthropic API key from `~/.config/anthropic.token`.
- It assumes your Anthropic/OpenAI accounts already have access to the relevant fast/priority tier behavior.
- Pricing/rate limits are whatever the upstream providers apply.
