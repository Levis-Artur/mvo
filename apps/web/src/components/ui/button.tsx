import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './icons';

export function Button({ variant = 'primary', size = 'default', icon, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'link'; size?: 'default' | 'compact'; icon?: IconName }) {
  return <button className={`btn btn-${variant} ${size === 'compact' ? 'btn-compact' : ''} ${className}`} {...props}>{icon ? <Icon name={icon} /> : null}{children}</button>;
}
