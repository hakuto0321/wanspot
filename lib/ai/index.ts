// AI 呼び出しの入口。アプリ・パイプラインはここからだけ使う。
//   import { generateText, generateJson } from "@/lib/ai";
// 抽出の「Claude と OpenAI の両方で照合」は後のフェーズで、この2関数の上に載せる。

import { createClaudeProvider } from "./claude";
import { createOpenAiProvider } from "./openai";
import type { AiProvider, AiProviderName, GenerateOptions } from "./types";

export { AiError } from "./types";
export type { AiProvider, AiProviderName, GenerateOptions } from "./types";

function resolveProvider(name: AiProviderName | undefined): AiProvider {
  const chosen = name ?? (process.env.AI_PROVIDER as AiProviderName | undefined) ?? "claude";
  switch (chosen) {
    case "claude":
      return createClaudeProvider();
    case "openai":
      return createOpenAiProvider();
    default:
      throw new Error(`未対応の AI_PROVIDER です: ${String(chosen)}`);
  }
}

export function generateText(prompt: string, options: GenerateOptions = {}): Promise<string> {
  const { provider, ...rest } = options;
  return resolveProvider(provider).generateText(prompt, rest);
}

export function generateJson<T = unknown>(prompt: string, options: GenerateOptions = {}): Promise<T> {
  const { provider, ...rest } = options;
  return resolveProvider(provider).generateJson<T>(prompt, rest);
}
