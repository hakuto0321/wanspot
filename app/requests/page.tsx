"use client";

import Link from "next/link";
import { useState } from "react";
import { submitSpotRequest } from "@/lib/repository";
import { useSession } from "@/lib/hooks";
import { isLive } from "@/lib/supabase";

// 追加リクエスト（ログインが必要）
export default function RequestsPage() {
  const { ready, user } = useSession();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await submitSpotRequest({ name: name.trim(), note: note.trim() || null });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信できませんでした");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5">
      <h1 className="text-2xl font-bold text-brand">追加リクエスト</h1>
      <p className="text-base text-ink-sub">
        載っていないスポットを教えてください。公式情報を確認してから追加します。
      </p>

      {!ready ? (
        <p className="text-ink-sub">読み込み中…</p>
      ) : !isLive() ? (
        <p className="rounded-[var(--radius-card)] bg-ng-bg p-3 text-sm text-ng-ink">
          サーバーに接続されていないため、送信できません。
        </p>
      ) : !user ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <p>リクエストの送信にはログインが必要です。</p>
          <Link href="/login?next=/requests" className="mt-3 inline-block font-bold text-brand underline">
            ログインする
          </Link>
        </div>
      ) : done ? (
        <p role="status" className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
          受け付けました。追加まで時間がかかることがあります。
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-bold">スポット名（必須）</span>
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 rounded-[var(--radius-card)] border border-line bg-surface px-3 text-base"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold">場所や補足（任意）</span>
            <textarea
              maxLength={300}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2 text-base"
            />
          </label>
          {error ? <p role="alert" className="text-sm text-ng-ink">{error}</p> : null}
          <button
            type="submit"
            disabled={sending}
            className="min-h-12 rounded-[var(--radius-card)] bg-brand px-4 text-base font-bold text-white disabled:opacity-60"
          >
            {sending ? "送信中…" : "リクエストを送る"}
          </button>
        </form>
      )}
    </main>
  );
}
