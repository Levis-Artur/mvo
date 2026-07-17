'use client';

import { useState } from 'react';
import { Button, FormField, Input, Modal } from '@/components/ui';

export function TemporaryPasswordModal({ temporaryPassword, onClose }: { temporaryPassword: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return <Modal size="small" title="Тимчасовий пароль" onClose={onClose} footer={<Button type="button" onClick={onClose}>Закрити</Button>}>
    <div className="grid gap-4">
      <div className="ui-alert" data-tone="warning"><strong>Збережіть пароль зараз</strong><span>Він показується лише один раз і не зберігається у браузері.</span></div>
      <FormField label="Пароль"><div className="flex flex-col gap-2 sm:flex-row"><Input readOnly className="font-mono" value={temporaryPassword} /><Button variant="outline" type="button" onClick={() => { void navigator.clipboard.writeText(temporaryPassword); setCopied(true); }}>{copied ? 'Скопійовано' : 'Копіювати'}</Button></div></FormField>
    </div>
  </Modal>;
}
