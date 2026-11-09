// データアクセスの入口。Supabase 接続時はそこから読み、未接続時はサンプルデータで動く。
// 書き込み（報告・追加リクエスト）は未接続だと必ず失敗させる（サンプルに書いたように見せない）。

import {
  DEFAULT_RADIUS_M,
  allowFor,
  distanceMeters,
  type DogSize,
  type Genre,
  type Policy,
  type ReportResult,
  type ModerationState,
  type Spot,
  type StayArea,
  type VerifyStatus,
  type ReservationNeed,
  type AllowState,
} from "./domain";
import { SAMPLE_SPOTS } from "./seed";
import { getSupabase } from "./supabase";

export type SpotQuery = {
  origin: { lat: number; lng: number };
  size?: DogSize;
  genre?: Genre;
  area?: StayArea;
  radiusM?: number;
};

const NOT_CONNECTED = "サーバーに接続されていないため、この操作はできません。";

/** 近い順にスポットを返す。 */
export async function listSpots(query: SpotQuery): Promise<Spot[]> {
  const sb = getSupabase();
  const radius = query.radiusM ?? DEFAULT_RADIUS_M;

  if (!sb) {
    return SAMPLE_SPOTS.filter((s) => {
      if (query.genre && !s.genres.includes(query.genre)) return false;
      if (query.area && !(s.policy?.areas ?? []).includes(query.area)) return false;
      if (query.size && allowFor(s.policy, query.size) !== "ok") return false;
      return true;
    })
      .map((s) => ({ ...s, distanceM: distanceMeters(query.origin, s) }))
      .filter((s) => (s.distanceM ?? 0) <= radius)
      .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
  }

  const { data: near, error } = await sb.rpc("nearby_spots", {
    lat: query.origin.lat,
    lng: query.origin.lng,
    radius_m: radius,
    size: query.size ?? null,
    genre: query.genre ?? null,
    lim: 100,
  });
  if (error) throw new Error("スポットの取得に失敗しました");

  const rows = (near ?? []) as Array<{ spot_id: string; distance_m: number }>;
  if (rows.length === 0) return [];
  const distances = new Map(rows.map((r) => [r.spot_id, r.distance_m]));
  const ids = rows.map((r) => r.spot_id);

  const [spotsRes, policiesRes] = await Promise.all([
    sb.from("spots_public").select("*").in("id", ids),
    sb.from("dog_policies").select("*").in("spot_id", ids).eq("current", true),
  ]);
  if (spotsRes.error || policiesRes.error) throw new Error("スポットの取得に失敗しました");

  const policies = new Map<string, Policy>();
  for (const p of (policiesRes.data ?? []) as DbPolicy[]) {
    policies.set(p.spot_id, toPolicy(p));
  }

  return ((spotsRes.data ?? []) as DbSpot[])
    .map((row) => ({ ...toSpot(row, policies.get(row.id) ?? null), distanceM: distances.get(row.id) }))
    .filter((s) => !query.area || (s.policy?.areas ?? []).includes(query.area))
    .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
}

export async function getSpot(id: string): Promise<Spot | null> {
  const sb = getSupabase();
  if (!sb) return SAMPLE_SPOTS.find((s) => s.id === id) ?? null;

  const [spotRes, policyRes] = await Promise.all([
    sb.from("spots_public").select("*").eq("id", id).maybeSingle(),
    sb.from("dog_policies").select("*").eq("spot_id", id).eq("current", true).maybeSingle(),
  ]);
  if (spotRes.error) throw new Error("スポットの取得に失敗しました");
  if (!spotRes.data) return null;
  const policy = policyRes.data ? toPolicy(policyRes.data as DbPolicy) : null;
  return toSpot(spotRes.data as DbSpot, policy);
}

export type ReportInput = {
  spotId: string;
  result: ReportResult;
  dogSize: DogSize;
  breed: string | null;
  area: StayArea | null;
  comment: string | null;
};

export async function submitReport(input: ReportInput): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONNECTED);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です");

  const { error } = await sb.from("reports").insert({
    spot_id: input.spotId,
    user_id: auth.user.id,
    result: input.result,
    dog_size: input.dogSize,
    breed: input.breed,
    area: input.area,
    comment: input.comment,
  });
  if (error) throw new Error("報告を送信できませんでした。時間をおいてお試しください。");
}

export type SpotRequestInput = { name: string; note: string | null };

export async function submitSpotRequest(input: SpotRequestInput): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONNECTED);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です");

  const { error } = await sb.from("spot_requests").insert({
    user_id: auth.user.id,
    name: input.name,
    address_or_note: input.note,
  });
  if (error) throw new Error("リクエストを送信できませんでした。時間をおいてお試しください。");
}

export type MyReport = {
  id: string;
  spotId: string;
  spotName: string;
  result: ReportResult;
  visitedOn: string;
  moderation: ModerationState;
  dogSize: DogSize;
};

export async function listMyReports(): Promise<MyReport[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await sb
    .from("reports")
    .select("id, spot_id, result, visited_on, moderation, dog_size, spots(name)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("投稿履歴の取得に失敗しました");

  return ((data ?? []) as unknown as Array<{
    id: string;
    spot_id: string;
    result: ReportResult;
    visited_on: string;
    moderation: ModerationState;
    dog_size: DogSize;
    spots: { name: string } | null;
  }>).map((r) => ({
    id: r.id,
    spotId: r.spot_id,
    spotName: r.spots?.name ?? "（スポット名なし）",
    result: r.result,
    visitedOn: r.visited_on,
    moderation: r.moderation,
    dogSize: r.dog_size,
  }));
}

// --- 認証 ---

export type SessionUser = { email: string | null };

export async function getSessionUser(): Promise<SessionUser | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  return { email: data.user.email ?? null };
}

export async function sendLoginLink(email: string, next: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONNECTED);
  const redirect = `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirect },
  });
  if (error) throw new Error("ログイン用メールを送れませんでした。メールアドレスを確認してください。");
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

// --- 行変換 ---

type DbSpot = {
  id: string;
  name: string;
  genres: Genre[];
  prefecture: string;
  city: string | null;
  address: string | null;
  lat: number;
  lng: number;
  google_place_id: string | null;
  official_url: string | null;
  parking_note: string | null;
  status: VerifyStatus;
  last_verified_at: string | null;
};

type DbPolicy = {
  spot_id: string;
  size_small: AllowState;
  size_medium: AllowState;
  size_large: AllowState;
  areas: StayArea[];
  rules: string[];
  amenities: string[];
  reservation: ReservationNeed;
  fee_note: string | null;
  source_url: string | null;
};

function toPolicy(p: DbPolicy): Policy {
  return {
    sizeSmall: p.size_small,
    sizeMedium: p.size_medium,
    sizeLarge: p.size_large,
    areas: p.areas ?? [],
    rules: p.rules ?? [],
    amenities: p.amenities ?? [],
    reservation: p.reservation,
    feeNote: p.fee_note,
    sourceUrl: p.source_url,
  };
}

function toSpot(s: DbSpot, policy: Policy | null): Spot {
  return {
    id: s.id,
    name: s.name,
    genres: s.genres ?? [],
    prefecture: s.prefecture,
    city: s.city,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    googlePlaceId: s.google_place_id,
    officialUrl: s.official_url,
    parkingNote: s.parking_note,
    status: s.status,
    lastVerifiedAt: s.last_verified_at,
    policy,
  };
}
