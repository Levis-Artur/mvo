'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { TemporaryPasswordModal } from '@/components/dialogs/temporary-password-modal';
import { PageHeader } from '@/components/layout/page-header';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';
import { Button, ErrorState, FilterBar, LoadingState, Select, Toast } from '@/components/ui';
import { getErrorMessage } from '@/components/common';
import { DestructiveActionModal } from '@/features/admin/destructive-action-modal';
import { ADMIN_ENTITY_TYPES } from '@/features/admin/admin-entity-types';
import { can, getUserManagementResource } from '@/lib/authz';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import type { ResponsiblePerson, UserSummary } from '@/lib/types';
import { UserFormModal } from './user-form-modal';
import { filterUsers, indexResponsiblePersons } from './user-model';
import { usersService } from './users.service';
import { UsersTable } from './users-table';

export function UsersView() {
  const { user } = useAuth();
  const resource = getUserManagementResource(user);
  const canWrite = can(user, 'write', resource);
  const canReset = can(user, 'resetPassword', resource);
  const canRevoke = can(user, 'revokeSessions', resource);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [deleting, setDeleting] = useState<UserSummary | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [nextUsers, nextPersons] = await Promise.all([
        usersService.users(),
        fetchAllPages((pagination) => usersService.responsiblePersons(pagination)),
      ]);
      setUsers(nextUsers); setPersons(nextPersons);
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    function toolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'users') return;
      if (detail.action === 'create' && canWrite) { setEditing(null); setFormOpen(true); }
      if (detail.action === 'refresh') void load();
    }
    window.addEventListener(TOOLBAR_EVENT, toolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, toolbar);
  }, [canWrite, load]);

  const visibleUsers = useMemo(() => filterUsers(users, filters.search, filters.role, filters.status), [filters, users]);
  const personsById = useMemo(() => indexResponsiblePersons(persons), [persons]);

  async function action(run: () => Promise<unknown>, success: string) {
    setError('');
    try { await run(); await load(); setToast({ message: success, tone: 'success' }); }
    catch (reason) { const message = getErrorMessage(reason); setError(message); setToast({ message, tone: 'error' }); }
  }

  return <section className="grid gap-4">
    <PageHeader icon="users" title={resource === 'users' ? 'Користувачі' : 'Користувачі МВО'} description="Керування обліковими записами, ролями та доступом до системи." action={<div className="flex flex-wrap gap-2">{canWrite ? <Button icon="users" type="button" onClick={() => { setEditing(null); setFormOpen(true); }}>Створити користувача</Button> : null}<Button icon="refresh" variant="outline" type="button" onClick={() => void load()}>Оновити</Button></div>} />
    <FilterBar search={searchDraft} loading={loading} onSearchChange={setSearchDraft} onApply={() => setFilters({ search: searchDraft, role: roleDraft, status: statusDraft })} onReset={() => { setSearchDraft(''); setRoleDraft(''); setStatusDraft(''); setFilters({ search: '', role: '', status: '' }); }} onRefresh={() => void load()}>
      <label className="filter-bar__field"><span>Роль</span><Select value={roleDraft} onChange={(event) => setRoleDraft(event.target.value)}><option value="">Усі ролі</option><option value="OWNER">Власник</option><option value="DPP_ADMIN">Адміністратор ДПП</option><option value="AUDITOR">Аудитор</option><option value="MVO">МВО</option></Select></label>
      <label className="filter-bar__field"><span>Активність</span><Select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}><option value="">Усі</option><option value="active">Активні</option><option value="inactive">Неактивні</option></Select></label>
    </FilterBar>
    {error ? <ErrorState message={error} /> : null}
    {loading ? <LoadingState label="Завантаження користувачів…" /> : <UsersTable users={visibleUsers} personsById={personsById} canWrite={canWrite} canResetPassword={canReset} canRevokeSessions={canRevoke} canDelete={user?.role === 'OWNER'} onEdit={(item) => { setEditing(item); setFormOpen(true); }} onResetPassword={(item) => void action(async () => { const result = await usersService.resetUserPassword(item.id); setTemporaryPassword(result.temporaryPassword); }, 'Тимчасовий пароль створено.')} onBlock={(item) => void action(() => usersService.blockUser(item.id), 'Користувача заблоковано.')} onUnblock={(item) => void action(() => usersService.unblockUser(item.id), 'Користувача розблоковано.')} onRevokeSessions={(item) => void action(() => usersService.revokeUserSessions(item.id), 'Сесії відкликано.')} onDeactivate={(item) => void action(() => usersService.deactivateUser(item.id), 'Користувача деактивовано.')} onActivate={(item) => void action(() => usersService.activateUser(item.id), 'Користувача активовано.')} onDelete={setDeleting} />}
    {formOpen ? <UserFormModal mode={resource} user={editing} onClose={() => setFormOpen(false)} onSaved={(password) => { setFormOpen(false); if (password) setTemporaryPassword(password); void load(); setToast({ message: editing ? 'Користувача оновлено.' : 'Користувача створено.', tone: 'success' }); }} /> : null}
    {temporaryPassword ? <TemporaryPasswordModal temporaryPassword={temporaryPassword} onClose={() => setTemporaryPassword('')} /> : null}
    {deleting ? <DestructiveActionModal entityType={ADMIN_ENTITY_TYPES.user} entityId={deleting.id} onClose={() => setDeleting(null)} onDeleted={async () => { await load(); setToast({ message: 'Користувача видалено.', tone: 'success' }); }} /> : null}
    {toast ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}
  </section>;
}
