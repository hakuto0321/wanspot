import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wan Spot",
    short_name: "Wan Spot",
    description: "犬連れで入れるかを、うちの子のサイズで探せるスポット検索。",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f4ef",
    theme_color: "#2e6a4c",
    lang: "ja",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
