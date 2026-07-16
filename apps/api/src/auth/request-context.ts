import type { AuthenticatedRequest } from './auth.types';

export function getRequestContext(request: AuthenticatedRequest) {
  return {
    ipAddress: clientIp(request),
    userAgent: firstHeaderValue(request.headers['user-agent']),
    requestId: request.requestId,
  };
}

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function clientIp(request: AuthenticatedRequest): string | undefined {
  const forwardedFor = request.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0]?.trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor[0]) {
    return forwardedFor[0];
  }

  return request.ip;
}
