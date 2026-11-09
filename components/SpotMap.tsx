"use client";

import { APIProvider, AdvancedMarker, Map } from "@vis.gl/react-google-maps";
import type { Spot } from "@/lib/domain";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// 地図が使える（API キーがある）かどうか
export const isMapEnabled = (): boolean => Boolean(KEY);

// Google マップ上にスポットを置く。マーカーを押すと選択され、onSelect に ID を返す。
// キー未設定のときは案内だけ出す（一覧で同じ情報を見られる）。
// Google の場所情報は地図の上でだけ表示し、帰属表示は Google マップ側が出す。
export default function SpotMap({
  center,
  spots,
  selectedId = null,
  onSelect,
  variant = "compact",
}: {
  center: { lat: number; lng: number };
  spots: Spot[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  variant?: "compact" | "large";
}) {
  const heightClass =
    variant === "large" ? "h-[60vh] min-h-72 md:h-[70vh]" : "h-56 md:h-64";

  if (!KEY) {
    return (
      <div
        className={`flex items-center justify-center panel p-4 text-center text-sm text-ink-sub ${
          variant === "large" ? "h-48" : "h-32 md:h-56"
        }`}
      >
        地図は準備中です
      </div>
    );
  }

  return (
    <APIProvider apiKey={KEY} language="ja" region="JP">
      <div className={`${heightClass} overflow-hidden rounded-[var(--radius-card)] border border-line`}>
        <Map
          defaultCenter={center}
          defaultZoom={variant === "large" ? 10 : 12}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? "DEMO_MAP_ID"}
          gestureHandling="greedy"
          disableDefaultUI
          style={{ width: "100%", height: "100%" }}
        >
          {spots.map((s) => {
            const selected = s.id === selectedId;
            return (
              <AdvancedMarker
                key={s.id}
                position={{ lat: s.lat, lng: s.lng }}
                title={s.name}
                onClick={() => onSelect?.(s.id)}
              >
                <span
                  role="button"
                  aria-label={s.name}
                  aria-pressed={selected}
                  className={`block rounded-full border-2 border-white ${
                    selected ? "h-5 w-5 bg-ink" : "h-4 w-4 bg-brand"
                  }`}
                />
              </AdvancedMarker>
            );
          })}
        </Map>
      </div>
    </APIProvider>
  );
}
