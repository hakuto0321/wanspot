# Wan Spot — CLAUDE.md

犬連れで行けるカフェ・公園・ドライブスポットを、「うちの子のサイズで入れるか」で探せるスマホファーストのWebアプリ（PWA）。
初期データはAIで集め、ユーザーの「行ってきた報告」で確かにしていく。個人運営・副業。

## いちばん大事な方針：引き算の美学

- 答えるのは2つだけ：**「うちの子（のサイズ）で入れるか」「その情報は新しいか」**。これを一番速く・正確に出す。
- 競合（Wan!Pass 等）が持つ機能は追わない：ワクチン証明書の管理、しつけ認定、店舗との契約・チェックイン、SNS機能（フォロー等）。
- 迷ったら機能を足さずに削る。新しい画面より、既存画面の情報の正確さを優先する。
- 誤情報が最大のリスク。どの画面でも「確認状況」と「最終確認日」を必ず見せる。

## 技術構成

| 役割 | 採用 |
|---|---|
| アプリ | Next.js（App Router）＋ TypeScript ＋ Tailwind CSS。PWA（ホーム画面追加・オフライン対応） |
| ホスティング | Vercel |
| DB・認証・画像 | Supabase（Postgres ＋ PostGIS、Auth、Storage）。スキーマは `docs/schema.sql` |
| 地図 | Google Maps JavaScript API（`@vis.gl/react-google-maps`） |
| 場所の特定 | Places API (New)。**保存してよいのは place_id のみ**。営業時間・電話等は表示時に取得 |
| ナビ・電話 | Google マップの経路URL（Maps URLs）と `tel:` リンク。アプリ内で作り込まない |
| AI | Claude API と OpenAI API。`lib/ai/` の共通インターフェース経由で呼ぶ（直接SDKを散らさない） |
| 飲食店の候補 | ホットペッパー グルメサーチAPI（`pet=1`、`parking=1`）。候補探し専用 |
| 定期実行 | GitHub Actions の cron（AI収集・再確認・週次分析） |

## ディレクトリ方針

```
app/                 画面（App Router）
components/          UI部品
lib/supabase/        DBクライアント・型
lib/ai/              AIプロバイダ抽象化（claude.ts / openai.ts / index.ts）
lib/places/          Google Places 呼び出し
pipeline/            AIデータ収集・抽出・再確認のバッチ（GitHub Actions から実行）
docs/                schema.sql、仕様メモ
```

## 画面（MVP 12画面）

下部タブ：**探す（ホーム）／お気に入り／報告する／マイページ**

1. 初回起動 → 2. うちの子設定（サイズ：小・中・大、犬種は任意。登録不要、端末に保存）
3. ホーム：地図＋近い順リスト。サイズフィルタを常に表示
4. 検索・絞り込み：エリア・ジャンル・サイズ・同伴条件。**結果はホームの地図と一覧に反映（専用の結果画面は作らない）**
5. お気に入り：オフラインでも表示
6. スポット詳細：最上部にナビ・電話・保存。同伴条件、確認状況、情報元
7. 外部アプリ（地図ナビ・電話）へ渡す
8. マイページ：うちの子・投稿履歴
9. 報告先を選ぶ（タブ「報告する」）：近くの候補から
10. かんたん報告：①入れた／入れなかった／閉店 ②どこで過ごしたか → 送信。犬のサイズ・犬種は自動入力
11. ログイン：**初めて報告を送るときだけ**求める
12. 追加リクエスト／報告完了（完了後は詳細へ自動で戻り、確認状況の更新が見える）

デザイン案（キャンバス）：https://claude.ai/artifact/UvUc3H6v4N1ppv715nwviA
企画書：https://claude.ai/artifact/8ZQTYv8ehVtsbY64qW1RhG

## デザインルール（ナチュラル × シンプル）

- スマホ縦画面が基準。PC表示は後回し（スマホ画面を広げた表示でよい）
- 屋外でも読める：本文16px以上、タップ領域44px以上、十分なコントラスト
- 読まずに判断できる：一覧カードに「サイズ別 OK/NG」「店内/テラス」「確認状況＋日付」を必ず出す
- 色
  - 背景 `#F5F4EF` ／ 面 `#FFFFFF` ／ 線 `#E2E0D8`
  - 文字 `#1E2A23` ／ 補足文字 `#5B6660`
  - メイン（森の緑）`#2E6A4C`、OKの面 `#E3EEE6` ＋ 文字 `#1F4D36`
  - NGの面 `#F6E4DE` ＋ 文字 `#8E2F1C`
  - 未確認の文字 `#6B5A2E`
  - 色だけで意味を伝えない（OK/NG は必ず文字も出す）
- フォント：Zen Kaku Gothic New（Google Fonts）
- 絵文字は使わない。アイコンは線のSVG
- 角丸 12〜16px、影やグラデーションは使わない

## データの扱い（厳守）

- 同伴条件の根拠は **公式情報（店舗・施設の公式サイト/SNS、自治体、NEXCO 等）とユーザー報告のみ**
- Google の Places データを自前DBの根拠にしない。保存は place_id だけ。Google の場所情報を地図に出すときは Google の地図上で、帰属表示を付ける
- 食べログ・Googleマップ等のスクレイピングはしない。公式サイトの取得は robots.txt と利用規約を守り、低頻度で
- 他サイトの文章・写真は転載しない。事実だけを自分たちの項目に構造化する
- 確認状況の遷移
  - AI収集 → `unverified`（未確認）
  - 直近6か月に「入れた」報告が1件以上 → `user_verified`
  - 「入れなかった」「閉店」報告、または最終確認から12か月 → `needs_recheck`（AIが自動で再確認）
- 来店前の確認を促す注意書きを、スポット詳細に常に表示する

## AIの使い方

- 抽出は **Claude と OpenAI の両方** で行い、結果が一致した項目だけ確信度「高」。不一致は管理人の確認キュー（`review_queue`）へ
- 抽出結果には根拠URLと確信度を必ず保存する
- 投稿の不適切判定は OpenAI Moderation API ＋ Claude。迷うものだけ `review_queue` へ
- アプリ内のAIチャットはMVPでは作らない

## 環境変数（`.env.local`、コミットしない）

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # pipeline からのみ使用
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=  # HTTPリファラ制限をかける
GOOGLE_PLACES_API_KEY=            # サーバー側のみ
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
HOTPEPPER_API_KEY=
```

## 作業の進め方

- タスクは `TASKS.md` の順に進める。終わったらチェックを付ける
- 小さくコミットし、各フェーズの終わりに動作を確認してから次へ
- 迷ったら「引き算」。仕様にない機能は足さずに、TASKS.md の「あとで検討」に書く
