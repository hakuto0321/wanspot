"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { AllowBadge, ConfirmNotice, PhotoCredit, SpotPhoto, StatusBadge } from "@/components/SpotParts";
import {
  AMENITY_LABEL,
  AREA_LABEL,
  DOG_SIZES,
  GENRE_LABEL,
  RESERVATION_LABEL,
  RESULT_LABEL,
  RULE_LABEL,
  SIZE_LABEL,
  allowFor,
  formatDate,
  formatDistance,
  type Spot,
  type SpotReport,
} from "@/lib/domain";
import { useFavorites, useSession } from "@/lib/hooks";
import { getSpot, listMyHelpfulIds, listSpotReports, setHelpful } from "@/lib/repository";
import { isLive } from "@/lib/supabase";

type PlaceInfo = { configured: boolean; phone?: string | null; hours?: string[]; error?: boolean };

export default function SpotDetailPage() {
  return (
    <Suspense fallback={<p className="p-4 text-ink-sub">読み込み中…</p>}>
      <SpotDetailView />
    </Suspense>
  );
}

function SpotDetailView() {
  const { id } = useParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const favorites = useFavorites();
  const session = useSession();
  const router = useRouter();
  const [reviews, setReviews] = useState<SpotReport[] | null>(null);
  const [helpfulIds, setHelpfulIds] = useState<Set<string>>(new Set());

  // 承認済みの報告（レビュー）と、自分が「役に立った」を付けた報告
  useEffect(() => {
    let active = true;
    listSpotReports(id)
      .then(async (list) => {
        const mine = await listMyHelpfulIds(list.map((r) => r.id));
        if (active) {
          setReviews(list);
          setHelpfulIds(mine);
        }
      })
      .catch(() => {
        if (active) setReviews([]);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function toggleHelpful(r: SpotReport) {
    if (!session.user) {
      router.push(`/login?next=${encodeURIComponent(`/spots/${id}`)}`);
      return;
    }
    const on = !helpfulIds.has(r.id);
    const delta = on ? 1 : -1;
    setHelpfulIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(r.id);
      else next.delete(r.id);
      return next;
    });
    setReviews((prev) =>
      prev?.map((x) => (x.id === r.id ? { ...x, helpfulCount: x.helpfulCount + delta } : x)) ?? prev
    );
    try {
      await setHelpful(r.id, on);
    } catch {
      // 失敗したら元に戻す
      setHelpfulIds((prev) => {
        const next = new Set(prev);
        if (on) next.delete(r.id);
        else next.add(r.id);
        return next;
      });
      setReviews((prev) =>
        prev?.map((x) => (x.id === r.id ? { ...x, helpfulCount: x.helpfulCount - delta } : x)) ?? prev
      );
    }
  }

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
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <Back />
        <p className="mt-4">このスポットは見つかりませんでした。</p>
      </main>
    );
  }

  const policy = current.policy;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${current.lat},${current.lng}`;
  const saved = favorites.isFavorite(current.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-4">
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
            className="flex min-h-14 flex-col items-center justify-center gap-1 panel text-sm font-bold"
          >
            <Icon name="phone" className="h-5 w-5" />
            電話
          </a>
        ) : (
          <span className="flex min-h-14 flex-col items-center justify-center gap-1 panel text-center text-xs text-ink-sub">
            <Icon name="phone" className="h-5 w-5" />
            電話
          </span>
        )}
        <button
          type="button"
          aria-pressed={saved}
          onClick={() => favorites.toggle(current)}
          className="flex min-h-14 flex-col items-center justify-center gap-1 panel text-sm font-bold"
        >
          <Icon name="heart" className="h-5 w-5" />
          {saved ? "保存済み" : "保存"}
        </button>
      </div>

      <div>
        <SpotPhoto
          photo={current.photos[0]}
          name={current.name}
          className="h-44 w-full rounded-[var(--radius-card)] border border-line md:h-60"
        />
        <div className="mt-1">
          <PhotoCredit photo={current.photos[0]} />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold leading-snug">{current.name}</h1>
        <p className="text-sm text-ink-sub">
          {current.genres.map((g) => GENRE_LABEL[g]).join("・")}
          {current.distanceM !== undefined ? `　${formatDistance(current.distanceM)}` : ""}
        </p>
        <p className="text-base">
          {current.prefecture}
          {current.city ?? ""}
          {current.address ? ` ${current.address}` : ""}
        </p>
        {current.nearestStation ? <p className="text-base">{current.nearestStation}</p> : null}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${current.lat},${current.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit text-sm font-bold text-ink underline underline-offset-4"
        >
          地図で場所を見る
        </a>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusBadge status={current.status} />
          <span className="text-sm text-ink-sub">最終確認日：{formatDate(current.lastVerifiedAt)}</span>
        </div>
        {failed ? (
          <p className="text-sm text-ink">通信できないため、保存時点の情報を表示しています。</p>
        ) : null}
      </section>

      <ConfirmNotice />

      <section aria-labelledby="policy-heading" className="flex flex-col gap-3">
        <h2 id="policy-heading" className="section-title">同伴条件</h2>
        {policy ? (
          <>
            <div className="flex flex-wrap gap-2">
              {DOG_SIZES.map((size) => (
                <AllowBadge key={size} state={allowFor(policy, size)} label={SIZE_LABEL[size]} />
              ))}
            </div>
            <dl className="grid grid-cols-[7.5em_1fr] text-[15px]">
              <dt className="border-t border-line-soft py-2.5 text-ink-sub">過ごし方</dt>
              <dd className="border-t border-line-soft py-2.5">
                {policy.areas.length > 0
                  ? policy.areas.map((a) => AREA_LABEL[a]).join("・")
                  : "情報なし"}
              </dd>
              <dt className="border-t border-line-soft py-2.5 text-ink-sub">ルール</dt>
              <dd className="border-t border-line-soft py-2.5">
                {policy.rules.length > 0
                  ? policy.rules.map((r) => RULE_LABEL[r] ?? r).join("・")
                  : "情報なし"}
              </dd>
              <dt className="border-t border-line-soft py-2.5 text-ink-sub">設備</dt>
              <dd className="border-t border-line-soft py-2.5">
                {policy.amenities.length > 0
                  ? policy.amenities.map((a) => AMENITY_LABEL[a] ?? a).join("・")
                  : "情報なし"}
              </dd>
              <dt className="border-t border-line-soft py-2.5 text-ink-sub">予約</dt>
              <dd className="border-t border-line-soft py-2.5">{RESERVATION_LABEL[policy.reservation]}</dd>
              {policy.feeNote ? (
                <>
                  <dt className="border-t border-line-soft py-2.5 text-ink-sub">料金</dt>
                  <dd className="border-t border-line-soft py-2.5">{policy.feeNote}</dd>
                </>
              ) : null}
              {current.parkingNote ? (
                <>
                  <dt className="border-t border-line-soft py-2.5 text-ink-sub">駐車場</dt>
                  <dd className="border-t border-line-soft py-2.5">{current.parkingNote}</dd>
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
          <h2 className="section-title">営業時間</h2>
          <ul className="text-sm">
            {place.hours.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {place?.error ? <p className="text-sm text-ink-sub">営業時間は取得できませんでした。</p> : null}

      <section aria-labelledby="report-heading" className="flex flex-col gap-2">
        <h2 id="report-heading" className="section-title">利用者の報告</h2>
        {reviews === null ? (
          <p className="py-2 text-ink-sub">読み込み中…</p>
        ) : reviews.length === 0 ? (
          <p className="py-2 text-base">まだ報告はありません</p>
        ) : (
          <ul className="flex flex-col">
            {reviews.map((r) => {
              const helpful = helpfulIds.has(r.id);
              return (
                <li key={r.id} className="flex flex-col gap-2 border-b border-line-soft py-4 first:pt-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span
                      className={`rounded px-2 py-0.5 font-bold ${
                        r.result === "entered"
                          ? "bg-surface text-ink"
                          : r.result === "refused"
                            ? "bg-surface text-ink"
                            : "border border-line text-ink-sub"
                      }`}
                    >
                      {RESULT_LABEL[r.result]}
                    </span>
                    <span className="text-ink-sub">
                      {r.dogSize ? SIZE_LABEL[r.dogSize] : null}
                      {r.breed ? `・${r.breed}` : ""}
                    </span>
                    {r.area ? <span className="text-ink-sub">{AREA_LABEL[r.area]}</span> : null}
                    <span className="text-ink-sub">{formatDate(r.visitedOn)}</span>
                  </div>

                  {r.comment ? <p className="text-base">{r.comment}</p> : null}

                  {r.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.photoUrl}
                      alt="利用者の写真"
                      loading="lazy"
                      className="h-48 w-full rounded-[var(--radius-card)] object-cover"
                    />
                  ) : null}

                  <div>
                    <button
                      type="button"
                      aria-pressed={helpful}
                      disabled={!isLive()}
                      onClick={() => toggleHelpful(r)}
                      className={`min-h-9 rounded-full border px-4 text-sm font-bold disabled:opacity-60 ${
                        helpful ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink"
                      }`}
                    >
                      役に立った {r.helpfulCount}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="source-heading" className="flex flex-col gap-2">
        <h2 id="source-heading" className="section-title">情報元</h2>
        <ul className="flex flex-col gap-1 text-base">
          {current.officialUrl ? (
            <li>
              <a href={current.officialUrl} target="_blank" rel="noopener noreferrer" className="text-ink underline">
                公式サイト
              </a>
            </li>
          ) : null}
          {policy?.sourceUrl ? (
            <li>
              <a href={policy.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-ink underline">
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
        className="btn btn-secondary w-full gap-2"
      >
        <Icon name="pencil" className="h-5 w-5" />
        報告する
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
