"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { GENRE_LABEL, DEFAULT_ORIGIN, formatDistance, type Spot } from "@/lib/domain";
import { listSpots } from "@/lib/repository";

// 報告先を選ぶ：近くの候補から選ぶ
export default function ReportPickPage() {
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let active = true;
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
  }, []);

  const filtered = useMemo(() => {
    if (!spots) return null;
    const word = q.trim();
    return word ? spots.filter((s) => s.name.includes(word)) : spots;
  }, [spots, q]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5">
      <h1 className="text-2xl font-bold text-brand">報告する</h1>
      <p className="text-sm text-ink-sub">行ってきたスポットを選んでください。</p>

      <label className="flex flex-col gap-1">
        <span className="sr-only">スポット名で探す</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="スポット名で探す"
          className="min-h-11 rounded-[var(--radius-card)] border border-line bg-surface px-3 text-base"
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
                className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3"
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

      <Link href="/requests" className="flex min-h-11 items-center gap-2 text-base text-brand underline">
        <Icon name="plus" className="h-5 w-5" />
        候補にないスポットを追加リクエスト
      </Link>
    </main>
  );
}
