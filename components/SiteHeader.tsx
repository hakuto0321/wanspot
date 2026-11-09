import Link from "next/link";

// 全ページ共通のヘッダー。PC では主要メニューを横に並べ、スマホでは最小限にする。
export default function SiteHeader() {
  return (
    <header className="border-b border-line-soft bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Wan Spot ホーム">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-base font-bold text-white">
            W
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">Wan Spot</span>
        </Link>
        <nav aria-label="主要メニュー" className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/" className="text-ink hover:text-ink">探す</Link>
          <Link href="/favorites" className="text-ink hover:text-ink">お気に入り</Link>
          <Link href="/report" className="text-ink hover:text-ink">報告する</Link>
          <Link href="/requests" className="text-ink hover:text-ink">追加リクエスト</Link>
          <Link href="/mypage" className="btn btn-secondary min-h-9 px-4 text-sm">マイページ</Link>
        </nav>
      </div>
    </header>
  );
}
