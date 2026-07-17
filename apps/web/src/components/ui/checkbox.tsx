import type { InputHTMLAttributes } from 'react';
export function Checkbox({ label, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) { return <label className="ui-checkbox"><input {...props} type="checkbox" /><span>{label}</span></label>; }
