import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const FAST_PROVIDER = "anthropic-fast";
const STANDARD_PROVIDER = "anthropic";
const ANTHROPIC_MODEL_ID = "claude-opus-4-6";
const FAST_BETA = "fast-mode-2026-02-01";
const OPENAI_SERVICE_TIER = "priority";
const FAST_STATE_ENTRY = "pi-fast-mode/state";
const OPENAI_PROVIDERS = new Set(["openai", "openai-codex"]);

type ModelRef = { provider?: string; id?: string };
type FastMode = "on" | "off" | "status";
type SessionEntry = {
  type?: string;
  customType?: string;
  data?: {
    enabled?: unknown;
  };
};

let fastEnabled = false;

function isAnthropicFastModel(model: ModelRef | undefined) {
  return model?.provider === FAST_PROVIDER && model?.id === ANTHROPIC_MODEL_ID;
}

function isAnthropicStandardModel(model: ModelRef | undefined) {
  return model?.provider === STANDARD_PROVIDER && model?.id === ANTHROPIC_MODEL_ID;
}

function isOpenAIModel(model: ModelRef | undefined) {
  return !!model?.provider && OPENAI_PROVIDERS.has(model.provider);
}

function isFastEnabled(model: ModelRef | undefined) {
  return fastEnabled || isAnthropicFastModel(model);
}

function parseMode(args: string, enabled: boolean): FastMode {
  const value = args.trim().toLowerCase();
  if (!value || value === "toggle") return enabled ? "off" : "on";
  if (value === "on" || value === "off" || value === "status") return value;
  throw new Error("Usage: /fast [on|off|status]");
}

function mergePayload(payload: unknown, extra: Record<string, unknown>) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  return {
    ...(payload as Record<string, unknown>),
    ...extra,
  };
}

function loadFastState(entries: SessionEntry[]) {
  let enabled = false;

  for (const entry of entries) {
    if (entry.type !== "custom" || entry.customType !== FAST_STATE_ENTRY) continue;
    if (typeof entry.data?.enabled === "boolean") {
      enabled = entry.data.enabled;
    }
  }

  return enabled;
}

function persistFastState(pi: ExtensionAPI, enabled: boolean) {
  pi.appendEntry(FAST_STATE_ENTRY, { enabled });
}

async function switchAnthropicModel(
  pi: ExtensionAPI,
  modelRegistry: { find(provider: string, id: string): unknown },
  enableFast: boolean,
) {
  const provider = enableFast ? FAST_PROVIDER : STANDARD_PROVIDER;
  const target = modelRegistry.find(provider, ANTHROPIC_MODEL_ID);
  if (!target) return false;
  return pi.setModel(target as any);
}

function getStatusMessage(model: ModelRef | undefined) {
  if (!isFastEnabled(model)) {
    return "Fast mode is OFF";
  }

  if (isAnthropicFastModel(model)) {
    return "Fast mode is ON: Anthropic uses anthropic-fast/claude-opus-4-6";
  }

  if (isOpenAIModel(model)) {
    return `Fast mode is ON: OpenAI uses service_tier=${OPENAI_SERVICE_TIER}`;
  }

  return "Fast mode is ON";
}

function getModelAfterToggle(model: ModelRef | undefined, enableFast: boolean): ModelRef | undefined {
  if (enableFast && isAnthropicStandardModel(model)) {
    return { provider: FAST_PROVIDER, id: ANTHROPIC_MODEL_ID };
  }

  if (!enableFast && isAnthropicFastModel(model)) {
    return { provider: STANDARD_PROVIDER, id: ANTHROPIC_MODEL_ID };
  }

  return model;
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
        id: ANTHROPIC_MODEL_ID,
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

  pi.on("session_start", async (_event, ctx) => {
    fastEnabled = loadFastState(ctx.sessionManager.getEntries() as SessionEntry[]) || isAnthropicFastModel(ctx.model);

    if (!fastEnabled || !isAnthropicStandardModel(ctx.model)) return;
    await switchAnthropicModel(pi, ctx.modelRegistry, true);
  });

  pi.on("model_select", async (event, ctx) => {
    if (!fastEnabled || !isAnthropicStandardModel(event.model)) return;
    await switchAnthropicModel(pi, ctx.modelRegistry, true);
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (isAnthropicFastModel(ctx.model)) {
      return mergePayload(event.payload, { speed: "fast" });
    }

    if (fastEnabled && isOpenAIModel(ctx.model)) {
      return mergePayload(event.payload, { service_tier: OPENAI_SERVICE_TIER });
    }
  });

  pi.registerCommand("fast", {
    description: "Toggle fast mode for Anthropic Claude Opus 4.6 and OpenAI models (/fast on|off|status)",
    handler: async (args, ctx) => {
      await ctx.waitForIdle();

      const enabled = isFastEnabled(ctx.model);
      let mode: FastMode;

      try {
        mode = parseMode(args ?? "", enabled);
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
        return;
      }

      if (mode === "status") {
        ctx.ui.notify(getStatusMessage(ctx.model), "info");
        return;
      }

      const previousFastEnabled = fastEnabled;
      fastEnabled = mode === "on";
      persistFastState(pi, fastEnabled);

      if (isAnthropicStandardModel(ctx.model) && fastEnabled) {
        const ok = await switchAnthropicModel(pi, ctx.modelRegistry, true);
        if (!ok) {
          fastEnabled = previousFastEnabled;
          persistFastState(pi, fastEnabled);
          ctx.ui.notify(`Model not available: ${FAST_PROVIDER}/${ANTHROPIC_MODEL_ID}`, "error");
          return;
        }
      }

      if (isAnthropicFastModel(ctx.model) && !fastEnabled) {
        const ok = await switchAnthropicModel(pi, ctx.modelRegistry, false);
        if (!ok) {
          fastEnabled = previousFastEnabled;
          persistFastState(pi, fastEnabled);
          ctx.ui.notify(`Model not available: ${STANDARD_PROVIDER}/${ANTHROPIC_MODEL_ID}`, "error");
          return;
        }
      }

      ctx.ui.notify(getStatusMessage(getModelAfterToggle(ctx.model, fastEnabled)), "info");
    },
  });
}
