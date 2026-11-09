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
  type SpotPhoto,
  type SpotReport,
} from "./domain";
import { SAMPLE_REPORTS, SAMPLE_SPOTS } from "./seed";
import { getSupabase } from "./supabase";

export type SpotQuery = {
  origin: { lat: number; lng: number };
  size?: DogSize;
  genre?: Genre;
  area?: StayArea;
  radiusM?: number;
};

const NOT_CONNECTED = "サーバーに接続されていないため、この操作はできません。";

// 承認済みの写真を、スポットごとにまとめて読む
type DbPhoto = {
  spot_id: string;
  url: string;
  source: SpotPhoto["source"];
  credit_author: string | null;
  license: string;
  source_url: string | null;
};

async function loadApprovedPhotos(ids: string[]): Promise<Map<string, SpotPhoto[]>> {
  const sb = getSupabase();
  const map = new Map<string, SpotPhoto[]>();
  if (!sb || ids.length === 0) return map;
  const { data, error } = await sb
    .from("spot_photos")
    .select("spot_id, url, source, credit_author, license, source_url")
    .in("spot_id", ids)
    .eq("approved", true)
    .order("sort_order");
  if (error) return map;
  for (const p of (data ?? []) as DbPhoto[]) {
    const list = map.get(p.spot_id) ?? [];
    list.push({
      url: p.url,
      source: p.source,
      creditAuthor: p.credit_author,
      license: p.license,
      sourceUrl: p.source_url,
    });
    map.set(p.spot_id, list);
  }
  return map;
}

// 承認済みの報告の件数（ビュー spot_report_stats）
async function loadReportStats(ids: string[]): Promise<Map<string, { count: number; last: string | null }>> {
  const sb = getSupabase();
  const map = new Map<string, { count: number; last: string | null }>();
  if (!sb || ids.length === 0) return map;
  const { data, error } = await sb
    .from("spot_report_stats")
    .select("spot_id, report_count, last_visited_on")
    .in("spot_id", ids);
  if (error) return map;
  for (const r of (data ?? []) as Array<{ spot_id: string; report_count: number; last_visited_on: string | null }>) {
    map.set(r.spot_id, { count: r.report_count, last: r.last_visited_on });
  }
  return map;
}

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
  const photos = await loadApprovedPhotos(ids);
  const stats = await loadReportStats(ids);

  return ((spotsRes.data ?? []) as DbSpot[])
    .map((row) => ({
      ...toSpot(row, policies.get(row.id) ?? null),
      photos: photos.get(row.id) ?? [],
      reportCount: stats.get(row.id)?.count ?? 0,
      lastReportedOn: stats.get(row.id)?.last ?? null,
      distanceM: distances.get(row.id),
    }))
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
  const photos = await loadApprovedPhotos([id]);
  const stats = await loadReportStats([id]);
  return {
    ...toSpot(spotRes.data as DbSpot, policy),
    photos: photos.get(id) ?? [],
    reportCount: stats.get(id)?.count ?? 0,
    lastReportedOn: stats.get(id)?.last ?? null,
  };
}

export type ReportInput = {
  spotId: string;
  result: ReportResult;
  dogSize: DogSize | null;
  breed: string | null;
  area: StayArea | null;
  comment: string | null;
  /** 前処理済みの写真（任意）。写真を付けるときは photoConsent が必須 */
  photo?: Blob | null;
  photoConsent?: boolean;
};

const REPORT_BUCKET = "report-photos";

export async function submitReport(input: ReportInput): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONNECTED);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です");
  if (input.photo && !input.photoConsent) {
    throw new Error("写真を掲載してよいかの確認にチェックしてください");
  }

  // 写真は自分のフォルダに保存する（ファイル名は推測されない ID）
  let photoPath: string | null = null;
  if (input.photo) {
    photoPath = `${auth.user.id}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await sb.storage
      .from(REPORT_BUCKET)
      .upload(photoPath, input.photo, { contentType: "image/jpeg", upsert: false });
    if (upErr) throw new Error("写真をアップロードできませんでした。時間をおいてお試しください。");
  }

  const { error } = await sb.from("reports").insert({
    spot_id: input.spotId,
    user_id: auth.user.id,
    result: input.result,
    dog_size: input.dogSize,
    breed: input.breed,
    area: input.area,
    comment: input.comment,
    photo_path: photoPath,
    photo_consent: Boolean(photoPath),
  });
  if (error) throw new Error("報告を送信できませんでした。時間をおいてお試しください。");
}

// --- レビュー（承認済みの報告を、役に立った順に出す） ---

export async function listSpotReports(spotId: string): Promise<SpotReport[]> {
  const sb = getSupabase();
  if (!sb) return SAMPLE_REPORTS[spotId] ?? [];

  const { data, error } = await sb
    .from("reports")
    .select("id, result, dog_size, breed, area, comment, photo_path, visited_on, helpful_count")
    .eq("spot_id", spotId)
    .eq("moderation", "approved")
    .order("helpful_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("報告を取得できませんでした");

  return ((data ?? []) as Array<{
    id: string;
    result: ReportResult;
    dog_size: DogSize | null;
    breed: string | null;
    area: StayArea | null;
    comment: string | null;
    photo_path: string | null;
    visited_on: string;
    helpful_count: number;
  }>).map((r) => ({
    id: r.id,
    result: r.result,
    dogSize: r.dog_size,
    breed: r.breed,
    area: r.area,
    comment: r.comment,
    photoUrl: r.photo_path ? sb.storage.from(REPORT_BUCKET).getPublicUrl(r.photo_path).data.publicUrl : null,
    visitedOn: r.visited_on,
    helpfulCount: r.helpful_count,
  }));
}

/** ログイン中の人が「役に立った」を付けている報告の ID */
export async function listMyHelpfulIds(reportIds: string[]): Promise<Set<string>> {
  const sb = getSupabase();
  if (!sb || reportIds.length === 0) return new Set();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return new Set();
  const { data } = await sb
    .from("report_reactions")
    .select("report_id")
    .eq("user_id", auth.user.id)
    .in("report_id", reportIds);
  return new Set(((data ?? []) as Array<{ report_id: string }>).map((r) => r.report_id));
}

export async function setHelpful(reportId: string, on: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONNECTED);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です");
  const { error } = on
    ? await sb.from("report_reactions").insert({ report_id: reportId, user_id: auth.user.id })
    : await sb.from("report_reactions").delete().eq("report_id", reportId).eq("user_id", auth.user.id);
  if (error) throw new Error("反応を送れませんでした");
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
  dogSize: DogSize | null;
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
    dog_size: DogSize | null;
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

// --- 認証：メールアドレス＋パスワード、Google。パスワードの再設定も含む ---

const AUTH_CALLBACK = "/login";

function authRedirect(next: string): string {
  return `${window.location.origin}${AUTH_CALLBACK}?next=${encodeURIComponent(next)}`;
}

/** ログイン。失敗理由は分かりやすく返す */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONNECTED);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error("メールアドレスかパスワードが違います。");
}

/**
 * 新規登録。確認メールが必要な設定なら needsConfirmation を true で返す。
 * 犬の情報（任意）は、ログインできた後に saveDogProfile で保存する。
 */
export async function signUpWithPassword(email: string, password: string, next: string): Promise<{ needsConfirmation: boolean }> {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONNECTED);
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: authRedirect(next) },
  });
  if (error) throw new Error("登録できませんでした。すでに登録済みか、パスワードが短すぎる可能性があります。");
  return { needsConfirmation: !data.session };
}

export async function signInWithGoogle(next: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONNECTED);
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authRedirect(next) },
  });
  if (error) throw new Error("Google でログインできませんでした。");
}

/** パスワード再設定のメールを送る */
export async function sendPasswordReset(email: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONNECTED);
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${AUTH_CALLBACK}?mode=newpassword`,
  });
  if (error) throw new Error("メールを送れませんでした。メールアドレスを確認してください。");
}

/** 再設定リンクから来た人の新しいパスワード */
export async function setNewPassword(password: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONNECTED);
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw new Error("パスワードを変更できませんでした。");
}

// --- うちの子（登録は任意。登録しているとき、報告の既定値に使う） ---

/** ログイン中の人の犬の情報を保存する。null なら削除 */
export async function saveDogProfile(profile: { size: DogSize; breed: string } | null): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return;
  await sb.from("dogs").delete().eq("user_id", auth.user.id);
  if (profile) {
    await sb.from("dogs").insert({
      user_id: auth.user.id,
      size: profile.size,
      breed: profile.breed || null,
    });
  }
}

// --- 報告の中で追加するスポット（承認まで非公開） ---

export async function createPendingSpot(name: string, lat: number, lng: number): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONNECTED);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("ログインが必要です");
  const { data, error } = await sb.rpc("create_pending_spot", { p_name: name, p_lat: lat, p_lng: lng });
  if (error || !data) throw new Error("スポットを追加できませんでした。時間をおいてお試しください。");
  return data as string;
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
  nearest_station: string | null;
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
    nearestStation: s.nearest_station,
    photos: [],
    reportCount: 0,
    lastReportedOn: null,
    status: s.status,
    lastVerifiedAt: s.last_verified_at,
    policy,
  };
}
