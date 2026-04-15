/**
 * Helpers for opening WhatsApp click-to-chat (text only; images must be attached manually).
 * @see https://faq.whatsapp.com/general/chats/how-to-use-click-to-chat
 */

/** Keep digits only. */
export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Builds international digits for wa.me (no + prefix).
 * Heuristic: leading 0 → Mauritius 230 + rest; otherwise use as-is if long enough.
 */
export function toWhatsAppDigits(phone: string): string | null {
  const raw = digitsOnly(phone.trim());
  if (!raw) return null;
  let d = raw;
  if (d.startsWith("0") && d.length >= 8 && d.length <= 11) {
    d = "230" + d.slice(1);
  }
  if (d.length < 8 || d.length > 15) return null;
  return d;
}

export function buildWhatsAppShareUrl(phoneDigits: string, message: string): string {
  const text = encodeURIComponent(message);
  return `https://wa.me/${phoneDigits}?text=${text}`;
}

export function openWhatsAppChat(phoneDigits: string, message: string): void {
  const url = buildWhatsAppShareUrl(phoneDigits, message);
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Download base64 image as a file so the user can attach it in WhatsApp. */
export function downloadBase64Image(
  base64: string,
  mimeType: string,
  filename: string
): void {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType || "image/png" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
