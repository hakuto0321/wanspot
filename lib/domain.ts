// ドメインの型・表示ラベル・小さな計算。DB の enum（docs/schema.sql）と揃えている。

export const DOG_SIZES = ["small", "medium", "large"] as const;
export type DogSize = (typeof DOG_SIZES)[number];

export const SIZE_LABEL: Record<DogSize, string> = {
  small: "小型",
  medium: "中型",
  large: "大型",
};

export const GENRES = [
  "cafe",
  "restaurant",
  "park",
  "dog_run",
  "sa_pa",
  "michi_no_eki",
  "sightseeing",
  "shopping",
  "lodging",
] as const;
export type Genre = (typeof GENRES)[number];

export const GENRE_LABEL: Record<Genre, string> = {
  cafe: "カフェ",
  restaurant: "飲食店",
  park: "公園",
  dog_run: "ドッグラン",
  sa_pa: "SA・PA",
  michi_no_eki: "道の駅",
  sightseeing: "観光",
  shopping: "ショッピング",
  lodging: "宿泊",
};

export const STAY_AREAS = ["indoor", "terrace", "outdoor_only", "held_or_cart"] as const;
export type StayArea = (typeof STAY_AREAS)[number];

export const AREA_LABEL: Record<StayArea, string> = {
  indoor: "店内",
  terrace: "テラス",
  outdoor_only: "屋外のみ",
  held_or_cart: "抱っこ・カート",
};

export type AllowState = "ok" | "ng" | "unknown";

export const ALLOW_LABEL: Record<AllowState, string> = {
  ok: "OK",
  ng: "NG",
  unknown: "不明",
};

export type VerifyStatus =
  | "unverified"
  | "user_verified"
  | "official_verified"
  | "needs_recheck"
  | "closed";

export const STATUS_LABEL: Record<VerifyStatus, string> = {
  unverified: "未確認",
  user_verified: "利用者の報告あり",
  official_verified: "公式情報で確認",
  needs_recheck: "再確認中",
  closed: "閉店",
};

export type ReservationNeed = "required" | "recommended" | "not_needed" | "unknown";

export const RESERVATION_LABEL: Record<ReservationNeed, string> = {
  required: "予約が必要",
  recommended: "予約推奨",
  not_needed: "予約不要",
  unknown: "不明",
};

// DB の rules / amenities は自由文字列の配列。既知のコードだけ日本語にする。
export const RULE_LABEL: Record<string, string> = {
  leash: "リード必須",
  manner_belt: "マナーベルト必須",
  vaccine_cert: "ワクチン証明の提示",
  no_floor: "床への座り込み不可",
};

export const AMENITY_LABEL: Record<string, string> = {
  dog_menu: "犬用メニュー",
  water: "水飲み場",
  dog_run: "ドッグラン",
  foot_wash: "足洗い場",
};

export const RESULT_LABEL = {
  entered: "入れた",
  refused: "入れなかった",
  closed: "閉店していた",
} as const;
export type ReportResult = keyof typeof RESULT_LABEL;

export const MODERATION_LABEL = {
  pending: "確認待ち",
  approved: "反映済み",
  rejected: "掲載なし",
  needs_human: "確認中",
} as const;
export type ModerationState = keyof typeof MODERATION_LABEL;

export type Policy = {
  sizeSmall: AllowState;
  sizeMedium: AllowState;
  sizeLarge: AllowState;
  areas: StayArea[];
  rules: string[];
  amenities: string[];
  reservation: ReservationNeed;
  feeNote: string | null;
  sourceUrl: string | null;
};

export type Spot = {
  id: string;
  name: string;
  genres: Genre[];
  prefecture: string;
  city: string | null;
  address: string | null;
  lat: number;
  lng: number;
  googlePlaceId: string | null;
  officialUrl: string | null;
  parkingNote: string | null;
  status: VerifyStatus;
  lastVerifiedAt: string | null;
  policy: Policy | null;
  /** 検索時に計算される。保存しない */
  distanceM?: number;
};

export function allowFor(policy: Policy | null, size: DogSize): AllowState {
  if (!policy) return "unknown";
  if (size === "small") return policy.sizeSmall;
  if (size === "medium") return policy.sizeMedium;
  return policy.sizeLarge;
}

export function sizeFits(spot: Spot, size: DogSize): boolean {
  return allowFor(spot.policy, size) === "ok";
}

/** 2点間の距離（メートル）。 */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(m: number | undefined): string {
  if (m === undefined) return "";
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

/** 「2026年11月」形式。確認日の表示に使う。 */
export function formatYearMonth(iso: string | null): string {
  if (!iso) return "記録なし";
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

/** 「2026年11月9日」形式。 */
export function formatDate(iso: string | null): string {
  if (!iso) return "未記録";
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 箱根町の中心付近。現在地が使えないときの基準点。 */
export const DEFAULT_ORIGIN = { lat: 35.2326, lng: 139.0228, label: "箱根町中心" };

export function isDogSize(v: string | null | undefined): v is DogSize {
  return v === "small" || v === "medium" || v === "large";
}
