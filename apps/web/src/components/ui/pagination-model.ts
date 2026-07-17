export const SUPPORTED_PAGE_LIMITS = [20, 50, 100] as const;
export function normalizePageLimit(limit: number) { return SUPPORTED_PAGE_LIMITS.includes(limit as 20 | 50 | 100) ? limit : Math.min(100, Math.max(20, limit)); }
