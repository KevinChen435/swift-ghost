const encoder = new TextEncoder();

function fromHex(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  return Uint8Array.from(value.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

export function toHex(value: Uint8Array): string {
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signPayload(secret: string, timestamp: string, body: string): Promise<string> {
  return `sha256=${toHex(await hmac(secret, `${timestamp}.${body}`))}`;
}

export async function authenticateIngress(
  request: Request,
  rawBody: string,
  secrets: { hmac?: string; serviceToken?: string },
  nowSeconds = Math.floor(Date.now() / 1_000),
): Promise<boolean> {
  const authorization = request.headers.get("authorization");
  if (secrets.serviceToken && authorization?.startsWith("Bearer ")) {
    const provided = encoder.encode(authorization.slice(7));
    const expected = encoder.encode(secrets.serviceToken);
    if (constantTimeEqual(provided, expected)) return true;
  }
  if (!secrets.hmac) return false;
  const timestamp = request.headers.get("x-judge-timestamp");
  const signature = request.headers.get("x-judge-signature");
  if (!timestamp || !signature?.startsWith("sha256=")) return false;
  const numericTimestamp = Number(timestamp);
  if (!Number.isSafeInteger(numericTimestamp) || Math.abs(nowSeconds - numericTimestamp) > 300) return false;
  const provided = fromHex(signature.slice(7));
  if (!provided) return false;
  const expected = await hmac(secrets.hmac, `${timestamp}.${rawBody}`);
  return constantTimeEqual(provided, expected);
}
