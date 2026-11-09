"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/hooks";
import { createPendingSpot } from "@/lib/repository";

// 報告の中でスポットを追加する。追加したスポットは、管理人が確認するまで公開されない。
export default function NewSpotReportPage() {
  const router = useRouter();
  const { ready, user } = useSession();
  const [name, setName] = useState("");
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/report/new");
  }, [ready, user, router]);

  function locate() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("この端末では現在地を使えません");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("現在地を使えませんでした。位置情報を許可してください。"),
      { timeout: 10000, maximumAge: 0 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!position) {
      setError("現在地を取得してください");
      return;
    }
    setBusy(true);
    try {
      const id = await createPendingSpot(name.trim(), position.lat, position.lng);
      router.replace(`/report/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加できませんでした");
      setBusy(false);
    }
  }

  if (!ready || !user) {
    return <p className="p-4 text-ink-sub">読み込み中…</p>;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-5">
      <header>
        <Link href="/report" className="text-sm text-ink-sub underline">
          報告先に戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold">スポットを追加して報告</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">スポット名</span>
          <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">場所</span>
          <button type="button" onClick={locate} className="btn btn-secondary w-fit">
            {position ? "現在地を取り直す" : "現在地を使う"}
          </button>
          {position ? <p className="text-sm">現在地を取得しました</p> : null}
        </div>

        {error ? (
          <p role="alert" className="border-l-4 border-ng-ink bg-ng-bg px-4 py-3 text-sm text-ng-ink">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-60">
          {busy ? "追加中…" : "追加して報告へ"}
        </button>
      </form>
    </main>
  );
}
