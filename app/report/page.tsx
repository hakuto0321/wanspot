"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/hooks";
import Icon from "@/components/Icon";
import { GENRE_LABEL, DEFAULT_ORIGIN, formatDistance, type Spot } from "@/lib/domain";
import { listSpots } from "@/lib/repository";

// 報告先を選ぶ：近くの候補から選ぶ
export default function ReportPickPage() {
  const router = useRouter();
  const { ready: sessionReady, user } = useSession();
  const [spots, setSpots] = useState<Spot[] | null>(null);

  // 報告はログインしてから
  useEffect(() => {
    if (sessionReady && !user) router.replace("/login?next=/report");
  }, [sessionReady, user, router]);

  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let active = true;
    if (!user) return;
    listSpots({ origin: DEFAULT_ORIGIN, radiusM: 50000 })
      .then((list) => active && setSpots(list))
      .catch((e: unknown) => {
        if (active) {
          setSpots([]);
          setError(e instanceof Error ? e.message : "候補を取得できませんでした");
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  const filtered = useMemo(() => {
    if (!spots) return null;
    const word = q.trim();
    return word ? spots.filter((s) => s.name.includes(word)) : spots;
  }, [spots, q]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
      <h1 className="text-2xl font-bold text-brand">報告する</h1>

      <label className="flex flex-col gap-1">
        <span className="sr-only">スポット名で探す</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="スポット名で探す"
          className="min-h-11 panel px-3 text-base"
        />
      </label>

      {error ? <p role="alert" className="text-sm text-ng-ink">{error}</p> : null}

      {filtered === null ? (
        <p className="text-ink-sub">読み込み中…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((s) => (
            <li key={s.id}>
              <Link
                href={`/report/${s.id}`}
                className="flex min-h-14 items-center justify-between gap-3 panel px-4 py-3"
              >
                <span>
                  <span className="block font-bold">{s.name}</span>
                  <span className="block text-sm text-ink-sub">
                    {s.genres.map((g) => GENRE_LABEL[g]).join("・")}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-ink-sub">{formatDistance(s.distanceM)}</span>
              </Link>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="text-ink-sub">候補が見つかりません。</li>
          ) : null}
        </ul>
      )}

      <Link href="/report/new" className="flex min-h-11 items-center gap-2 text-base text-brand underline">
        <Icon name="plus" className="h-5 w-5" />
        載っていないスポットを追加して報告
      </Link>
    </main>
  );
}
