"use client";

import { useRouter } from "next/navigation";
import DogSizeForm from "@/components/DogSizeForm";
import { useDogProfile } from "@/lib/hooks";

export default function OnboardingPage() {
  const router = useRouter();
  const { ready, profile, save } = useDogProfile();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-brand">うちの子のことを教えてください</h1>
        <p className="mt-2 text-base text-ink-sub">
          サイズに合わせて「入れるか」を表示します。あとからマイページで変えられます。
        </p>
      </div>
      {ready ? (
        <DogSizeForm
          initial={profile}
          submitLabel="はじめる"
          onSubmit={(p) => {
            save(p);
            router.replace("/");
          }}
        />
      ) : null}
    </main>
  );
}
