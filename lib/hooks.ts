"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { type DogSize, type Spot, isDogSize } from "./domain";
import { getSessionUser, type SessionUser } from "./repository";
import { getSupabase } from "./supabase";

// --- 端末の保存領域（localStorage）を React から読むための共通処理 ---

// 同じタブ内の書き込みを購読者へ知らせる（storage イベントは別タブ向け）
const localListeners = new Set<() => void>();

function subscribeLocal(callback: () => void) {
  localListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    localListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function notifyLocal() {
  localListeners.forEach((l) => l());
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 保存できなくても画面は動かす
  }
  notifyLocal();
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// サーバーでは false、クライアントの初回描画後に true（ハイドレーション後の判定）
const noopSubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

function useRawStorage(key: string): string | null {
  return useSyncExternalStore(
    subscribeLocal,
    () => readRaw(key),
    () => null
  );
}

// --- うちの子（端末に保存。登録不要） ---

export type DogProfile = {
  name: string;
  size: DogSize;
  breed: string;
};

const DOG_KEY = "wanspot:dog";

export function useDogProfile() {
  const ready = useMounted();
  const raw = useRawStorage(DOG_KEY);

  const profile = useMemo<DogProfile | null>(() => {
    const saved = parseJson<Partial<DogProfile>>(raw);
    if (!saved || !isDogSize(saved.size)) return null;
    return { name: saved.name ?? "", size: saved.size, breed: saved.breed ?? "" };
  }, [raw]);

  const save = useCallback((next: DogProfile) => {
    writeRaw(DOG_KEY, JSON.stringify(next));
  }, []);

  return { ready, profile, save };
}

// --- お気に入り（オフラインでも見られるようスポットの写しを保存） ---

const FAV_KEY = "wanspot:favorites";

export function useFavorites() {
  const ready = useMounted();
  const raw = useRawStorage(FAV_KEY);
  const items = useMemo<Spot[]>(() => parseJson<Spot[]>(raw) ?? [], [raw]);

  const isFavorite = useCallback((id: string) => items.some((s) => s.id === id), [items]);

  const toggle = useCallback(
    (spot: Spot) => {
      const current = parseJson<Spot[]>(readRaw(FAV_KEY)) ?? [];
      const exists = current.some((s) => s.id === spot.id);
      const next = exists
        ? current.filter((s) => s.id !== spot.id)
        : [...current, { ...spot, distanceM: undefined }];
      writeRaw(FAV_KEY, JSON.stringify(next));
    },
    []
  );

  return { ready, items, isFavorite, toggle };
}

// --- ログイン状態 ---

export function useSession() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;
    getSessionUser()
      .then((u) => {
        if (active) setUser(u);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    const sb = getSupabase();
    const { data } = sb
      ? sb.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ? { email: session.user.email ?? null } : null);
        })
      : { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { ready, user };
}
