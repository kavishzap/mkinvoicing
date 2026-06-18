/**
 * AES-GCM helpers for the encrypted Supabase proxy.
 * Uses Web Crypto (browser + Node 18+).
 */

export type EncryptedPayload = {
  iv: string;
  payload: string;
};

function getSalt(): string {
  return (
    process.env.NEXT_PUBLIC_API_ENCRYPTION_SALT ??
    "moledger-api-salt-set-in-env"
  );
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Web Crypto requires ArrayBuffer-backed views, not SharedArrayBuffer. */
function toBufferSource(bytes: Uint8Array): BufferSource {
  return Uint8Array.from(bytes);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function deriveApiCryptoKey(token: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(token),
    "HKDF",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode(getSalt()),
      info: enc.encode("moledger-secure-api-v1"),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(
  key: CryptoKey,
  value: unknown,
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );

  return {
    iv: toBase64(iv),
    payload: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJson<T>(
  key: CryptoKey,
  envelope: EncryptedPayload,
): Promise<T> {
  const iv = fromBase64(envelope.iv);
  const ciphertext = fromBase64(envelope.payload);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBufferSource(iv) },
    key,
    toBufferSource(ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export function resolveCryptoToken(
  authorizationHeader: string | null,
  anonKey: string,
): string {
  if (authorizationHeader?.startsWith("Bearer ")) {
    const token = authorizationHeader.slice(7).trim();
    if (token) return token;
  }
  return anonKey;
}
