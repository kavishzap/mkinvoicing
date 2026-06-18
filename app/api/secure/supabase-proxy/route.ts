import { NextRequest, NextResponse } from "next/server";
import {
  decryptJson,
  deriveApiCryptoKey,
  encryptJson,
  resolveCryptoToken,
  type EncryptedPayload,
} from "@/lib/api-crypto";
import {
  type SecureSupabaseRequest,
  type SecureSupabaseResponse,
} from "@/lib/secure-supabase-types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get("authorization");
    const cryptoToken = resolveCryptoToken(authorization, anonKey);
    const key = await deriveApiCryptoKey(cryptoToken);

    const encryptedBody = (await req.json()) as EncryptedPayload;
    const envelope = await decryptJson<SecureSupabaseRequest>(
      key,
      encryptedBody,
    );

    if (
      !envelope.path.startsWith("/rest/") &&
      !envelope.path.startsWith("/auth/") &&
      !envelope.path.startsWith("/storage/") &&
      !envelope.path.startsWith("/functions/")
    ) {
      return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
    }

    const targetUrl = `${supabaseUrl.replace(/\/$/, "")}${envelope.path}`;
    const forwardHeaders = new Headers(envelope.headers);
    if (!forwardHeaders.has("apikey")) forwardHeaders.set("apikey", anonKey);
    if (authorization && !forwardHeaders.has("authorization")) {
      forwardHeaders.set("authorization", authorization);
    }

    const upstream = await fetch(targetUrl, {
      method: envelope.method,
      headers: forwardHeaders,
      body:
        envelope.body &&
        envelope.method !== "GET" &&
        envelope.method !== "HEAD"
          ? envelope.body
          : undefined,
      cache: "no-store",
    });

    const responseHeaders: Record<string, string> = {};
    upstream.headers.forEach((value, name) => {
      const lower = name.toLowerCase();
      if (
        lower === "content-type" ||
        lower === "content-range" ||
        lower.startsWith("x-") ||
        lower === "cache-control"
      ) {
        responseHeaders[name] = value;
      }
    });

    const payload: SecureSupabaseResponse = {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
      body: await upstream.text(),
    };

    const encryptedResponse = await encryptJson(key, payload);
    return NextResponse.json(encryptedResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Secure proxy failed",
      },
      { status: 400 },
    );
  }
}
