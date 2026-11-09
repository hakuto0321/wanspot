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
  status verify_status not null default 'unverified',
  last_verified_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index spots_location_idx on spots using gist (location);
create index spots_pref_city_idx on spots (prefecture, city);

-- ========== 同伴条件（履歴を残すため spot と 1:N、最新を current=true） ==========
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
  dog_size dog_size not null,
  breed text,
  area stay_area,
  comment text check (char_length(comment) <= 200),
  photo_path text,                          -- Supabase Storage のパス
  moderation moderation_state not null default 'pending',
  created_at timestamptz not null default now()
);
create index reports_spot_idx on reports (spot_id, created_at desc);

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
create or replace function nearby_spots(
  lat double precision,
  lng double precision,
  radius_m int default 20000,
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
alter table source_snapshots enable row level security;

-- 公開スポットと現在の同伴条件は誰でも読める
create policy "public read spots" on spots for select using (published);
create policy "public read policies" on dog_policies for select
  using (current and exists (select 1 from spots s where s.id = spot_id and s.published));

-- 承認済みの報告は誰でも読める。投稿は本人のみ
create policy "public read approved reports" on reports for select using (moderation = 'approved');
create policy "own reports read" on reports for select using (auth.uid() = user_id);
create policy "insert own report" on reports for insert with check (auth.uid() = user_id);

-- 本人のデータ
create policy "own profile" on profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own dogs" on dogs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own favorites" on favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- リクエストは投稿のみ（読むのは管理側 = service role）
create policy "insert spot request" on spot_requests for insert with check (auth.uid() = user_id);
create policy "insert store request" on store_requests for insert with check (true);

-- review_queue / source_snapshots は service role（pipeline・管理画面）のみ。ポリシーを作らない
