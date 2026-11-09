"use client";

import { useEffect } from "react";

// 本番ビルドでのみ Service Worker を登録する（開発中のキャッシュ混入を避ける）。
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 登録に失敗してもアプリは通常どおり動く
    });
  }, []);

  return null;
}
