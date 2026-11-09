"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { sendLoginLink } from "@/lib/repository";
import { useSession } from "@/lib/hooks";
import { isLive } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-4 text-ink-sub">読み込み中…</p>}>
      <Login />
    </Suspense>
  );
}

// ログイン：メールに届くリンクで入る（パスワードなし）。初めて報告を送るときだけ求める。
function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, user } = useSession();
  const rawNext = params.get("next") ?? "/mypage";
  // 外部サイトへ飛ばさないよう、アプリ内のパスだけ許可する
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/mypage";

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, next, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await sendLoginLink(email.trim(), next);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信できませんでした");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
      <h1 className="text-2xl font-bold text-brand">ログイン</h1>
      <p className="text-base text-ink-sub">
        メールアドレスに届くリンクからログインします。パスワードは不要です。
      </p>

      {!isLive() ? (
        <p className="rounded-[var(--radius-card)] bg-ng-bg p-3 text-sm text-ng-ink">
          サーバーに接続されていないため、ログインできません。
        </p>
      ) : sent ? (
        <p role="status" className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
          {email} にログイン用のリンクを送りました。メールを開いてリンクをタップしてください。
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-bold">メールアドレス</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 rounded-[var(--radius-card)] border border-line bg-surface px-3 text-base"
            />
          </label>
          {error ? <p role="alert" className="text-sm text-ng-ink">{error}</p> : null}
          <button
            type="submit"
            disabled={sending}
            className="min-h-12 rounded-[var(--radius-card)] bg-brand px-4 text-base font-bold text-white disabled:opacity-60"
          >
            {sending ? "送信中…" : "ログイン用リンクを送る"}
          </button>
        </form>
      )}

      <Link href={next} className="text-sm text-ink-sub underline">
        ログインせずに戻る
      </Link>
    </main>
  );
}
