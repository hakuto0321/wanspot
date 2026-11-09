"use client";

import { APIProvider, AdvancedMarker, Map } from "@vis.gl/react-google-maps";
import type { Spot } from "@/lib/domain";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Google マップ上にスポットを置く。キー未設定のときは案内だけ出す。
// Google の場所情報は地図の上でだけ表示し、帰属表示は Google マップ側が出す。
export default function SpotMap({
  center,
  spots,
}: {
  center: { lat: number; lng: number };
  spots: Spot[];
}) {
  if (!KEY) {
    return (
      <div className="flex h-56 items-center justify-center rounded-[var(--radius-card)] border border-line bg-surface p-4 text-center text-sm text-ink-sub">
        地図は準備中です（Google Maps の API キーが未設定）。下の一覧から探せます。
      </div>
    );
  }

  return (
    <APIProvider apiKey={KEY} language="ja" region="JP">
      <div className="h-64 overflow-hidden rounded-[var(--radius-card)] border border-line">
        <Map
          defaultCenter={center}
          defaultZoom={12}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? "DEMO_MAP_ID"}
          gestureHandling="greedy"
          disableDefaultUI
          style={{ width: "100%", height: "100%" }}
        >
          {spots.map((s) => (
            <AdvancedMarker key={s.id} position={{ lat: s.lat, lng: s.lng }} title={s.name}>
              <a
                href={`/spots/${s.id}`}
                aria-label={s.name}
                className="block h-4 w-4 rounded-full border-2 border-white bg-brand shadow-none"
              />
            </AdvancedMarker>
          ))}
        </Map>
      </div>
    </APIProvider>
  );
}
