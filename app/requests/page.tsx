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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-5">
      <h1 className="text-2xl font-bold text-ink">追加リクエスト</h1>

      {!ready ? (
        <p className="text-ink-sub">読み込み中…</p>
      ) : !isLive() ? (
        <p className="rounded-[var(--radius-card)] bg-surface p-3 text-sm text-ink">
          サーバーに接続されていないため、送信できません。
        </p>
      ) : !user ? (
        <div className="panel p-4">
          <Link href="/login?next=/requests" className="btn btn-primary w-full">
            ログインして送る
          </Link>
        </div>
      ) : done ? (
        <p role="status" className="panel p-4">
          送信しました
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
              className="min-h-11 panel px-3 text-base"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold">場所や補足（任意）</span>
            <textarea
              maxLength={300}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="panel px-3 py-2 text-base"
            />
          </label>
          {error ? <p role="alert" className="text-sm text-ink">{error}</p> : null}
          <button
            type="submit"
            disabled={sending}
            className="btn btn-primary w-full disabled:opacity-60"
          >
            {sending ? "送信中…" : "リクエストを送る"}
          </button>
        </form>
      )}
    </main>
  );
}
