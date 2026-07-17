import { Card } from './card';
import { Icon, type IconName } from './icons';

export function MetricCard({ label, value, icon, tone = 'primary' }: { label: string; value: number; icon: IconName; tone?: 'primary' | 'warning' | 'danger' }) {
  return <Card className="metric-card"><p className="metric-card__label">{label}</p><div className="flex items-center justify-center gap-3" style={{ color: tone === 'warning' ? 'var(--color-warning)' : tone === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)' }}><Icon name={icon} /><p className="metric-card__value" style={{ color: 'inherit' }}>{value}</p></div></Card>;
}
