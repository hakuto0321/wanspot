"use client";

import { SpotCard } from "@/components/SpotParts";
import { useFavorites } from "@/lib/hooks";

export default function FavoritesPage() {
  const { ready, items } = useFavorites();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5">
      <h1 className="text-2xl font-bold text-brand">お気に入り</h1>
      <p className="text-sm text-ink-sub">
        オフラインでも見られます。表示される確認状況は、保存したときのものです。詳細で最新の情報を確認してください。
      </p>

      {!ready ? (
        <p className="text-ink-sub">読み込み中…</p>
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <p>お気に入りはまだありません。</p>
          <p className="mt-2 text-sm text-ink-sub">スポットの詳細で「保存」を押すと、ここに並びます。</p>
        </div>
      ) : (
        items.map((s) => <SpotCard key={s.id} spot={s} />)
      )}
    </main>
  );
}
