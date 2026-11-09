import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Zen_Kaku_Gothic_New } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import SiteHeader from "@/components/SiteHeader";
import TabBar from "@/components/TabBar";
import "./globals.css";

const zenKakuGothic = Zen_Kaku_Gothic_New({
  variable: "--font-zen-kaku",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wan Spot",
  description: "犬連れで行けるスポットを、うちの子のサイズで探せます。",
  applicationName: "Wan Spot",
};

export const viewport: Viewport = {
  themeColor: "#2e6a4c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${zenKakuGothic.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col pb-20 md:pb-10">{children}</div>
        <Suspense fallback={null}>
          <TabBar />
        </Suspense>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
