"use client";

import { usePathname } from "next/navigation";
import Icon from "./Icon";

// 下部タブ（スマホのみ）：探す／お気に入り／報告する／マイページ
const TABS = [
  { href: "/", label: "探す", icon: "search" as const, match: (p: string) => p === "/" || p.startsWith("/search") || p.startsWith("/spots") },
  { href: "/favorites", label: "お気に入り", icon: "heart" as const, match: (p: string) => p.startsWith("/favorites") },
  { href: "/report", label: "報告する", icon: "pencil" as const, match: (p: string) => p.startsWith("/report") },
  { href: "/mypage", label: "マイページ", icon: "user" as const, match: (p: string) => p.startsWith("/mypage") || p.startsWith("/login") },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="下部メニュー"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <a
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "font-bold text-brand" : "text-ink-sub"
                }`}
              >
                <Icon name={tab.icon} className="h-6 w-6" />
                <span>{tab.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
