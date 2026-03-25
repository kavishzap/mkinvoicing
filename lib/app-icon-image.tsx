import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Favicon / PWA icon: black canvas, rounded shape, centered logo from public/logo1.png */
export async function appIconImageResponse(sizePx: number) {
  const buf = await readFile(join(process.cwd(), "public/logo1.png"));
  const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  const pad = Math.round(sizePx * 0.1);
  const inner = sizePx - pad * 2;
  const radius = Math.round(sizePx * 0.22);

  return new ImageResponse(
    (
      <div
        style={{
          width: sizePx,
          height: sizePx,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
          borderRadius: radius,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by @vercel/og, not the Next.js Image component */}
        <img
          src={dataUrl}
          alt=""
          width={inner}
          height={inner}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    { width: sizePx, height: sizePx }
  );
}
