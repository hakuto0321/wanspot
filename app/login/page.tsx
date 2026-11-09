"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { DOG_SIZES, SIZE_LABEL, type DogSize } from "@/lib/domain";
import { useDogProfile, useSession } from "@/lib/hooks";
import {
  saveDogProfile,
  sendPasswordReset,
  setNewPassword,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from "@/lib/repository";
import { getSupabase, isLive } from "@/lib/supabase";

type Mode = "signin" | "signup" | "reset" | "newpassword";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-4 text-ink-sub">読み込み中…</p>}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, user } = useSession();
  const { save: saveDevice } = useDogProfile();

  // 戻り先は、アプリ内のパスだけ許可する
  const rawNext = params.get("next") ?? "/mypage";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/mypage";

  const [mode, setMode] = useState<Mode>(params.get("mode") === "newpassword" ? "newpassword" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sizePick, setSizePick] = useState<DogSize | null>(null);
  const [breed, setBreed] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // すでにログイン済みなら戻り先へ（パスワード再設定の途中を除く）
  useEffect(() => {
    if (ready && user && mode !== "newpassword") router.replace(next);
  }, [ready, user, mode, next, router]);

  // 再設定メールのリンクから来たときは、新しいパスワードの入力に切り替える
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("newpassword");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setMessage(null);
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "うまくいきませんでした");
    } finally {
      setBusy(false);
    }
  }

  // 登録時に入れた犬の情報（任意）を、この端末と登録情報の両方に保存する
  async function saveDogInfo() {
    if (!sizePick) return;
    saveDevice({ name: "", size: sizePick, breed: breed.trim() });
    await saveDogProfile({ size: sizePick, breed: breed.trim() });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      if (mode === "signin") {
        await signInWithPassword(email.trim(), password);
        router.replace(next);
      } else if (mode === "signup") {
        const { needsConfirmation } = await signUpWithPassword(email.trim(), password, next);
        if (needsConfirmation) {
          setMessage("確認メールを送りました。メール内のリンクを開いてください。");
          return;
        }
        await saveDogInfo();
        router.replace(next);
      } else if (mode === "reset") {
        await sendPasswordReset(email.trim());
        setMessage("再設定用のメールを送りました。");
      } else {
        await setNewPassword(password);
        router.replace(next);
      }
    });
  }

  if (!isLive()) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-bold">ログイン</h1>
        <p className="panel p-4 text-sm">サーバーに接続されていないため、ログインできません。</p>
      </main>
    );
  }

  const title =
    mode === "newpassword"
      ? "新しいパスワード"
      : mode === "reset"
        ? "パスワードの再設定"
        : mode === "signup"
          ? "新規登録"
          : "ログイン";

  const submitLabel =
    mode === "signin"
      ? "ログイン"
      : mode === "signup"
        ? "登録する"
        : mode === "reset"
          ? "再設定メールを送る"
          : "パスワードを変える";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>

      {mode === "signin" || mode === "signup" ? (
        <>
          <div role="group" aria-label="ログインの方法" className="grid grid-cols-2 overflow-hidden rounded-lg border border-line text-sm font-bold">
            <button
              type="button"
              aria-pressed={mode === "signin"}
              onClick={() => switchMode("signin")}
              className={`min-h-11 ${mode === "signin" ? "bg-brand text-white" : "bg-surface text-ink"}`}
            >
              ログイン
            </button>
            <button
              type="button"
              aria-pressed={mode === "signup"}
              onClick={() => switchMode("signup")}
              className={`min-h-11 border-l border-line ${mode === "signup" ? "bg-brand text-white" : "bg-surface text-ink"}`}
            >
              新規登録
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => signInWithGoogle(next))}
            className="btn btn-secondary w-full"
          >
            Google で続ける
          </button>

          <p className="text-center text-sm text-ink-sub">または</p>
        </>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode !== "newpassword" ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">メールアドレス</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        ) : null}

        {mode === "signin" || mode === "signup" || mode === "newpassword" ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">{mode === "newpassword" ? "新しいパスワード" : "パスワード"}</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode !== "signin" ? <span className="text-xs text-ink-sub">8文字以上</span> : null}
          </label>
        ) : null}

        {mode === "signup" ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-bold">うちの子（任意）</legend>
            <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-line">
              {DOG_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={sizePick === size}
                  onClick={() => setSizePick(sizePick === size ? null : size)}
                  className={`min-h-11 border-l border-line text-base font-bold first:border-l-0 ${
                    sizePick === size ? "bg-brand text-white" : "bg-surface text-ink"
                  }`}
                >
                  {SIZE_LABEL[size]}
                </button>
              ))}
            </div>
            <input value={breed} onChange={(e) => setBreed(e.target.value)} maxLength={30} placeholder="犬種（任意）" />
          </fieldset>
        ) : null}

        {error ? <p role="alert" className="text-sm text-ink">{error}</p> : null}
        {message ? <p role="status" className="panel p-4 text-sm">{message}</p> : null}

        <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-60">
          {submitLabel}
        </button>
      </form>

      {mode === "signin" ? (
        <button type="button" onClick={() => switchMode("reset")} className="w-fit text-sm text-ink-sub underline">
          パスワードを忘れた
        </button>
      ) : null}
      {mode === "reset" ? (
        <button type="button" onClick={() => switchMode("signin")} className="w-fit text-sm text-ink-sub underline">
          ログインに戻る
        </button>
      ) : null}

      <Link href="/" className="text-sm text-ink-sub underline">
        ログインせずに探す
      </Link>
    </main>
  );
}
