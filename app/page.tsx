export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold text-brand">Wan Spot</h1>
      <p className="text-base text-ink-sub">
        うちの子のサイズで入れるスポットを探せるアプリを準備しています。
      </p>
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <p className="text-base">
          <span className="rounded-md bg-unverified/10 px-2 py-0.5 text-unverified">
            確認状況：準備中
          </span>
        </p>
        <p className="mt-2 text-sm text-ink-sub">
          掲載情報は来店前に、店舗・施設の公式情報でご確認ください。
        </p>
      </section>
    </main>
  );
}
