"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type FeatureSlide = {
  kicker: string;
  title: string;
  href: string;
  image: string;
  tone: "light" | "dark";
};

// 特集バナーのスライダー。横にスワイプでき、5秒ごとに自動で進む（触っている間は止まる）。
export default function FeatureSlider({ slides }: { slides: FeatureSlide[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [index, setIndex] = useState(0);

  function go(i: number) {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  function onScroll() {
    const el = ref.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  useEffect(() => {
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      const el = ref.current;
      if (!el || el.clientWidth === 0) return;
      const current = Math.round(el.scrollLeft / el.clientWidth);
      const next = (current + 1) % slides.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  function pause() {
    pausedRef.current = true;
  }
  function resume() {
    setTimeout(() => {
      pausedRef.current = false;
    }, 4000);
  }

  return (
    <section aria-label="特集" className="relative" onPointerDown={pause} onPointerUp={resume} onPointerLeave={resume}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
      >
        {slides.map((sl) => (
          <Link
            key={sl.title}
            href={sl.href}
            className="relative aspect-[16/10] w-full shrink-0 snap-start overflow-hidden md:aspect-[16/5]"
          >
            {/* 特集の図。実在の場所の写真ではない */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sl.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className={`absolute left-0 top-0 p-5 md:p-10 ${sl.tone === "dark" ? "text-white" : "text-ink"}`}>
              <p className="text-xs font-bold tracking-wide">{sl.kicker}</p>
              <h2 className="mt-1 max-w-sm text-xl font-bold leading-snug md:text-3xl">{sl.title}</h2>
            </div>
          </Link>
        ))}
      </div>

      <div className="absolute bottom-3 right-4 flex gap-1.5" role="group" aria-label="特集の切り替え">
        {slides.map((sl, i) => (
          <button
            key={sl.title}
            type="button"
            aria-label={`${i + 1}枚目`}
            aria-current={index === i}
            onClick={() => go(i)}
            className={`h-2.5 w-2.5 rounded-full border border-ink ${index === i ? "bg-ink" : "bg-surface"}`}
          />
        ))}
      </div>
    </section>
  );
}
