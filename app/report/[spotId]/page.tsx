"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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
import { preparePhotoForUpload } from "@/lib/photo";
import { isLive } from "@/lib/supabase";

export default function ReportFormPage() {
  return (
    <Suspense fallback={<p className="p-4 text-ink-sub">読み込み中…</p>}>
      <ReportFormView />
    </Suspense>
  );
}

function ReportFormView() {
  const { spotId } = useParams<{ spotId: string }>();
  const router = useRouter();
  const { ready: profileReady, profile } = useDogProfile();
  const { ready: sessionReady, user } = useSession();

  // 報告はログインしてから（入力してから止められないように）
  useEffect(() => {
    if (sessionReady && !user) {
      router.replace(`/login?next=${encodeURIComponent(`/report/${spotId}`)}`);
    }
  }, [sessionReady, user, router, spotId]);
  const [spot, setSpot] = useState<Spot | null | undefined>(undefined);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [area, setArea] = useState<StayArea | "">("");
  const [comment, setComment] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    getSpot(spotId)
      .then((s) => {
        if (!active) return;
        setSpot(s);
      })
      .catch(() => active && setSpot(null));
    return () => {
      active = false;
    };
  }, [spotId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!result) {
      setError("「入れた・入れなかった・閉店」のどれかを選んでください");
      return;
    }
    // サイズは任意。登録されていれば自動で入れ、なければ空のまま送る
    const dogSize = profile?.size ?? null;
    if (photoFile && !photoConsent) {
      setError("写真を掲載してよいかの確認にチェックしてください");
      return;
    }
    if (!isLive()) {
      setError("サーバーに接続されていないため、報告できません。");
      return;
    }

    setSending(true);
    try {
      // 写真は縮小し、位置情報などのメタデータを取り除いてから送る
      const photo = photoFile ? await preparePhotoForUpload(photoFile) : null;
      await submitReport({
        spotId,
        result,
        dogSize,
        breed: profile?.breed || null,
        area: area || null,
        comment: comment.trim() || null,
        photo,
        photoConsent,
      });
      router.push(`/report/done?spot=${encodeURIComponent(spotId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信できませんでした");
      setSending(false);
    }
  }

  if (spot === undefined || !profileReady || !sessionReady || !user) {
    return <p className="p-4 text-ink-sub">読み込み中…</p>;
  }
  if (spot === null) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <p>スポットが見つかりませんでした。</p>
        <Link href="/report" className="mt-4 inline-block text-brand underline">
          報告先を選び直す
        </Link>
      </main>
    );
  }

  const results = Object.entries(RESULT_LABEL) as Array<[ReportResult, string]>;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-5">
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

        <div className="flex flex-col gap-2">
          <span className="text-base font-bold">写真（任意）</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setPhotoFile(file);
              setPhotoPreview(file ? URL.createObjectURL(file) : null);
              setPhotoConsent(false);
            }}
            className="text-sm"
          />
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="選んだ写真" className="h-40 w-full rounded-[var(--radius-card)] object-cover" />
          ) : null}
          {photoFile ? (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={photoConsent}
                onChange={(e) => setPhotoConsent(e.target.checked)}
                className="h-5 w-5 accent-[var(--color-brand)]"
              />
              掲載してよい写真です
            </label>
          ) : null}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-base font-bold">過ごし方（任意）</span>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as StayArea | "")}
            className="min-h-11 panel px-3 text-base"
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
          <span className="text-base font-bold">ひとこと（任意）</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={200}
            rows={3}
            className="panel px-3 py-2 text-base"
          />
        </label>

        {profile ? (
          <p className="text-sm text-ink-sub">
            うちの子：{SIZE_LABEL[profile.size]}
            {profile.breed ? `・${profile.breed}` : ""}
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
          className="btn btn-primary w-full disabled:opacity-60"
        >
          {sending ? "送信中…" : "報告を送る"}
        </button>
      </form>
    </main>
  );
}
