import { AiError, type AiProviderName } from "./types";

// モデルの出力から JSON を取り出す。
// コードフェンス（```json ... ```）や前後の説明文が付いていても、最初の JSON 値を拾う。
export function parseJsonFromText<T>(text: string, provider: AiProviderName): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // 前後に説明文がある場合：最初の { か [ から、対応する末尾までを切り出す
    const start = candidate.search(/[{[]/);
    if (start !== -1) {
      const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
      if (end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1)) as T;
        } catch {
          // 下で AiError にする
        }
      }
    }
    throw new AiError("AI の出力を JSON として解析できませんでした", provider, undefined, text);
  }
}
