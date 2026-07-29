import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './icons';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'link'; size?: 'default' | 'compact'; icon?: IconName }>(function Button({ variant = 'primary', size = 'default', icon, className = '', children, ...props }, ref) {
  return <button className={`btn btn-${variant} ${size === 'compact' ? 'btn-compact' : ''} ${className}`} ref={ref} {...props}>{icon ? <Icon name={icon} /> : null}{children}</button>;
});
