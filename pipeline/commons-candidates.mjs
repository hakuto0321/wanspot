#!/usr/bin/env node
// Wikimedia Commons から、スポットの座標の近くにある写真の候補を集める。
//
//   node pipeline/commons-candidates.mjs <lat> <lng> [radiusM=5000] [limit=20] > candidates.json
//
// 方針（CLAUDE.md と docs/schema.sql の spot_photos）：
// - 使えるライセンスは CC0 / パブリックドメイン / CC BY / CC BY-SA のみ。
//   NC（非営利のみ）と ND（改変不可）は、副業の運営と掲載形式のため除外する。
// - 出力は「候補」。写真が本当にその場所かは人が確認し、承認してから spot_photos に入れる。
// - 作者名とライセンスは、表示のために必ず保存する（出典のない写真は入れない）。
// - 低頻度で呼ぶ（リクエスト間に 1 秒あける）。

const API = "https://commons.wikimedia.org/w/api.php";
// 連絡先を含む User-Agent を付ける（Wikimedia の利用方針）。個人のメールは入れない。
const USER_AGENT = "WanSpotPipeline/0.1 (https://wanspot.jp; spot photo candidates)";

const [, , latArg, lngArg, radiusArg = "5000", limitArg = "20"] = process.argv;
const lat = Number(latArg);
const lng = Number(lngArg);
const radius = Math.min(Number(radiusArg), 10000); // geosearch の上限は 10km
const limit = Math.min(Number(limitArg), 50);

if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
  console.error("usage: node pipeline/commons-candidates.mjs <lat> <lng> [radiusM] [limit]");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const url = new URL(API);
  url.search = new URLSearchParams({ format: "json", ...params }).toString();
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return res.json();
}

// HTML タグを除き、空白を整える（作者欄には <a> などが入ることがある）
function plain(html) {
  return (html ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// 使えるライセンスか判定する
function licenseAllowed(name) {
  if (!name) return false;
  if (/NC|ND/i.test(name)) return false; // 非営利のみ・改変不可は除外
  if (/^CC0/i.test(name)) return true;
  if (/public domain/i.test(name)) return true;
  return /^CC BY(-SA)? \d(\.\d)?$/i.test(name);
}

const geo = await api({
  action: "query",
  list: "geosearch",
  gscoord: `${lat}|${lng}`,
  gsradius: String(radius),
  gslimit: String(limit),
  gsnamespace: "6", // File:
});

const hits = geo.query?.geosearch ?? [];
const results = [];

for (const hit of hits) {
  await sleep(1000);
  const info = await api({
    action: "query",
    titles: hit.title,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "960",
  });
  const page = Object.values(info.query?.pages ?? {})[0];
  const image = page?.imageinfo?.[0];
  if (!image) continue;

  const meta = image.extmetadata ?? {};
  const license = meta.LicenseShortName?.value ?? "";
  if (!licenseAllowed(license)) continue;

  results.push({
    title: hit.title,
    status: "needs_review", // 場所の一致と、写真の内容を人が確認するまで登録しない
    source: "commons",
    distanceM: Math.round(hit.dist),
    lat: hit.lat,
    lng: hit.lon,
    thumbUrl: image.thumburl ?? image.url,
    pageUrl: image.descriptionurl,
    creditAuthor: plain(meta.Artist?.value) || null,
    license,
    licenseUrl: meta.LicenseUrl?.value ?? null,
  });
}

console.log(JSON.stringify(results, null, 2));
