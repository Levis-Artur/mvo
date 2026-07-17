import type { SVGProps } from 'react';

export type IconName =
  | 'home' | 'people' | 'structure' | 'box' | 'database' | 'upload'
  | 'journal' | 'transfer' | 'users' | 'settings' | 'shield' | 'check'
  | 'warning' | 'refresh' | 'profile' | 'logout' | 'arrow' | 'building';

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
  people: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M15 15c3.5 0 5 1.5 5 4"/></>,
  structure: <><path d="M12 4v5M5 13V9h14v4"/><rect x="2" y="13" width="6" height="6"/><rect x="9" y="13" width="6" height="6"/><rect x="16" y="13" width="6" height="6"/></>,
  box: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
  upload: <><path d="M12 16V3M7 8l5-5 5 5"/><path d="M4 14v6h16v-6"/></>,
  journal: <><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h8M8 11h8M8 15h6"/></>,
  transfer: <><path d="M4 7h14M14 3l4 4-4 4M20 17H6M10 13l-4 4 4 4"/></>,
  users: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 20c0-4 2-6 6-6M22 20c0-4-2-6-5-6M8 20c0-4 1.5-6 4-6s4 2 4 6"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.8-1L14.4 3h-4.8l-.3 3.1a7 7 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.8 1l.3 3.1h4.8l.3-3.1a7 7 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z"/></>,
  shield: <path d="M12 3 4 6v5c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3Z"/>,
  check: <path d="m5 12 4 4L19 6"/>, warning: <><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/></>,
  refresh: <><path d="M20 6v5h-5"/><path d="M19 11a8 8 0 1 0 1 5"/></>,
  profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-7 8-7s8 2 8 7"/></>, logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10"/></>,
  arrow: <path d="m9 5 7 7-7 7"/>, building: <><path d="M4 21V8l8-5 8 5v13M2 21h20M8 11h2M14 11h2M8 15h2M14 15h2"/></>,
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20" {...props}>{paths[name]}</svg>;
}
