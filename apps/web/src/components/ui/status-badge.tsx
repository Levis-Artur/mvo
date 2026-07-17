export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export function StatusBadge({ children, tone = 'neutral', dot = false }: { children: React.ReactNode; tone?: StatusTone; dot?: boolean }) {
  return <span className="status-badge" data-tone={tone}>{dot ? <span aria-hidden="true">●</span> : null}{children}</span>;
}
