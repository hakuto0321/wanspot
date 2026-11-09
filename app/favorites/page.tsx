"use client";

import { SpotCard } from "@/components/SpotParts";
import { useFavorites } from "@/lib/hooks";

export default function FavoritesPage() {
  const { ready, items } = useFavorites();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
      <h1 className="text-2xl font-bold text-brand">お気に入り</h1>

      {!ready ? (
        <p className="text-ink-sub">読み込み中…</p>
      ) : items.length === 0 ? (
        <div className="panel p-4">
          <p>保存したスポットがここに並びます</p>
        </div>
      ) : (
        items.map((s) => <SpotCard key={s.id} spot={s} />)
      )}
    </main>
  );
}
