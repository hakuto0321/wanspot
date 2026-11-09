"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Icon from "@/components/Icon";
import {
  AREA_LABEL,
  GENRE_LABEL,
  GENRES,
  STAY_AREAS,
  type Genre,
  type StayArea,
} from "@/lib/domain";

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="p-4 text-ink-sub">読み込み中…</p>}>
      <SearchForm />
    </Suspense>
  );
}

// 検索・絞り込み。専用の結果画面は作らず、条件はホームの地図と一覧に反映する。
function SearchForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [genre, setGenre] = useState<string>(params.get("genre") ?? "");
  const [area, setArea] = useState<string>(params.get("area") ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    const size = params.get("size");
    if (size) next.set("size", size);
    if (genre && (GENRES as readonly string[]).includes(genre)) next.set("genre", genre as Genre);
    if (area && (STAY_AREAS as readonly string[]).includes(area)) next.set("area", area as StayArea);
    const qs = next.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-5">
      <header className="flex items-center gap-2">
        <Link href="/" aria-label="戻る" className="flex h-11 w-11 items-center justify-center">
          <Icon name="chevron-left" className="h-6 w-6" />
        </Link>
        <h1 className="text-xl font-bold">絞り込み</h1>
      </header>

      <form onSubmit={apply} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1">
          <span className="font-bold">ジャンル</span>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="min-h-11 panel px-3 text-base"
          >
            <option value="">指定しない</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {GENRE_LABEL[g]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-bold">過ごし方</span>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="min-h-11 panel px-3 text-base"
          >
            <option value="">指定しない</option>
            {STAY_AREAS.map((a) => (
              <option key={a} value={a}>
                {AREA_LABEL[a]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="btn btn-primary w-full"
        >
          この条件で探す
        </button>
      </form>
    </main>
  );
}
