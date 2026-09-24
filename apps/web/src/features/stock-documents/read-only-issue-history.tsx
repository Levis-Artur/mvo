'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorState, LoadingState, Pagination } from '@/components/ui';
import { getErrorMessage } from '@/components/common';
import type { IssueHistoryItem, Pagination as PaginationState, ResponsiblePerson } from '@/lib/types';
import { IssueHistoryTable } from './mvo-issues-view';
import { stockDocumentsService } from './stock-documents.service';
import { ReadOnlyDocumentDetails } from './read-only-document-details';
import { useAuth } from '@/app/ui/auth-context';

export function ReadOnlyIssueHistory({ personId, operationTarget }: { personId?: string; operationTarget?: ResponsiblePerson }) {
  return <IssueHistoryPage key={personId ?? 'all'} personId={personId} operationTarget={operationTarget} />;
}

function IssueHistoryPage({ personId, operationTarget }: { personId?: string; operationTarget?: ResponsiblePerson }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<IssueHistoryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    stockDocumentsService.issueHistory({
      page,
      limit: 25,
      sourceResponsiblePersonId: personId,
      accessMode: user?.role === 'OWNER' ? undefined : 'SCOPED_READ',
    }).then((response) => {
      if (!active) return;
      setItems(response.items);
      setPagination(response.pagination);
    }).catch((reason: unknown) => {
      if (active) setError(getErrorMessage(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [page, personId, revision, user?.role]);

  if (loading && !items.length) return <LoadingState label="Завантаження історії видач…" />;
  if (error) return <ErrorState message={error} />;
  if (!items.length) return <EmptyState title="Видач ще немає" message="Історії видач у вибраній області не знайдено." />;

  return (
    <div className="grid min-w-0 gap-3">
      <IssueHistoryTable items={items} onOpen={setSelectedId} />
      {pagination ? <Pagination {...pagination} onPage={setPage} /> : null}
      {selectedId ? <ReadOnlyDocumentDetails documentId={selectedId} operationTarget={operationTarget} onCompleted={() => setRevision((value) => value + 1)} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
