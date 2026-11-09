-- Wan Spot — Supabase schema (v0.1)
-- PostGIS を有効化してから実行する

create extension if not exists postgis;

-- ========== 列挙型 ==========
create type spot_genre as enum ('cafe','restaurant','park','dog_run','sa_pa','michi_no_eki','sightseeing','shopping','lodging');
create type verify_status as enum ('unverified','user_verified','official_verified','needs_recheck','closed');
create type allow_state as enum ('ok','ng','unknown');
create type dog_size as enum ('small','medium','large');
create type stay_area as enum ('indoor','terrace','outdoor_only','held_or_cart');
create type reservation_need as enum ('required','recommended','not_needed','unknown');
create type report_result as enum ('entered','refused','closed');
create type moderation_state as enum ('pending','approved','rejected','needs_human');
create type extractor as enum ('claude','openai','both','admin');
create type photo_source as enum ('owned','user_report','commons','licensed');

-- ========== スポット ==========
create table spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  genres spot_genre[] not null default '{}',
  prefecture text not null,
  city text,
  address text,
  location geography(Point, 4326) not null,
  google_place_id text,                -- Google から保存してよいのはこれだけ
  official_url text,
  sns_url text,
  parking_note text,                   -- 公式情報またはユーザー報告由来
  nearest_station text,                -- 最寄り駅とアクセス（公式情報またはユーザー報告由来）
  status verify_status not null default 'unverified',
  last_verified_at timestamptz,
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null, -- 報告の中で追加した人（承認前は本人だけが見られる）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index spots_location_idx on spots using gist (location);
create index spots_pref_city_idx on spots (prefecture, city);

-- ========== 写真（出典とライセンスを必ず持つ。出典が不明な写真は入れない） ==========
-- owned: 管理人が撮影 / user_report: 利用者の報告写真（同意と審査が必要）
-- commons: Wikimedia Commons（CC0 / CC BY / CC BY-SA のみ）/ licensed: 書面で許諾を得た写真
create table spot_photos (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references spots(id) on delete cascade,
  url text not null,
  source photo_source not null,
  credit_author text,                 -- 撮影者名（表示する）
  license text not null,              -- 例：'CC BY-SA 4.0' / '自前' / '許諾'
  source_url text,                    -- 元のページ（Commons のファイルページなど）
  approved boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index spot_photos_spot_idx on spot_photos (spot_id, sort_order);

-- ========== 同伴条件（履歴を残すため spot と 1:N、最新を current=true） ==========
-- 犬連れで行けるかの中身。エリア・ルール・設備・予約・料金などが本体で、サイズ別の可否（size_*）はその一項目。
create table dog_policies (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references spots(id) on delete cascade,
  current boolean not null default true,
  size_small allow_state not null default 'unknown',
  size_medium allow_state not null default 'unknown',
  size_large allow_state not null default 'unknown',
  weight_limit_kg numeric,
  areas stay_area[] not null default '{}',
  max_dogs int,
  rules text[] not null default '{}',      -- 'leash','manner_belt','vaccine_cert','no_floor' など
  amenities text[] not null default '{}',  -- 'dog_menu','water','dog_run','foot_wash' など
  fee_note text,
  reservation reservation_need not null default 'unknown',
  source_url text,                         -- 根拠URL（必須にしたいが、管理人入力は空も可）
  evidence_note text,                      -- 内部用。根拠の要約（原文の転載はしない）
  confidence numeric check (confidence between 0 and 1),
  extracted_by extractor not null,
  extracted_at timestamptz not null default now()
);
create unique index dog_policies_current_idx on dog_policies (spot_id) where current;

-- ========== ユーザー ==========
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table dogs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  size dog_size not null,
  breed text,
  created_at timestamptz not null default now()
);

create table favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  spot_id uuid not null references spots(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, spot_id)
);

-- ========== 行ってきた報告 ==========
create table reports (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references spots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visited_on date not null default current_date,
  result report_result not null,
  dog_size dog_size,                        -- 任意。サイズがなくても報告できる
  breed text,
  area stay_area,
  comment text check (char_length(comment) <= 200),
  photo_path text,                          -- Supabase Storage のパス（写真は掲載の同意がある場合だけ）
  photo_consent boolean not null default false, -- 「サイトに掲載してよい写真」の同意
  helpful_count int not null default 0,     -- 「役に立った」の数（report_reactions から自動更新）
  moderation moderation_state not null default 'pending',
  created_at timestamptz not null default now(),
  constraint reports_photo_needs_consent check (photo_path is null or photo_consent)
);
create index reports_spot_idx on reports (spot_id, created_at desc);

-- 「役に立った」。1人1報告につき1回。件数は reports.helpful_count に入れる
create table report_reactions (
  report_id uuid not null references reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

create or replace function sync_helpful_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update reports set helpful_count = helpful_count + 1 where id = new.report_id;
  elsif (tg_op = 'DELETE') then
    update reports set helpful_count = greatest(helpful_count - 1, 0) where id = old.report_id;
  end if;
  return null;
end $$;
create trigger report_reactions_count
  after insert or delete on report_reactions
  for each row execute function sync_helpful_count();

-- 承認済みの報告の件数だけを返す（報告者の user_id は出さない）。RLS は呼び出し元のものを使う。
create or replace view spot_report_stats with (security_invoker = true) as
  select spot_id, count(*)::int as report_count, max(visited_on) as last_visited_on
  from reports
  where moderation = 'approved'
  group by spot_id;
grant select on spot_report_stats to anon, authenticated;

-- ========== 追加リクエスト ==========
create table spot_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  address_or_note text,
  location geography(Point, 4326),
  status text not null default 'open',      -- open / added / rejected
  created_at timestamptz not null default now()
);

-- ========== 店舗からの修正・削除依頼 ==========
create table store_requests (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid references spots(id) on delete set null,
  contact text not null,
  body text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- ========== 管理人の確認キュー ==========
create table review_queue (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                       -- 'extract_mismatch' / 'moderation' / 'store_request'
  spot_id uuid references spots(id) on delete cascade,
  ref_id uuid,                              -- reports.id など
  payload jsonb not null default '{}',      -- 両AIの抽出結果など
  status text not null default 'open',      -- open / done
  created_at timestamptz not null default now()
);

-- ========== 公式ページの変更検知 ==========
create table source_snapshots (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references spots(id) on delete cascade,
  url text not null,
  content_hash text not null,
  fetched_at timestamptz not null default now()
);

-- ========== 近い順検索 ==========
-- 近い順の検索。サイズは任意の絞り込み（指定しなければ同伴条件によらず近い順）。
create or replace function nearby_spots(
  lat double precision,
  lng double precision,
  radius_m int default 50000,
  size dog_size default null,
  genre spot_genre default null,
  lim int default 50
)
returns table (spot_id uuid, distance_m double precision)
language sql stable as $$
  select s.id, st_distance(s.location, st_makepoint(lng, lat)::geography)
  from spots s
  join dog_policies p on p.spot_id = s.id and p.current
  where s.published
    and s.status <> 'closed'
    and st_dwithin(s.location, st_makepoint(lng, lat)::geography, radius_m)
    and (genre is null or genre = any(s.genres))
    and (size is null
      or (size = 'small'  and p.size_small  = 'ok')
      or (size = 'medium' and p.size_medium = 'ok')
      or (size = 'large'  and p.size_large  = 'ok'))
  order by 2
  limit lim;
$$;

-- ========== RLS ==========
alter table spots enable row level security;
alter table dog_policies enable row level security;
alter table profiles enable row level security;
alter table dogs enable row level security;
alter table favorites enable row level security;
alter table reports enable row level security;
alter table spot_requests enable row level security;
alter table store_requests enable row level security;
alter table review_queue enable row level security;
alter table spot_photos enable row level security;
alter table source_snapshots enable row level security;

-- 公開スポットと現在の同伴条件は誰でも読める
create policy "public read spots" on spots for select using (published);
-- 自分が追加したスポットは、承認前でも本人だけが見られる
create policy "own spot read" on spots for select using (auth.uid() = created_by);
create policy "public read policies" on dog_policies for select
  using (current and exists (select 1 from spots s where s.id = spot_id and s.published));

-- 承認済みの写真は、公開スポットのものだけ誰でも読める
create policy "public read approved photos" on spot_photos for select
  using (approved and exists (select 1 from spots s where s.id = spot_id and s.published));

-- 承認済みの報告は誰でも読める。投稿は本人のみ
create policy "public read approved reports" on reports for select using (moderation = 'approved');
create policy "own reports read" on reports for select using (auth.uid() = user_id);
create policy "insert own report" on reports for insert with check (auth.uid() = user_id);

-- 報告者の user_id は、公開の読み取りから外す（列の権限で制御）
revoke select on reports from anon;
grant select (id, spot_id, visited_on, result, dog_size, breed, area, comment, photo_path,
              photo_consent, helpful_count, moderation, created_at) on reports to anon;
grant select on reports to authenticated;

-- 「役に立った」は本人だけが付け外しできる。件数は上の trigger で数える
alter table report_reactions enable row level security;
create policy "own reactions read" on report_reactions for select using (auth.uid() = user_id);
create policy "own reactions write" on report_reactions for insert with check (auth.uid() = user_id);
create policy "own reactions delete" on report_reactions for delete using (auth.uid() = user_id);

-- 本人のデータ
create policy "own profile" on profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own dogs" on dogs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own favorites" on favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- リクエストは投稿のみ（読むのは管理側 = service role）
create policy "insert spot request" on spot_requests for insert with check (auth.uid() = user_id);
create policy "insert store request" on store_requests for insert with check (true);

-- review_queue / source_snapshots は service role（pipeline・管理画面）のみ。ポリシーを作らない

-- ========== 公開用ビュー（緯度経度つき） ==========
-- spots の location は geography のままなので、アプリ用に緯度経度を出す。
-- security_invoker = true で、呼び出し元の RLS（published のみ読める）をそのまま効かせる。
create or replace view spots_public with (security_invoker = true) as
  select s.*, st_y(s.location::geometry) as lat, st_x(s.location::geometry) as lng
  from spots s;
grant select on spots_public to anon, authenticated;

-- ========== 報告写真の保存先（Supabase Storage） ==========
-- 公開バケット（URL で表示する）。ファイル名は推測されない UUID。
-- 本人だけが、自分のフォルダ（user_id/）へ入れられる。
-- 注意：公開バケットなので、承認前の写真も URL を知っていれば見える。
--       公開前に、承認済みだけを返す方式（署名付き URL など）へ見直すこと。
insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', true)
  on conflict (id) do nothing;
create policy "upload own report photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ========== 報告の中でスポットを追加（承認まで非公開） ==========
-- 位置は現在地から。名前だけ必須。公開は管理人が published を true にしたときだけ。
create policy "insert own pending spot" on spots for insert
  with check (auth.uid() = created_by and published = false and status = 'unverified');

create or replace function create_pending_spot(p_name text, p_lat double precision, p_lng double precision)
returns uuid language plpgsql security invoker as $$
declare new_id uuid;
begin
  insert into spots (name, genres, prefecture, location, status, published, created_by)
  values (p_name, '{}', '未入力', st_makepoint(p_lng, p_lat)::geography, 'unverified', false, auth.uid())
  returning id into new_id;
  return new_id;
end $$;
grant execute on function create_pending_spot(text, double precision, double precision) to authenticated;
