/** jsPDF `addImage` supports PNG and JPEG reliably. */
export type JsPdfImageFormat = "PNG" | "JPEG";

export type JsPdfLoadedImage = {
  dataUrl: string;
  fmt: JsPdfImageFormat;
  naturalWidth: number;
  naturalHeight: number;
};

export function resolvePdfImageUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (
    t.startsWith("data:") ||
    t.startsWith("http://") ||
    t.startsWith("https://") ||
    t.startsWith("blob:")
  ) {
    return t;
  }
  if (t.startsWith("/") && typeof window !== "undefined") {
    return `${window.location.origin}${t}`;
  }
  return t;
}

/** Scale image to fit inside a box while preserving aspect ratio. */
export function fitImageToPdfBox(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const nw = Math.max(1, naturalWidth);
  const nh = Math.max(1, naturalHeight);
  const scale = Math.min(maxWidth / nw, maxHeight / nh);
  return { width: nw * scale, height: nh * scale };
}

function formatFromDataUrlMime(mime: string): JsPdfImageFormat | "rasterize" {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "PNG";
  if (m.includes("jpeg") || m.includes("jpg")) return "JPEG";
  return "rasterize";
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

function imageElementToJsPdfPayload(img: HTMLImageElement): JsPdfLoadedImage {
  const naturalWidth = Math.max(1, img.naturalWidth);
  const naturalHeight = Math.max(1, img.naturalHeight);
  const src = img.src;

  if (src.startsWith("data:image/")) {
    const semi = src.indexOf(";");
    const mime = semi > 5 ? src.slice(5, semi) : "image/png";
    const kind = formatFromDataUrlMime(mime);
    if (kind !== "rasterize") {
      return { dataUrl: src, fmt: kind, naturalWidth, naturalHeight };
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = naturalWidth;
  canvas.height = naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not rasterize image");
  }
  ctx.drawImage(img, 0, 0);
  return {
    dataUrl: canvas.toDataURL("image/png"),
    fmt: "PNG",
    naturalWidth,
    naturalHeight,
  };
}

/**
 * Loads a logo (or any image) for jsPDF with natural dimensions for aspect-ratio sizing.
 */
export async function loadImageForJsPdf(
  url: string,
): Promise<JsPdfLoadedImage | undefined> {
  const resolved = resolvePdfImageUrl(url);
  if (!resolved) return undefined;

  try {
    const img = await loadHtmlImage(resolved);
    return imageElementToJsPdfPayload(img);
  } catch {
    /* fall through */
  }

  try {
    const res = await fetch(resolved, { cache: "force-cache", mode: "cors" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    try {
      const img = await loadHtmlImage(blobUrl);
      return imageElementToJsPdfPayload(img);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch {
    return undefined;
  }
}

/** Max logo size in document PDF header bars (pt). */
export const PDF_HEADER_LOGO_MAX_W = 140;
export const PDF_HEADER_LOGO_MAX_H = 46;
export const PDF_HEADER_LOGO_TOP = 14;

export function pdfLogoDrawSize(logo: JsPdfLoadedImage | null | undefined) {
  if (!logo?.dataUrl) return null;
  return fitImageToPdfBox(
    logo.naturalWidth,
    logo.naturalHeight,
    PDF_HEADER_LOGO_MAX_W,
    PDF_HEADER_LOGO_MAX_H,
  );
}

export function pdfHeaderTextX(
  margin: number,
  logo: JsPdfLoadedImage | null | undefined,
) {
  const size = pdfLogoDrawSize(logo);
  return size ? margin + size.width + 12 : margin + 60;
}

export function addPdfHeaderLogo(
  doc: import("jspdf").jsPDF,
  logo: JsPdfLoadedImage | null | undefined,
  x: number,
) {
  const size = pdfLogoDrawSize(logo);
  if (!logo?.dataUrl || !size) return;
  const y = PDF_HEADER_LOGO_TOP + (PDF_HEADER_LOGO_MAX_H - size.height) / 2;
  doc.addImage(logo.dataUrl, logo.fmt, x, y, size.width, size.height, undefined, "FAST");
}

export function resolveDocumentPdfLogo(opts: {
  logoSrc?: string;
  profileLogoUrl?: string;
  snapshotLogoUrl?: string;
  brandingLogoUrl?: string;
}): string {
  const fallback =
    typeof window !== "undefined"
      ? `${window.location.origin}/kredence.png`
      : "/kredence.png";
  const pick = (v?: string) => String(v ?? "").trim();
  return (
    pick(opts.logoSrc) ||
    pick(opts.profileLogoUrl) ||
    pick(opts.snapshotLogoUrl) ||
    pick(opts.brandingLogoUrl) ||
    fallback
  );
}
