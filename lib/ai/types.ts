// AIプロバイダの共通インターフェース。
// 直接 SDK や fetch をアプリ各所に散らさず、必ず lib/ai/index.ts 経由で呼ぶ（CLAUDE.md）。

export type AiProviderName = "claude" | "openai";

export type GenerateOptions = {
  /** 省略時は環境変数 AI_PROVIDER、それも無ければ "claude" */
  provider?: AiProviderName;
  /** システムプロンプト */
  system?: string;
  /** 出力上限トークン数 */
  maxTokens?: number;
};

export interface AiProvider {
  readonly name: AiProviderName;
  /** テキストを生成する */
  generateText(prompt: string, options?: Omit<GenerateOptions, "provider">): Promise<string>;
  /** JSON を生成して解析する。解析に失敗したら AiError を投げる */
  generateJson<T = unknown>(prompt: string, options?: Omit<GenerateOptions, "provider">): Promise<T>;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly provider: AiProviderName,
    readonly status?: number,
    readonly raw?: string
  ) {
    super(message);
    this.name = "AiError";
  }
}
