import { appIconImageResponse } from "@/lib/app-icon-image";

export const runtime = "nodejs";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon() {
  return appIconImageResponse(512);
}
