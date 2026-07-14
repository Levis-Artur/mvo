import type { CookieOptions, Request, Response } from 'express';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from './auth.constants';

export function sessionCookieOptions(expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    maxAge: expiresAt ? undefined : SESSION_TTL_MS,
  };
}

export function setSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;

  const cookies = header.split(';');
  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = cookie.slice(0, separatorIndex).trim();
    if (key !== name) continue;

    return decodeURIComponent(cookie.slice(separatorIndex + 1).trim());
  }

  return undefined;
}

