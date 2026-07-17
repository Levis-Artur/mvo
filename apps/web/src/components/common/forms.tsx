'use client';
import { Button, FormField, Modal as UiModal, Select as UiSelect } from '@/components/ui';

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <UiModal title={title} onClose={onClose}>{children}</UiModal>; }
export function Field({ label, children }: { label: string; children: React.ReactNode }) { return <FormField label={label}>{children}</FormField>; }
export function Select({ value, onChange, children, required }: { value: string; onChange: (value: string) => void; children: React.ReactNode; required?: boolean }) { return <UiSelect required={required} value={value} onChange={(event) => onChange(event.target.value)}>{children}</UiSelect>; }
export function FormActions({ saving, onClose }: { saving: boolean; onClose: () => void }) { return <div className="form-actions"><Button variant="outline" type="button" onClick={onClose}>Скасувати</Button><Button disabled={saving} type="submit">{saving ? 'Збереження…' : 'Зберегти'}</Button></div>; }
