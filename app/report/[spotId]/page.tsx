"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use, useEffect, useState } from "react";
import {
  AREA_LABEL,
  RESULT_LABEL,
  SIZE_LABEL,
  STAY_AREAS,
  type ReportResult,
  type Spot,
  type StayArea,
} from "@/lib/domain";
import { useDogProfile, useSession } from "@/lib/hooks";
import { getSpot, submitReport } from "@/lib/repository";
import { isLive } from "@/lib/supabase";

// ログイン前に入力を失わないための一時保存（この端末のタブ内だけ）
const DRAFT_KEY = "wanspot:report-draft";
type Draft = { spotId: string; result: ReportResult | null; area: StayArea | ""; comment: string };

function readDraft(spotId: string): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d.spotId === spotId ? d : null;
  } catch {
    return null;
  }
}

export default function ReportFormPage({ params }: { params: Promise<{ spotId: string }> }) {
  return (
    <Suspense fallback={<p className="p-4 text-ink-sub">読み込み中…</p>}>
      <ReportFormView params={params} />
    </Suspense>
  );
}

function ReportFormView({ params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = use(params);
  const router = useRouter();
  const { ready: profileReady, profile } = useDogProfile();
  const { ready: sessionReady, user } = useSession();
  const [spot, setSpot] = useState<Spot | null | undefined>(undefined);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [area, setArea] = useState<StayArea | "">("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    getSpot(spotId)
      .then((s) => {
        if (!active) return;
        setSpot(s);
        // 送信前にログインへ移った場合は、入力を元に戻す
        const draft = readDraft(spotId);
        if (draft) {
          setResult(draft.result);
          setArea(draft.area);
          setComment(draft.comment);
        }
      })
      .catch(() => active && setSpot(null));
    return () => {
      active = false;
    };
  }, [spotId]);

  useEffect(() => {
    if (profileReady && !profile) router.replace("/onboarding");
  }, [profileReady, profile, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!result) {
      setError("「入れた・入れなかった・閉店」のどれかを選んでください");
      return;
    }
    if (!profile) return;
    if (!isLive()) {
      setError("サーバーに接続されていないため、報告できません。");
      return;
    }

    // 初めて送るときだけログインを求める。入力は一時保存して戻す。
    if (!user) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ spotId, result, area, comment } satisfies Draft));
      router.push(`/login?next=${encodeURIComponent(`/report/${spotId}`)}`);
      return;
    }

    setSending(true);
    try {
      await submitReport({
        spotId,
        result,
        dogSize: profile.size,
        breed: profile.breed || null,
        area: area || null,
        comment: comment.trim() || null,
      });
      sessionStorage.removeItem(DRAFT_KEY);
      router.push(`/report/done?spot=${encodeURIComponent(spotId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信できませんでした");
      setSending(false);
    }
  }

  if (spot === undefined || !profileReady || !sessionReady) {
    return <p className="p-4 text-ink-sub">読み込み中…</p>;
  }
  if (spot === null) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <p>スポットが見つかりませんでした。</p>
        <Link href="/report" className="mt-4 inline-block text-brand underline">
          報告先を選び直す
        </Link>
      </main>
    );
  }

  const results = Object.entries(RESULT_LABEL) as Array<[ReportResult, string]>;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5">
      <header>
        <Link href={`/spots/${spotId}`} className="text-sm text-ink-sub underline">
          スポットの詳細に戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold leading-snug">{spot.name}</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-base font-bold">結果</legend>
          {results.map(([value, label]) => (
            <label
              key={value}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-card)] border px-4 ${
                result === value ? "border-brand bg-ok-bg" : "border-line bg-surface"
              }`}
            >
              <input
                type="radio"
                name="result"
                value={value}
                checked={result === value}
                onChange={() => setResult(value)}
                className="h-5 w-5 accent-[var(--color-brand)]"
              />
              <span className="text-base">{label}</span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-base font-bold">どこで過ごしたか（任意）</span>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as StayArea | "")}
            className="min-h-11 rounded-[var(--radius-card)] border border-line bg-surface px-3 text-base"
          >
            <option value="">選ばない</option>
            {STAY_AREAS.map((a) => (
              <option key={a} value={a}>
                {AREA_LABEL[a]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-base font-bold">ひとこと（任意・200文字まで）</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={200}
            rows={3}
            className="rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2 text-base"
          />
        </label>

        {profile ? (
          <p className="text-sm text-ink-sub">
            うちの子：{SIZE_LABEL[profile.size]}
            {profile.breed ? `・${profile.breed}` : ""}（自動で入ります）
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-[var(--radius-card)] bg-ng-bg p-3 text-sm text-ng-ink">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={sending}
          className="min-h-12 rounded-[var(--radius-card)] bg-brand px-4 text-base font-bold text-white disabled:opacity-60"
        >
          {sending ? "送信中…" : "報告を送る"}
        </button>
        <p className="text-sm text-ink-sub">
          報告は確認したあとに反映されます。すぐには表示が変わらないことがあります。
        </p>
      </form>
    </main>
  );
}
