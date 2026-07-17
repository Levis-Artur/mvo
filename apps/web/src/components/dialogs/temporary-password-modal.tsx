'use client';

import { useState } from 'react';
import { Button, ErrorState, FormField, Input, Modal } from '@/components/ui';
import { copyToClipboard } from '@/lib/copy-to-clipboard';

export function TemporaryPasswordModal({ temporaryPassword, onClose }: { temporaryPassword: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  return <Modal size="small" title="Тимчасовий пароль" onClose={onClose} footer={<Button type="button" onClick={onClose}>Закрити</Button>}>
    <div className="grid gap-4">
      <div className="ui-alert" data-tone="warning"><strong>Збережіть пароль зараз</strong><span>Він показується лише один раз і не зберігається у браузері.</span></div>
      {copyError ? <ErrorState message={copyError} /> : null}
      <FormField label="Пароль"><div className="flex flex-col gap-2 sm:flex-row"><Input readOnly className="font-mono" value={temporaryPassword} /><Button variant="outline" type="button" onClick={() => { void copyToClipboard(temporaryPassword).then((success) => { setCopied(success); setCopyError(success ? '' : 'Не вдалося скопіювати пароль. Скопіюйте його вручну.'); }); }}>{copied ? 'Скопійовано' : 'Копіювати'}</Button></div></FormField>
    </div>
  </Modal>;
}
