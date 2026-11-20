import crypto from 'crypto';

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
export const TEACHER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSessionSecret(overrideSecret?: string): string {
  if (overrideSecret) return overrideSecret;
  return (
    process.env.SESSION_SECRET ||
    process.env.MONGODB_URI ||
    'smart-school-teacher-session-fallback-v1'
  );
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function isValidObjectIdString(value?: string | null): value is string {
  return typeof value === 'string' && OBJECT_ID_REGEX.test(value.trim());
}

export function createTeacherSessionToken(
  classId: string,
  nowMs: number = Date.now(),
  overrideSecret?: string
): string {
  const cleanId = (classId || '').trim();
  const expiresAt = nowMs + TEACHER_SESSION_TTL_MS;
  const payload = `${cleanId}.${expiresAt}`;
  const signature = signPayload(payload, getSessionSecret(overrideSecret));
  return `${payload}.${signature}`;
}

export function verifyTeacherSessionToken(
  token?: string | null,
  nowMs: number = Date.now(),
  overrideSecret?: string
): string | null {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;

  const [classId, expiresAtStr, providedSig] = parts;
  if (!isValidObjectIdString(classId)) return null;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) return null;

  if (!/^[a-fA-F0-9]{64}$/.test(providedSig)) return null;

  const expectedSig = signPayload(
    `${classId}.${expiresAtStr}`,
    getSessionSecret(overrideSecret)
  );

  const providedBuf = Buffer.from(providedSig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  return classId;
}

/**
 * Resolves the authenticated teacher classId from either:
 * 1) HttpOnly cookie (`teacher_session`) - supports both signed tokens and legacy raw ObjectIds.
 * 2) Client-supplied HMAC-signed token (fallback when third-party cookies are blocked in cross-site iframes).
 *    Raw unsigned ObjectIds are NEVER accepted via `clientToken`.
 */
export function resolveTeacherClassId(
  cookieValue?: string | null,
  clientToken?: string | null,
  nowMs: number = Date.now(),
  overrideSecret?: string
): string | null {
  if (cookieValue && typeof cookieValue === 'string') {
    const trimmedCookie = cookieValue.trim();
    const verifiedCookie = verifyTeacherSessionToken(
      trimmedCookie,
      nowMs,
      overrideSecret
    );
    if (verifiedCookie) return verifiedCookie;
    if (isValidObjectIdString(trimmedCookie)) return trimmedCookie;
  }

  if (clientToken && typeof clientToken === 'string') {
    return verifyTeacherSessionToken(clientToken, nowMs, overrideSecret);
  }

  return null;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
