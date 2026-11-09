import {
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
  unverified: "border border-unverified/40 text-unverified",
  user_verified: "bg-ok-bg text-ok-ink",
  official_verified: "bg-ok-bg text-ok-ink",
  needs_recheck: "bg-ng-bg text-ng-ink",
  closed: "bg-ng-bg text-ng-ink",
};

export function StatusBadge({ status }: { status: VerifyStatus }) {
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-sm font-medium ${STATUS_STYLE[status]}`}>
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
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium ${style}`}>
      {label ? <span>{label}</span> : null}
      <span>{ALLOW_LABEL[state]}</span>
    </span>
  );
}

// 一覧カードに出す「小・中・大」の OK/NG
export function SizeRow({ spot }: { spot: Spot }) {
  return (
    <div className="flex flex-wrap gap-2">
      {DOG_SIZES.map((size) => (
        <AllowBadge key={size} state={allowFor(spot.policy, size)} label={SIZE_LABEL[size]} />
      ))}
    </div>
  );
}

export function AreaText({ spot }: { spot: Spot }) {
  const areas = spot.policy?.areas ?? [];
  if (areas.length === 0) return <span className="text-ink-sub">店内／テラスの情報なし</span>;
  return <span>{areas.map((a) => AREA_LABEL[a]).join("・")}</span>;
}

export function SpotCard({ spot }: { spot: Spot }) {
  return (
    <a
      href={`/spots/${spot.id}`}
      className="block rounded-[var(--radius-card)] border border-line bg-surface p-4 active:bg-canvas"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold leading-snug">{spot.name}</h2>
        {spot.distanceM !== undefined ? (
          <span className="shrink-0 text-sm text-ink-sub">{formatDistance(spot.distanceM)}</span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-ink-sub">
        {spot.genres.map((g) => GENRE_LABEL[g]).join("・")}
      </p>
      <div className="mt-3">
        <SizeRow spot={spot} />
      </div>
      <p className="mt-3 text-sm">
        <AreaText spot={spot} />
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={spot.status} />
        <span className="text-sm text-ink-sub">
          最終確認 {formatYearMonth(spot.lastVerifiedAt)}
        </span>
      </div>
    </a>
  );
}

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
    <div role="group" aria-label="うちの子のサイズで絞る" className="flex gap-2 overflow-x-auto">
      {options.map((o) => {
        const active = value === o.key || (value === null && o.key === null);
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-base ${
              active
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ConfirmNotice() {
  return (
    <p className="rounded-[var(--radius-card)] border border-unverified/40 bg-surface p-4 text-sm text-ink">
      来店前に、店舗・施設の公式サイトや電話で最新の条件をご確認ください。掲載内容は変わることがあります。
    </p>
  );
}
