import type { MouseEventHandler } from 'react';
import { Icon, type IconName } from './icons';
export type ActionListItem = { label: string; description: string; href: string; icon: IconName; onClick?: MouseEventHandler<HTMLAnchorElement> };
export function ActionList({ items }: { items: ActionListItem[] }) { return <div className="action-list">{items.map((item) => <a className="action-list__item" href={item.href} key={item.href} onClick={item.onClick}><Icon name={item.icon} /><span><strong className="block">{item.label}</strong><small className="text-[var(--color-text-secondary)]">{item.description}</small></span><Icon name="arrow" /></a>)}</div>; }
