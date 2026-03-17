import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const FAST_PROVIDER = "anthropic-fast";
const STANDARD_PROVIDER = "anthropic";
const MODEL_ID = "claude-opus-4-6";
const FAST_BETA = "fast-mode-2026-02-01";

function isFastModel(model: { provider?: string; id?: string } | undefined) {
  return model?.provider === FAST_PROVIDER && model?.id === MODEL_ID;
}

function parseMode(args: string, fastEnabled: boolean): "on" | "off" | "status" {
  const value = args.trim().toLowerCase();
  if (!value || value === "toggle") return fastEnabled ? "off" : "on";
  if (value === "on" || value === "off" || value === "status") return value;
  throw new Error("Usage: /fast [on|off|status]");
}

export default function fastModeExtension(pi: ExtensionAPI) {
  pi.registerProvider(FAST_PROVIDER, {
    baseUrl: "https://api.anthropic.com",
    apiKey: "!tr -d '\n' < ~/.config/anthropic.token",
    api: "anthropic-messages",
    headers: {
      "anthropic-beta": `${FAST_BETA},fine-grained-tool-streaming-2025-05-14`,
    },
    models: [
      {
        id: MODEL_ID,
        name: "Claude Opus 4.6 (Fast)",
        reasoning: true,
        input: ["text", "image"],
        cost: {
          input: 30,
          output: 150,
          cacheRead: 30,
          cacheWrite: 30,
        },
        contextWindow: 1_000_000,
        maxTokens: 131_072,
      },
    ],
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (!isFastModel(ctx.model)) return;
    return {
      ...event.payload,
      speed: "fast",
    };
  });

  pi.registerCommand("fast", {
    description: "Toggle Anthropic fast mode for Claude Opus 4.6 (/fast on|off|status)",
    handler: async (args, ctx) => {
      await ctx.waitForIdle();

      const fastEnabled = isFastModel(ctx.model);
      let mode: "on" | "off" | "status";

      try {
        mode = parseMode(args ?? "", fastEnabled);
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
        return;
      }

      if (mode === "status") {
        ctx.ui.notify(fastEnabled ? "Fast mode is ON" : "Fast mode is OFF", "info");
        return;
      }

      const provider = mode === "on" ? FAST_PROVIDER : STANDARD_PROVIDER;
      const target = ctx.modelRegistry.find(provider, MODEL_ID);
      if (!target) {
        ctx.ui.notify(`Model not found: ${provider}/${MODEL_ID}`, "error");
        return;
      }

      const ok = await pi.setModel(target);
      if (!ok) {
        ctx.ui.notify(`No API key available for ${provider}/${MODEL_ID}`, "error");
        return;
      }

      ctx.ui.notify(
        mode === "on"
          ? "Fast mode ON: anthropic-fast/claude-opus-4-6"
          : "Fast mode OFF: anthropic/claude-opus-4-6",
        "info",
      );
    },
  });
}
