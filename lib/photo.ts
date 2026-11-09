// 報告写真の前処理（ブラウザ内で行う）。
// キャンバスに描き直して JPEG にするので、撮影位置（EXIF の GPS）などのメタデータは残らない。
// 長辺を 1280px までに縮小し、通信量とストレージの容量を抑える。

const MAX_EDGE = 1280;
const QUALITY = 0.85;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 元ファイルの上限（10MB）

export async function preparePhotoForUpload(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選んでください");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("写真は10MB以下にしてください");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("写真を処理できませんでした");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY)
  );
  if (!blob) throw new Error("写真を処理できませんでした");
  return blob;
}
