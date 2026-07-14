import type { Request } from 'express';

export function getRequestContext(request: Request) {
  return {
    ipAddress: clientIp(request),
    userAgent: firstHeaderValue(request.headers['user-agent']),
    requestId: firstHeaderValue(request.headers['x-request-id']),
  };
}

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function clientIp(request: Request): string | undefined {
  const forwardedFor = request.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0]?.trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor[0]) {
    return forwardedFor[0];
  }

  return request.ip;
}
