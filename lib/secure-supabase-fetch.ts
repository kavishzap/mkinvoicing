"use client";

import {
  decryptJson,
  deriveApiCryptoKey,
  encryptJson,
  resolveCryptoToken,
  type EncryptedPayload,
} from "@/lib/api-crypto";
import {
  isSecureApiEnabled,
  pickForwardHeaders,
  SECURE_PROXY_PATH,
  type SecureSupabaseRequest,
  type SecureSupabaseResponse,
} from "@/lib/secure-supabase-types";

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function resolveRequestInit(
  input: RequestInfo | URL,
  init?: RequestInit,
): RequestInit {
  if (input instanceof Request) {
    return {
      method: input.method,
      headers: input.headers,
      body: input.body,
      redirect: input.redirect,
      signal: init?.signal ?? input.signal,
      credentials: init?.credentials ?? input.credentials,
      cache: init?.cache ?? input.cache,
      mode: init?.mode ?? input.mode,
    };
  }
  return init ?? {};
}

async function readBodyText(body: BodyInit | null | undefined): Promise<string | null> {
  if (body == null) return null;
  if (typeof body === "string") return body;
  if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
  if (ArrayBuffer.isView(body)) {
    return new TextDecoder().decode(body);
  }
  if (body instanceof Blob) return body.text();
  return null;
}

export function createSecureSupabaseFetch(
  supabaseUrl: string,
  anonKey: string,
): typeof fetch {
  const normalizedBase = supabaseUrl.replace(/\/$/, "");

  return async (input, init) => {
    const url = resolveRequestUrl(input);
    if (!url.startsWith(normalizedBase) || !isSecureApiEnabled()) {
      return fetch(input, init);
    }

    const resolvedInit = resolveRequestInit(input, init);
    const method = (resolvedInit.method ?? "GET").toUpperCase();
    const headers = new Headers(resolvedInit.headers);
    if (!headers.has("apikey")) headers.set("apikey", anonKey);

    const path = url.slice(normalizedBase.length) || "/";
    const bodyText = await readBodyText(resolvedInit.body);

    const envelope: SecureSupabaseRequest = {
      method,
      path,
      headers: pickForwardHeaders(headers),
      body: bodyText,
    };

    const cryptoToken = resolveCryptoToken(
      headers.get("authorization"),
      anonKey,
    );
    const key = await deriveApiCryptoKey(cryptoToken);
    const encryptedRequest = await encryptJson(key, envelope);

    const proxyRes = await fetch(SECURE_PROXY_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: headers.get("authorization") ?? "",
        apikey: anonKey,
      },
      body: JSON.stringify(encryptedRequest satisfies EncryptedPayload),
      signal: resolvedInit.signal,
      credentials: "same-origin",
    });

    if (!proxyRes.ok) {
      return proxyRes;
    }

    const encryptedResponse = (await proxyRes.json()) as EncryptedPayload;
    const decrypted = await decryptJson<SecureSupabaseResponse>(
      key,
      encryptedResponse,
    );

    return new Response(decrypted.body, {
      status: decrypted.status,
      statusText: decrypted.statusText,
      headers: decrypted.headers,
    });
  };
}
