"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DogSizeForm from "@/components/DogSizeForm";
import Icon from "@/components/Icon";
import {
  MODERATION_LABEL,
  RESULT_LABEL,
  SIZE_LABEL,
  formatDate,
} from "@/lib/domain";
import { useDogProfile, useFavorites, useSession } from "@/lib/hooks";
import { listMyReports, signOut, type MyReport } from "@/lib/repository";

export default function MyPage() {
  const router = useRouter();
  const { ready: profileReady, profile, save } = useDogProfile();
  const { items: favorites } = useFavorites();
  const { ready: sessionReady, user } = useSession();
  const [editing, setEditing] = useState(false);
  const [reports, setReports] = useState<MyReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionReady || !user) return;
    let active = true;
    listMyReports()
      .then((list) => active && setReports(list))
      .catch((e: unknown) => {
        if (active) {
          setReports([]);
          setError(e instanceof Error ? e.message : "投稿履歴を取得できませんでした");
        }
      });
    return () => {
      active = false;
    };
  }, [sessionReady, user]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-5">
      <h1 className="text-2xl font-bold text-ink">マイページ</h1>

      {/* うちの子 */}
      <section aria-labelledby="dog-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="dog-heading" className="text-lg font-bold">うちの子</h2>
          {profile && !editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex min-h-11 items-center gap-1 px-2 text-base text-ink"
            >
              <Icon name="pencil" className="h-5 w-5" />
              変更
            </button>
          ) : null}
        </div>
        {!profileReady ? (
          <p className="text-ink-sub">読み込み中…</p>
        ) : !profile ? (
          <div className="flex flex-col gap-3">
            <DogSizeForm
              initial={null}
              submitLabel="登録する"
              onSubmit={(p) => save(p)}
            />
          </div>
        ) : editing ? (
          <DogSizeForm
            initial={profile}
            submitLabel="保存する"
            onSubmit={(p) => {
              save(p);
              setEditing(false);
            }}
          />
        ) : (
          <div className="panel p-4">
            <p className="text-base font-bold">{profile.name || "（名前なし）"}</p>
            <p className="text-base">
              {SIZE_LABEL[profile.size]}
              {profile.breed ? `・${profile.breed}` : ""}
            </p>
          </div>
        )}
      </section>

      {/* お気に入り */}
      <section aria-labelledby="fav-heading" className="flex flex-col gap-2">
        <h2 id="fav-heading" className="text-lg font-bold">お気に入り</h2>
        <Link href="/favorites" className="panel p-4 text-base">
          {favorites.length}件のスポット
        </Link>
      </section>

      {/* アカウントと投稿履歴 */}
      <section aria-labelledby="account-heading" className="flex flex-col gap-3">
        <h2 id="account-heading" className="text-lg font-bold">報告の履歴</h2>
        {!sessionReady ? (
          <p className="text-ink-sub">読み込み中…</p>
        ) : !user ? (
          <div className="panel p-4">
            <Link href="/login?next=/mypage" className="btn btn-primary w-full">
              ログイン
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm text-ink-sub">{user.email}</p>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.replace("/");
                }}
                className="min-h-11 shrink-0 px-2 text-base text-ink-sub underline"
              >
                ログアウト
              </button>
            </div>
            {error ? <p role="alert" className="text-sm text-ink">{error}</p> : null}
            {reports === null ? (
              <p className="text-ink-sub">読み込み中…</p>
            ) : reports.length === 0 ? (
              <p className="text-ink-sub">まだ報告はありません。</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {reports.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/spots/${r.spotId}`}
                      className="block panel p-4"
                    >
                      <span className="block font-bold">{r.spotName}</span>
                      <span className="block text-sm">
                        {RESULT_LABEL[r.result]}{r.dogSize ? `・${SIZE_LABEL[r.dogSize]}` : ""}・{formatDate(r.visitedOn)}
                      </span>
                      <span className="block text-sm text-ink-sub">
                        反映状況：{MODERATION_LABEL[r.moderation]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}
