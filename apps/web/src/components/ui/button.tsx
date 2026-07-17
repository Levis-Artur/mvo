import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './icons';

export function Button({ variant = 'primary', icon, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'link'; icon?: IconName }) {
  return <button className={`btn btn-${variant} ${className}`} {...props}>{icon ? <Icon name={icon} /> : null}{children}</button>;
}
