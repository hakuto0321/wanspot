"use client";

import Link from "next/link";
import { Suspense, use, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { AllowBadge, ConfirmNotice, StatusBadge } from "@/components/SpotParts";
import {
  AMENITY_LABEL,
  AREA_LABEL,
  DOG_SIZES,
  GENRE_LABEL,
  RESERVATION_LABEL,
  RULE_LABEL,
  SIZE_LABEL,
  allowFor,
  formatDate,
  formatDistance,
  type Spot,
} from "@/lib/domain";
import { useFavorites } from "@/lib/hooks";
import { getSpot } from "@/lib/repository";

type PlaceInfo = { configured: boolean; phone?: string | null; hours?: string[]; error?: boolean };

export default function SpotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-4 text-ink-sub">読み込み中…</p>}>
      <SpotDetailView params={params} />
    </Suspense>
  );
}

function SpotDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [spot, setSpot] = useState<Spot | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const favorites = useFavorites();

  useEffect(() => {
    let active = true;
    getSpot(id)
      .then((s) => {
        if (active) setSpot(s);
      })
      .catch(() => {
        // 通信できないときは保存済みの写しで表示する（オフライン対応）
        if (active) {
          setFailed(true);
          setSpot(undefined);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  const current: Spot | null | undefined =
    spot ?? (failed ? favorites.items.find((s) => s.id === id) ?? null : undefined);

  // 営業時間・電話は表示時に取得（保存しない）
  const placeId = current?.googlePlaceId ?? null;
  useEffect(() => {
    if (!placeId) return;
    let active = true;
    fetch(`/api/places/${encodeURIComponent(placeId)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<PlaceInfo>)
      .then((info) => {
        if (active) setPlace(info);
      })
      .catch(() => {
        if (active) setPlace({ configured: true, error: true });
      });
    return () => {
      active = false;
    };
  }, [placeId]);

  if (current === undefined) {
    return <p className="p-4 text-ink-sub">読み込み中…</p>;
  }
  if (current === null) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <Back />
        <p className="mt-4">このスポットは見つかりませんでした。</p>
      </main>
    );
  }

  const policy = current.policy;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${current.lat},${current.lng}`;
  const saved = favorites.isFavorite(current.id);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-4">
      <Back />

      {/* 最上部：ナビ・電話・保存 */}
      <div className="grid grid-cols-3 gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] bg-brand text-sm font-bold text-white"
        >
          <Icon name="navigation" className="h-5 w-5" />
          ナビ
        </a>
        {place?.phone ? (
          <a
            href={`tel:${place.phone.replace(/[^0-9+]/g, "")}`}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] border border-line bg-surface text-sm font-bold"
          >
            <Icon name="phone" className="h-5 w-5" />
            電話
          </a>
        ) : (
          <span className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] border border-line bg-surface text-center text-xs text-ink-sub">
            <Icon name="phone" className="h-5 w-5" />
            電話番号なし
          </span>
        )}
        <button
          type="button"
          aria-pressed={saved}
          onClick={() => favorites.toggle(current)}
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] border border-line bg-surface text-sm font-bold"
        >
          <Icon name="heart" className="h-5 w-5" />
          {saved ? "保存済み" : "保存"}
        </button>
      </div>

      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold leading-snug">{current.name}</h1>
        <p className="text-sm text-ink-sub">
          {current.genres.map((g) => GENRE_LABEL[g]).join("・")}
          {current.distanceM !== undefined ? `　${formatDistance(current.distanceM)}` : ""}
        </p>
        {current.address ? <p className="text-base">{current.address}</p> : null}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusBadge status={current.status} />
          <span className="text-sm text-ink-sub">最終確認日：{formatDate(current.lastVerifiedAt)}</span>
        </div>
        {failed ? (
          <p className="text-sm text-ng-ink">通信できないため、保存時点の情報を表示しています。</p>
        ) : null}
      </section>

      <ConfirmNotice />

      <section aria-labelledby="policy-heading" className="flex flex-col gap-3">
        <h2 id="policy-heading" className="text-lg font-bold">同伴条件</h2>
        {policy ? (
          <>
            <div className="flex flex-wrap gap-2">
              {DOG_SIZES.map((size) => (
                <AllowBadge key={size} state={allowFor(policy, size)} label={SIZE_LABEL[size]} />
              ))}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
              <dt className="text-ink-sub">過ごし方</dt>
              <dd>
                {policy.areas.length > 0
                  ? policy.areas.map((a) => AREA_LABEL[a]).join("・")
                  : "情報なし"}
              </dd>
              <dt className="text-ink-sub">ルール</dt>
              <dd>
                {policy.rules.length > 0
                  ? policy.rules.map((r) => RULE_LABEL[r] ?? r).join("・")
                  : "情報なし"}
              </dd>
              <dt className="text-ink-sub">設備</dt>
              <dd>
                {policy.amenities.length > 0
                  ? policy.amenities.map((a) => AMENITY_LABEL[a] ?? a).join("・")
                  : "情報なし"}
              </dd>
              <dt className="text-ink-sub">予約</dt>
              <dd>{RESERVATION_LABEL[policy.reservation]}</dd>
              {policy.feeNote ? (
                <>
                  <dt className="text-ink-sub">料金</dt>
                  <dd>{policy.feeNote}</dd>
                </>
              ) : null}
              {current.parkingNote ? (
                <>
                  <dt className="text-ink-sub">駐車場</dt>
                  <dd>{current.parkingNote}</dd>
                </>
              ) : null}
            </dl>
          </>
        ) : (
          <p className="text-ink-sub">同伴条件はまだ確認できていません。</p>
        )}
      </section>

      {place?.hours && place.hours.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">営業時間</h2>
          <ul className="text-sm">
            {place.hours.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {place?.error ? <p className="text-sm text-ink-sub">営業時間は取得できませんでした。</p> : null}

      <section aria-labelledby="source-heading" className="flex flex-col gap-2">
        <h2 id="source-heading" className="text-lg font-bold">情報元</h2>
        <ul className="flex flex-col gap-1 text-base">
          {current.officialUrl ? (
            <li>
              <a href={current.officialUrl} target="_blank" rel="noopener noreferrer" className="text-brand underline">
                公式サイト
              </a>
            </li>
          ) : null}
          {policy?.sourceUrl ? (
            <li>
              <a href={policy.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand underline">
                同伴条件の根拠
              </a>
            </li>
          ) : null}
          <li className="text-ink-sub">利用者の報告</li>
        </ul>
        {place?.configured ? <p className="text-xs text-ink-sub">場所の情報：Google</p> : null}
      </section>

      <Link
        href={`/report/${current.id}`}
        className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-card)] border border-brand text-base font-bold text-brand"
      >
        <Icon name="pencil" className="h-5 w-5" />
        行ってきた報告をする
      </Link>
    </main>
  );
}

function Back() {
  return (
    <Link href="/" className="flex min-h-11 w-fit items-center gap-1 text-base text-ink-sub">
      <Icon name="chevron-left" className="h-5 w-5" />
      戻る
    </Link>
  );
}
