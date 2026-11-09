import { parseJsonFromText } from "./json";
import { AiError, type AiProvider, type GenerateOptions } from "./types";

// Anthropic Messages API を直接呼ぶ（追加の SDK 依存は入れない）。
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const TIMEOUT_MS = 60_000;

type ClaudeResponse = {
  content?: Array<{ type: string; text?: string }>;
};

export function createClaudeProvider(): AiProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

  async function generateText(
    prompt: string,
    options: Omit<GenerateOptions, "provider"> = {}
  ): Promise<string> {
    if (!apiKey) {
      throw new AiError("ANTHROPIC_API_KEY が設定されていません", "claude");
    }

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 1024,
        ...(options.system ? { system: options.system } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const raw = await res.text();
    if (!res.ok) {
      throw new AiError(`Claude API がエラーを返しました（${res.status}）`, "claude", res.status, raw);
    }

    const data = JSON.parse(raw) as ClaudeResponse;
    const text = (data.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");
    if (!text) {
      throw new AiError("Claude API の応答にテキストがありません", "claude", res.status, raw);
    }
    return text;
  }

  return {
    name: "claude",
    generateText,
    async generateJson<T>(prompt: string, options: Omit<GenerateOptions, "provider"> = {}) {
      const system = [
        options.system,
        "出力は有効な JSON のみとし、説明文は付けないこと。",
      ]
        .filter(Boolean)
        .join("\n\n");
      const text = await generateText(prompt, { ...options, system });
      return parseJsonFromText<T>(text, "claude");
    },
  };
}
