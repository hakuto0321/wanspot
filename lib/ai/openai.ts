import { parseJsonFromText } from "./json";
import { AiError, type AiProvider, type GenerateOptions } from "./types";

// OpenAI Chat Completions API を直接呼ぶ（追加の SDK 依存は入れない）。
const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const TIMEOUT_MS = 60_000;

type OpenAiResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export function createOpenAiProvider(): AiProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  // 既定モデルは環境変数で差し替える（モデル名は OpenAI の最新一覧を見て設定すること）
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1";

  async function request(
    prompt: string,
    options: Omit<GenerateOptions, "provider">,
    json: boolean
  ): Promise<string> {
    if (!apiKey) {
      throw new AiError("OPENAI_API_KEY が設定されていません", "openai");
    }

    const messages = [
      ...(options.system ? [{ role: "system", content: options.system }] : []),
      { role: "user", content: prompt },
    ];

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: options.maxTokens ?? 1024,
        messages,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const raw = await res.text();
    if (!res.ok) {
      throw new AiError(`OpenAI API がエラーを返しました（${res.status}）`, "openai", res.status, raw);
    }

    const data = JSON.parse(raw) as OpenAiResponse;
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new AiError("OpenAI API の応答にテキストがありません", "openai", res.status, raw);
    }
    return text;
  }

  return {
    name: "openai",
    generateText(prompt, options = {}) {
      return request(prompt, options, false);
    },
    async generateJson<T>(prompt: string, options: Omit<GenerateOptions, "provider"> = {}) {
      const system = [
        options.system,
        "出力は有効な JSON オブジェクトのみとすること。説明文は付けないこと。",
      ]
        .filter(Boolean)
        .join("\n\n");
      const text = await request(prompt, { ...options, system }, true);
      return parseJsonFromText<T>(text, "openai");
    },
  };
}
