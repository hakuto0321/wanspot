"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import Icon from "@/components/Icon";

export default function ReportDonePage() {
  return (
    <Suspense fallback={<p className="p-4 text-ink-sub">読み込み中…</p>}>
      <Done />
    </Suspense>
  );
}

// 報告完了。少し待ってから詳細へ戻る（確認状況の更新を見られるように）
function Done() {
  const router = useRouter();
  const params = useSearchParams();
  const spotId = params.get("spot");
  const detail = spotId ? `/spots/${encodeURIComponent(spotId)}` : "/";

  useEffect(() => {
    const t = setTimeout(() => router.replace(detail), 3000);
    return () => clearTimeout(t);
  }, [detail, router]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-4 px-4 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-ink">
        <Icon name="check" className="h-8 w-8" />
      </span>
      <h1 className="text-2xl font-bold">報告を送りました</h1>
      <Link href={detail} className="mt-4 flex min-h-12 items-center rounded-[var(--radius-card)] bg-brand px-6 font-bold text-white">
        スポットの詳細に戻る
      </Link>
    </main>
  );
}
