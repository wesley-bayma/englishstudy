const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret) as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload) as unknown as BufferSource);
  return bytesToBase64Url(new Uint8Array(signature));
}

export function getAuthConfig(): { password: string; sessionSecret: string } | null {
  const password = process.env.APP_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!password || !sessionSecret || sessionSecret.length < 32) return null;
  return { password, sessionSecret };
}

export async function createSessionToken(sessionSecret: string, now = Date.now()): Promise<string> {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const nonce = new Uint8Array(24);
  crypto.getRandomValues(nonce);
  const payload = `${expiresAt}.${bytesToBase64Url(nonce)}`;
  const signature = await sign(sessionSecret, payload);
  return `v1.${payload}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined,
  sessionSecret: string,
  now = Date.now()
): Promise<boolean> {
  try {
    if (!token || token.length > 512) return false;
    const parts = token.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') return false;
    const expiresAt = Number(parts[1]);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return false;

    const payload = `${parts[1]}.${parts[2]}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(sessionSecret) as unknown as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    return await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(parts[3]) as unknown as BufferSource,
      new TextEncoder().encode(payload) as unknown as BufferSource
    );
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE = SESSION_TTL_SECONDS;
