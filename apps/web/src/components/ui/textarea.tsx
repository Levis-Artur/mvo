import type { TextareaHTMLAttributes } from 'react';
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={`input ui-textarea ${props.className ?? ''}`} />; }
