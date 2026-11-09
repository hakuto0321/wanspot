"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import SpotMap from "@/components/SpotMap";
import { SizeChips, SpotCard, ConfirmNotice } from "@/components/SpotParts";
import Icon from "@/components/Icon";
import {
  AREA_LABEL,
  DEFAULT_ORIGIN,
  GENRE_LABEL,
  SIZE_LABEL,
  isDogSize,
  type DogSize,
  type Spot,
  type StayArea,
  type Genre,
  STAY_AREAS,
  GENRES,
} from "@/lib/domain";
import { useDogProfile } from "@/lib/hooks";
import { listSpots } from "@/lib/repository";
import { isLive } from "@/lib/supabase";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-4 text-ink-sub">読み込み中…</p>}>
      <HomeView />
    </Suspense>
  );
}

function HomeView() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, profile } = useDogProfile();

  // 初回起動はうちの子設定へ
  useEffect(() => {
    if (ready && !profile) router.replace("/onboarding");
  }, [ready, profile, router]);

  // サイズ：URL の指定を優先し、無ければうちの子のサイズ。"all" で解除。
  const sizeParam = params.get("size");
  const size: DogSize | null =
    sizeParam === "all" ? null : isDogSize(sizeParam) ? sizeParam : (profile?.size ?? null);
  const genreParam = params.get("genre");
  const genre = (GENRES as readonly string[]).includes(genreParam ?? "") ? (genreParam as Genre) : undefined;
  const areaParam = params.get("area");
  const area = (STAY_AREAS as readonly string[]).includes(areaParam ?? "") ? (areaParam as StayArea) : undefined;

  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [originLabel, setOriginLabel] = useState<string>(DEFAULT_ORIGIN.label);
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 現在地が許可されていれば近い順の基準に使う（拒否・未対応なら東京駅付近）
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "現在地" });
        setOriginLabel("現在地から");
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
    if (value === null) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `/?${qs}` : "/");
  }

  const activeConditions = [
    genre ? GENRE_LABEL[genre] : null,
    area ? AREA_LABEL[area] : null,
  ].filter(Boolean);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-6 pt-5">
      <header className="flex items-end justify-between">
        <h1 className="text-2xl font-bold text-brand">Wan Spot</h1>
        <span className="text-sm text-ink-sub">{originLabel}</span>
      </header>

      {!isLive() ? (
        <p className="rounded-[var(--radius-card)] border border-unverified/40 bg-surface p-3 text-sm">
          サンプルデータを表示しています（サーバー未接続）。実際の店舗の情報ではありません。
        </p>
      ) : null}

      <section aria-label="うちの子のサイズ" className="flex flex-col gap-2">
        <p className="text-sm text-ink-sub">
          {size
            ? `${SIZE_LABEL[size]}で入れるスポット`
            : "すべてのスポット（サイズで絞っていません）"}
        </p>
        <SizeChips value={size} onChange={(v) => updateParam("size", v ?? "all")} />
      </section>

      <SpotMap center={{ lat: origin.lat, lng: origin.lng }} spots={spots ?? []} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-sub">
          {activeConditions.length > 0 ? `条件：${activeConditions.join("・")}` : "条件：指定なし"}
        </p>
        <Link
          href={`/search${params.toString() ? `?${params.toString()}` : ""}`}
          className="flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface px-4 text-base"
        >
          <Icon name="search" className="h-5 w-5" />
          絞り込み
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-[var(--radius-card)] bg-ng-bg p-4 text-sm text-ng-ink">
          {error}
        </p>
      ) : null}

      <section aria-label="近い順の一覧" className="flex flex-col gap-3">
        <h2 className="text-base font-bold">近い順 {spots ? `${spots.length}件` : ""}</h2>
        {spots === null ? (
          <p className="text-ink-sub">読み込み中…</p>
        ) : spots.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <p>条件に合うスポットが見つかりませんでした。</p>
            <p className="mt-2 text-sm text-ink-sub">
              条件を変えるか、
              <Link href="/requests" className="font-bold text-brand underline">
                追加リクエスト
              </Link>
              もできます。
            </p>
          </div>
        ) : (
          spots.map((s) => <SpotCard key={s.id} spot={s} />)
        )}
      </section>

      <ConfirmNotice />
    </main>
  );
}
