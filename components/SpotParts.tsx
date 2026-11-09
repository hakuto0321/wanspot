import Link from "next/link";
import {
  type SpotPhoto as SpotPhotoData,
  ALLOW_LABEL,
  AREA_LABEL,
  DOG_SIZES,
  GENRE_LABEL,
  SIZE_LABEL,
  STATUS_LABEL,
  allowFor,
  formatDistance,
  formatYearMonth,
  type AllowState,
  type Spot,
  type VerifyStatus,
} from "@/lib/domain";

// 確認状況バッジ。色だけに頼らず文字も出す。
const STATUS_STYLE: Record<VerifyStatus, string> = {
  unverified: "border border-unverified/50 text-unverified",
  user_verified: "bg-ok-bg text-ok-ink",
  official_verified: "bg-ok-bg text-ok-ink",
  needs_recheck: "bg-ng-bg text-ng-ink",
  closed: "bg-ng-bg text-ng-ink",
};

export function StatusBadge({ status }: { status: VerifyStatus }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-sm font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// OK/NG の表示。面の色と文字の両方で伝える。
export function AllowBadge({ state, label }: { state: AllowState; label?: string }) {
  const style =
    state === "ok"
      ? "bg-ok-bg text-ok-ink"
      : state === "ng"
        ? "bg-ng-bg text-ng-ink"
        : "border border-line text-ink-sub";
  const badge = (
    <span className={`inline-block min-w-12 rounded px-2 py-0.5 text-center text-sm font-bold ${style}`}>
      {ALLOW_LABEL[state]}
    </span>
  );
  if (!label) return badge;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm text-ink-sub">{label}</span>
      {badge}
    </span>
  );
}

// サイズ別の OK/NG を一行の補足として出す（一覧の主役にはしない）。
// 色だけに頼らず、OK/NG の文字も出す。
export function SizeLine({ spot }: { spot: Spot }) {
  return (
    <p className="text-sm text-ink-sub">
      {DOG_SIZES.map((size, i) => {
        const state = allowFor(spot.policy, size);
        const tone = state === "ok" ? "text-ok-ink" : state === "ng" ? "text-ng-ink" : "text-ink-sub";
        return (
          <span key={size}>
            {i > 0 ? <span className="px-1.5">/</span> : null}
            <span>{SIZE_LABEL[size]}</span>{" "}
            <span className={`font-medium ${tone}`}>{ALLOW_LABEL[state]}</span>
          </span>
        );
      })}
    </p>
  );
}

export function AreaText({ spot }: { spot: Spot }) {
  const areas = spot.policy?.areas ?? [];
  if (areas.length === 0) return <span className="text-ink-sub">店内・テラスの情報なし</span>;
  return <span>{areas.map((a) => AREA_LABEL[a]).join("・")}</span>;
}

// 写真。承認済みのものだけを使う。出典と作者名は写真の下に必ず出す（ライセンスの条件）。
export function SpotPhoto({
  photo,
  name,
  className = "",
}: {
  photo: SpotPhotoData | undefined;
  name: string;
  className?: string;
}) {
  if (!photo) {
    return (
      <div
        className={`flex items-center justify-center bg-canvas text-xs text-ink-sub ${className}`}
        aria-label="写真はありません"
      >
        写真準備中
      </div>
    );
  }
  // 外部の画像 URL を扱うため next/image の設定に依存しない
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photo.url} alt={name} loading="lazy" className={`object-cover bg-canvas ${className}`} />;
}

// 写真の出典表示（作者名・ライセンス・元ページへのリンク）
export function PhotoCredit({ photo }: { photo: SpotPhotoData | undefined }) {
  if (!photo) return null;
  const author = photo.creditAuthor ?? "投稿者";
  const sourceLabel =
    photo.source === "owned"
      ? "自前の写真"
      : photo.source === "user_report"
        ? "利用者の報告写真"
        : photo.source === "commons"
          ? "Wikimedia Commons"
          : "許諾を得た写真";
  return (
    <p className="text-[11px] leading-snug text-ink-sub">
      写真：{author}（{photo.license}・{sourceLabel}）
      {photo.sourceUrl ? (
        <>
          {" "}
          <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
            出典
          </a>
        </>
      ) : null}
    </p>
  );
}

// 一覧の1行。写真（左）と、名前・所在地・確認状況・サイズの一行（右）。
export function SpotCard({ spot }: { spot: Spot }) {
  return (
    <Link
      href={`/spots/${spot.id}`}
      className="flex gap-4 border-b border-line bg-surface px-4 py-4 hover:bg-canvas md:px-5"
    >
      <div className="w-32 shrink-0 md:w-40">
        <SpotPhoto
          photo={spot.photos[0]}
          name={spot.name}
          className="h-24 w-full rounded md:h-28"
        />
        <PhotoCredit photo={spot.photos[0]} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-ink-sub">{spot.genres.map((g) => GENRE_LABEL[g]).join("・")}</p>
            <h2 className="mt-0.5 text-lg font-bold leading-snug">{spot.name}</h2>
          </div>
          {spot.distanceM !== undefined ? (
            <span className="shrink-0 pt-1 text-sm tabular-nums text-ink-sub">{formatDistance(spot.distanceM)}</span>
          ) : null}
        </div>

        <p className="mt-1 text-sm">
          <span className="text-ink-sub">所在地：</span>
          {spot.prefecture}{spot.city ?? ""}
          {spot.nearestStation ? <span className="text-ink-sub">　{spot.nearestStation}</span> : null}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <StatusBadge status={spot.status} />
          <span className="text-ink-sub">最終確認 {formatYearMonth(spot.lastVerifiedAt)}</span>
          <span className="text-ink-sub">
            {spot.reportCount > 0 ? `報告 ${spot.reportCount}件` : "まだ報告はありません"}
          </span>
        </div>

        <div className="mt-2">
          <SizeLine spot={spot} />
        </div>
      </div>
    </Link>
  );
}

// サイズの切り替え（分割ボタン）
export function SizeChips({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (size: string | null) => void;
}) {
  const options: Array<{ key: string | null; label: string }> = [
    { key: null, label: "すべて" },
    ...DOG_SIZES.map((s) => ({ key: s, label: SIZE_LABEL[s] })),
  ];
  return (
    <div role="group" aria-label="うちの子のサイズで絞る" className="grid grid-cols-4 overflow-hidden rounded-lg border border-line">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={`min-h-11 border-l border-line first:border-l-0 px-2 text-base font-bold ${
              active ? "bg-brand text-white" : "bg-surface text-ink hover:bg-canvas"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// 注意書き（左の線で示す。アイコンや絵文字は使わない）
export function ConfirmNotice() {
  return (
    <p className="border-l-4 border-unverified bg-surface px-4 py-3 text-sm text-ink">
      来店前に公式サイトや電話でご確認ください。
    </p>
  );
}
