import type { ImportBatch } from '@/lib/types';
import { Button, Card } from '@/components/ui';

export function ImportActionsPanel({ batch, canWrite, isOwner, canCommit, loading, onValidate, onCommit, onCancel, onRollback, onDelete }: {
  batch: ImportBatch;
  canWrite: boolean;
  isOwner: boolean;
  canCommit: boolean;
  loading: boolean;
  onValidate: () => void;
  onCommit: () => void;
  onCancel: () => void;
  onRollback: () => void;
  onDelete: () => void;
}) {
  return (
    <Card title="Дії з імпортом">
      <div className="flex flex-wrap gap-2">
        {canWrite ? <>
          <Button disabled={loading} variant="outline" type="button" onClick={onValidate}>Перевірити повторно</Button>
          <Button disabled={!canCommit || loading} type="button" onClick={onCommit}>Провести</Button>
          <Button disabled={batch.status === 'COMPLETED' || loading} variant="outline" type="button" onClick={onCancel}>Скасувати</Button>
        </> : null}
        {isOwner && batch.status === 'COMPLETED' ? (
          <Button disabled={loading} variant="danger" type="button" onClick={onRollback}>Відкотити імпорт</Button>
        ) : null}
        {isOwner && batch.status !== 'COMPLETED' ? (
          <Button disabled={loading} variant="danger" type="button" onClick={onDelete}>Видалити імпорт</Button>
        ) : null}
      </div>
    </Card>
  );
}
