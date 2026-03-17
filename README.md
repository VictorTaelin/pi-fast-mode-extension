# pi fast mode extension

Adds a `/fast` command to pi for Anthropic Claude Opus 4.6.

## What it does

- registers `anthropic-fast/claude-opus-4-6`
- adds the header `anthropic-beta: fast-mode-2026-02-01`
- injects `speed: "fast"` into Anthropic requests
- `/fast on` switches to the fast provider
- `/fast off` switches back to standard Anthropic
- `/fast status` shows current status

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

- This targets `anthropic/claude-opus-4-6` only.
- It reads the API key from `~/.config/anthropic.token`.
- It assumes your Anthropic account already has fast mode access.
- Pricing/rate limits are Anthropic's fast-mode ones.
