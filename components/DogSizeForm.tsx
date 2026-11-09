"use client";

import { useState } from "react";
import { DOG_SIZES, SIZE_LABEL, type DogSize } from "@/lib/domain";
import type { DogProfile } from "@/lib/hooks";

// うちの子設定（オンボーディングとマイページで共用）
export default function DogSizeForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: DogProfile | null;
  submitLabel: string;
  onSubmit: (profile: DogProfile) => void;
}) {
  const [size, setSize] = useState<DogSize | null>(initial?.size ?? null);
  const [name, setName] = useState(initial?.name ?? "");
  const [breed, setBreed] = useState(initial?.breed ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!size) {
      setError("サイズを選んでください");
      return;
    }
    onSubmit({ name: name.trim(), size, breed: breed.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-bold">うちの子のサイズ</legend>
        {DOG_SIZES.map((s) => (
          <label
            key={s}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-card)] border px-4 ${
              size === s ? "border-brand bg-surface" : "border-line bg-surface"
            }`}
          >
            <input
              type="radio"
              name="size"
              value={s}
              checked={size === s}
              onChange={() => {
                setSize(s);
                setError(null);
              }}
              className="h-5 w-5 accent-[var(--color-brand)]"
            />
            <span className="text-base">{SIZE_LABEL[s]}</span>
          </label>
        ))}
        {error ? <p className="text-sm text-ink">{error}</p> : null}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">名前（任意）</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className="min-h-11 panel px-3 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">犬種（任意）</span>
        <input
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
          maxLength={30}
          className="min-h-11 panel px-3 text-base"
        />
      </label>

      <button
        type="submit"
        className="btn btn-primary w-full"
      >
        {submitLabel}
      </button>
    </form>
  );
}
