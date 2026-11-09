import { NextResponse } from "next/server";

// 営業時間・電話番号を表示時に Places API から取得する（保存しない。CLAUDE.md）。
// API キーはサーバー側だけで使い、クライアントには渡さない。
const ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;

type PlaceDetails = {
  nationalPhoneNumber?: string;
  businessStatus?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ configured: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "nationalPhoneNumber,businessStatus,regularOpeningHours.weekdayDescriptions",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ configured: true, error: true }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const details = (await res.json()) as PlaceDetails;
  return NextResponse.json(
    {
      configured: true,
      phone: details.nationalPhoneNumber ?? null,
      businessStatus: details.businessStatus ?? null,
      hours: details.regularOpeningHours?.weekdayDescriptions ?? [],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
