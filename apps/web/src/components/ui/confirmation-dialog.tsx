'use client';
import { useState } from 'react';
import { Button } from './button';
import { ErrorState } from './error-state';
import { Input } from './input';
import { Modal } from './modal';
import { isConfirmationValid } from './confirmation-model';
export function ConfirmationDialog({ title, message, confirmation, destructive = false, loading = false, error = '', onConfirm, onClose }: { title: string; message: string; confirmation?: string; destructive?: boolean; loading?: boolean; error?: string; onConfirm: () => void; onClose: () => void }) { const [value, setValue] = useState(''); const valid = !confirmation || isConfirmationValid(value, confirmation); return <Modal closeOnEscape={!loading} destructive={destructive} footer={<><Button disabled={loading} variant="outline" type="button" onClick={onClose}>Скасувати</Button><Button disabled={loading || !valid} variant={destructive ? 'danger' : 'primary'} type="button" onClick={onConfirm}>{loading ? 'Виконання…' : 'Підтвердити'}</Button></>} size="small" title={title} onClose={onClose}><div className="grid gap-3"><p>{message}</p>{confirmation ? <label className="form-field"><span className="form-field__label">Введіть «{confirmation}»</span><Input autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} /></label> : null}{error ? <ErrorState message={error} /> : null}</div></Modal>; }
