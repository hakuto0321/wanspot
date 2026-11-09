"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import SpotMap from "@/components/SpotMap";
import { SizeChips, SpotCard } from "@/components/SpotParts";
import {
  AREA_LABEL,
  DEFAULT_ORIGIN,
  GENRE_LABEL,
  GENRES,
  STAY_AREAS,
  SIZE_LABEL,
  isDogSize,
  type DogSize,
  type Genre,
  type Spot,
  type StayArea,
} from "@/lib/domain";
import { listSpots } from "@/lib/repository";
import { isLive } from "@/lib/supabase";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-4 text-ink-sub">読み込み中…</p>}>
      <HomeView />
    </Suspense>
  );
}

// 最初に見せるのはスポット一覧。サイズは各スポットの情報として出し、
// サイズでの絞り込みは補助の機能として折りたたんで置く。
function HomeView() {
  const router = useRouter();
  const params = useSearchParams();

  const sizeParam = params.get("size");
  const size: DogSize | null = isDogSize(sizeParam) ? sizeParam : null;
  const genreParam = params.get("genre");
  const genre = (GENRES as readonly string[]).includes(genreParam ?? "") ? (genreParam as Genre) : undefined;
  const areaParam = params.get("area");
  const area = (STAY_AREAS as readonly string[]).includes(areaParam ?? "") ? (areaParam as StayArea) : undefined;

  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const view = params.get("view") === "map" ? "map" : "list";
  const selectedSpot = spots?.find((s) => s.id === selectedId) ?? null;

  // 現在地が許可されていれば近い順の基準に使う（拒否・未対応なら東京駅付近）
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "現在地" });
      },
      () => {},
      { timeout: 6000, maximumAge: 10 * 60 * 1000 }
    );
  }, []);

  useEffect(() => {
    let active = true;
    listSpots({ origin, size: size ?? undefined, genre, area })
      .then((list) => {
        if (active) {
          setError(null);
          setSpots(list);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setSpots([]);
          setError(e instanceof Error ? e.message : "スポットを取得できませんでした");
        }
      });
    return () => {
      active = false;
    };
  }, [origin, size, genre, area]);

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `/?${qs}` : "/");
  }

  const accordionCount = [size, area].filter(Boolean).length;
  const conditions = [
    genre ? GENRE_LABEL[genre] : null,
    area ? AREA_LABEL[area] : null,
    size ? `${SIZE_LABEL[size]}で入れる` : null,
  ].filter(Boolean);

  return (
    <>
      {/* ファーストビュー：スポットの探し方（エリア・ジャンル・過ごし方） */}
      <section aria-labelledby="top-heading" className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <h1 id="top-heading" className="text-xl font-bold md:text-2xl">
            犬連れで行けるスポット
          </h1>
          {!isLive() ? (
            <p className="mt-4 border-l-4 border-unverified bg-canvas px-4 py-2 text-sm">
              サンプルデータを表示しています（サーバー未接続）。実際の店舗の情報ではありません。
            </p>
          ) : null}

          {/* ジャンルはひと目で選べるよう外に出す（横にスクロールできるボタン列） */}
          <div className="mt-5 -mx-4 overflow-x-auto px-4">
            <div role="group" aria-label="ジャンル" className="flex w-max gap-2">
              {[{ key: null as Genre | null, label: "すべて" }, ...GENRES.map((g) => ({ key: g as Genre | null, label: GENRE_LABEL[g] }))].map((o) => {
                const active = (genre ?? null) === o.key;
                return (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateParam("genre", o.key)}
                    className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold ${
                      active ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:bg-canvas"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* サイズと過ごし方はアコーディオンに入れ、通常は閉じておく */}
          <details className="group mt-3 border border-line bg-canvas">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4">
              <span className="font-bold">サイズ・過ごし方で絞る</span>
              <span className="flex items-center gap-3 text-sm text-ink-sub">
                {accordionCount > 0 ? <span>{accordionCount}件指定中</span> : null}
                <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-180">▾</span>
              </span>
            </summary>

            <div className="flex flex-col gap-5 border-t border-line bg-surface px-4 py-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold">うちの子のサイズ</span>
                <SizeChips value={size} onChange={(v) => updateParam("size", v)} />
              </div>

              <div className="grid gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-bold">過ごし方</span>
                  <select value={area ?? ""} onChange={(e) => updateParam("area", e.target.value)}>
                    <option value="">指定しない</option>
                    {STAY_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {AREA_LABEL[a]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {conditions.length > 0 ? (
                <button
                  type="button"
                  onClick={() => router.replace("/")}
                  className="w-fit text-sm font-bold text-brand underline underline-offset-4"
                >
                  条件をすべて外す
                </button>
              ) : null}
            </div>
          </details>
        </div>
      </section>

      {/* 結果：一覧モード（一覧と地図を並べる）／地図モード（地図を大きく出して選ぶ） */}
      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-6 md:grid-cols-[1fr_340px] md:px-4 md:py-6">
        {view === "map" ? (
          <section aria-label="地図から探す" className="order-1 flex min-w-0 flex-col gap-4 md:col-span-2">
            <div className="px-4 md:px-0">
              <SpotMap
                variant="large"
                center={{ lat: origin.lat, lng: origin.lng }}
                spots={spots ?? []}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
              />
            </div>
            <div className="px-4 md:px-0">
              {selectedSpot ? (
                <div className="bg-surface md:border md:border-line">
                  <SpotCard spot={selectedSpot} />
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="results-heading" className={`${view === "map" ? "order-2 md:col-span-2" : "order-1"} flex min-w-0 flex-col`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-brand bg-surface px-4 py-3 md:px-0 md:bg-transparent">
            <h2 id="results-heading" className="text-base font-bold">
              <span className="tabular-nums">{spots ? spots.length : ""}</span>件
              <span className="ml-2 text-sm font-normal text-ink-sub">近い順</span>
            </h2>
            <div role="group" aria-label="表示の切り替え" className="grid grid-cols-2 overflow-hidden rounded-lg border border-line text-sm font-bold">
              {[
                { key: "list", label: "一覧" },
                { key: "map", label: "地図" },
              ].map((o) => (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={view === o.key}
                  onClick={() => updateParam("view", o.key === "map" ? "map" : null)}
                  className={`min-h-9 px-4 ${view === o.key ? "bg-brand text-white" : "bg-surface text-ink hover:bg-canvas"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <p role="alert" className="border-l-4 border-ng-ink bg-ng-bg px-4 py-3 text-sm text-ng-ink">
              {error}
            </p>
          ) : null}

          {spots === null ? (
            <p className="px-4 py-6 text-ink-sub">読み込み中…</p>
          ) : spots.length === 0 ? (
            <div className="bg-surface px-4 py-6 md:border md:border-line">
              <p className="font-bold">見つかりませんでした</p>
              <p className="mt-2 text-sm">
                <Link href="/requests" className="font-bold text-brand underline">
                  載っていないスポットを追加
                </Link>
              </p>
            </div>
          ) : (
            <div className="bg-surface md:border md:border-line">
              {spots.map((s) => (
                <SpotCard key={s.id} spot={s} />
              ))}
            </div>
          )}


          <div className="mt-6 flex flex-col gap-2 border-t border-line bg-surface px-4 py-4 md:border md:px-5">
            <p className="font-bold">載っていないスポット</p>
            <Link href="/requests" className="btn btn-secondary w-fit">
              追加リクエスト
            </Link>
          </div>
        </section>

        {view === "list" ? (
          <aside aria-label="地図" className="order-2 flex flex-col gap-3 px-4 pb-4 pt-4 md:order-2 md:px-0 md:pt-0">
            <div className="md:sticky md:top-6">
              <SpotMap center={{ lat: origin.lat, lng: origin.lng }} spots={spots ?? []} />
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}
