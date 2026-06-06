/*
 * Screenshot persistence (Build-Spec §1 — provider URLs expire; reports must
 * stay reachable). Persists to Vercel Blob when BLOB_READ_WRITE_TOKEN is set;
 * otherwise inlines as a data URL (fine for local dev, heavy but functional).
 * Screenshots are JPEG (see render.ts).
 */

import { put } from "@vercel/blob";
import { hasBlob, readEnv } from "@/lib/analysis/config";

export async function persistScreenshot(
  jpeg: Buffer,
  key: string,
): Promise<string> {
  if (!hasBlob()) {
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  }
  const env = readEnv();
  const { url } = await put(`conversionscan/${key}.jpg`, jpeg, {
    access: "public",
    contentType: "image/jpeg",
    token: env.blobToken,
    addRandomSuffix: true,
  });
  return url;
}
